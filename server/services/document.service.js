/**
 * services/document.service.js
 * -----------------------------------------------------------------------------
 * All business logic for documents: CRUD, sharing, authorization, applying
 * operations, history, and revert.
 *
 * WHY IT EXISTS
 *   This is the brain between HTTP/sockets and the data. It owns:
 *     - WHO may do WHAT (owner vs collaborator vs stranger),
 *     - how a CRDT edit becomes durable (apply -> persist op -> update snapshot),
 *     - how the operation log is read back for history and revert.
 *   Keeping it here means REST controllers and socket handlers stay thin and
 *   share identical rules.
 *
 * KEY INVARIANT
 *   The Operation log is the SOURCE OF TRUTH. `Document.snapshot` + `version` are
 *   a cache: snapshot reflects every op up to `version`. We never rewrite or
 *   delete log entries (that's why revert APPENDS new ops instead of editing).
 *
 * HOW IT CONNECTS
 *   document.controller (REST) and the socket layer (Module 7) both call into
 *   here. Uses the CRDT engine + operationMapper + the Mongoose models.
 */

const { Document, Operation, Presence, User } = require('../models');
const CRDTDocument = require('../crdt/CRDTDocument');
const { crdtOpToRow, rowToCrdtOp } = require('../utils/operationMapper');
const ApiError = require('../utils/ApiError');
const KeyedMutex = require('../utils/KeyedMutex');

// Serializes the read-modify-write of content mutations PER DOCUMENT, so two
// concurrent edits to the same doc can't race (lost update). Different documents
// proceed in parallel.
const docLock = new KeyedMutex();

// ---- Authorization helpers -------------------------------------------------

const isOwner = (doc, userId) => String(doc.owner._id || doc.owner) === String(userId);
const isCollaborator = (doc, userId) =>
  (doc.collaborators || []).some((c) => String(c._id || c) === String(userId));
const canView = (doc, userId) => isOwner(doc, userId) || isCollaborator(doc, userId);

function assertView(doc, userId) {
  if (!canView(doc, userId)) throw ApiError.forbidden('You do not have access to this document');
}
function assertEdit(doc, userId) {
  // In this app, anyone who can view can edit (collaborators are editors).
  if (!canView(doc, userId)) throw ApiError.forbidden('You cannot edit this document');
}
function assertOwner(doc, userId) {
  if (!isOwner(doc, userId)) throw ApiError.forbidden('Only the owner can do that');
}

async function loadOrThrow(documentId) {
  const doc = await Document.findById(documentId);
  if (!doc) throw ApiError.notFound('Document not found');
  return doc;
}

/** Load a document and assert the user may view it. Used by the presence layer. */
async function ensureAccess(userId, documentId) {
  const doc = await loadOrThrow(documentId);
  assertView(doc, userId);
  return doc;
}

/** Rebuild a live CRDTDocument from a stored snapshot. */
function crdtFromSnapshot(doc, siteId) {
  const plain = (doc.snapshot || []).map((c) => (c.toObject ? c.toObject() : c));
  return CRDTDocument.fromCharacters(siteId, plain);
}

// ---- CRUD ------------------------------------------------------------------

async function createDocument(userId, { title } = {}) {
  return Document.create({
    title: title && title.trim() ? title.trim() : 'Untitled',
    owner: userId,
    collaborators: [],
    snapshot: [],
    currentContent: '',
    version: 0,
  });
}

/** Documents the user owns OR collaborates on, newest first (metadata only). */
async function listDocuments(userId) {
  return Document.find({ $or: [{ owner: userId }, { collaborators: userId }] })
    .sort({ updatedAt: -1 })
    .select('title owner collaborators version currentContent createdAt updatedAt')
    .populate('owner', 'name email');
}

/** Full document (incl. snapshot) for the editor's initial load. */
async function getDocument(userId, documentId) {
  const doc = await Document.findById(documentId)
    .populate('owner', 'name email')
    .populate('collaborators', 'name email');
  if (!doc) throw ApiError.notFound('Document not found');
  assertView(doc, userId);
  return doc;
}

/**
 * Update metadata. Rename is allowed for any editor; changing collaborators
 * (sharing) is owner-only. `collaborators` is an array of emails (PUT replaces).
 */
async function updateDocument(userId, documentId, { title, collaborators } = {}) {
  const doc = await loadOrThrow(documentId);

  if (title !== undefined) {
    assertEdit(doc, userId);
    doc.title = String(title).trim() || 'Untitled';
  }

  if (collaborators !== undefined) {
    assertOwner(doc, userId);
    const emails = (Array.isArray(collaborators) ? collaborators : [])
      .map((e) => String(e).toLowerCase().trim())
      .filter(Boolean);
    const users = await User.find({ email: { $in: emails } }).select('_id');
    // Exclude the owner from the collaborator list.
    doc.collaborators = users.map((u) => u._id).filter((id) => String(id) !== String(doc.owner));
  }

  await doc.save();
  return doc.populate([
    { path: 'owner', select: 'name email' },
    { path: 'collaborators', select: 'name email' },
  ]);
}

/** Delete a document and everything attached to it (owner only). */
async function deleteDocument(userId, documentId) {
  const doc = await loadOrThrow(documentId);
  assertOwner(doc, userId);
  await Promise.all([
    Operation.deleteMany({ documentId }),
    Presence.deleteMany({ documentId }),
    doc.deleteOne(),
  ]);
  return { id: documentId };
}

// ---- Applying operations (shared by REST revert + socket edits) ------------

/**
 * Apply a batch of CRDT operations to a document, persist the NEW ones to the
 * log, and refresh the snapshot. Idempotent: ops already applied are skipped.
 *
 * This is the single chokepoint for mutating document content. The socket layer
 * calls it for live edits and for replaying a reconnecting client's backlog.
 *
 * @returns {{ version: number, content: string, applied: Object[] }}
 *          `applied` is the list of ops that were actually new (to broadcast).
 */
async function applyOperations(userId, documentId, ops) {
  // Serialize per document so concurrent edits can't race the read-modify-write.
  return docLock.run(String(documentId), async () => {
    const doc = await loadOrThrow(documentId);
    assertEdit(doc, userId);

    const crdt = crdtFromSnapshot(doc, `server:${documentId}`);
    const rows = [];
    const applied = [];
    let version = doc.version;

    for (const op of ops) {
      let result;
      try {
        result = crdt.applyRemote(op);
      } catch (err) {
        // Skip malformed ops rather than failing the whole batch.
        continue;
      }
      if (result.applied) {
        version += 1;
        rows.push({ ...crdtOpToRow(op), documentId, userId, version });
        applied.push(op);
      }
    }

    if (rows.length) {
      // ordered:false + ignore duplicate-key races (another instance persisted it).
      await Operation.insertMany(rows, { ordered: false }).catch((err) => {
        if (err.code !== 11000 && !err.writeErrors) throw err;
      });
      doc.snapshot = crdt.toJSON();
      doc.currentContent = crdt.getText();
      doc.version = version;
      await doc.save();
    }

    return { version: doc.version, content: doc.currentContent, applied };
  });
}

/**
 * The state a client needs to start editing on `join-document`: the CRDT
 * snapshot (to build a local document), the current version (its replay cursor),
 * and metadata. Authorization is enforced (view access required).
 */
async function getSocketState(userId, documentId) {
  const doc = await loadOrThrow(documentId);
  assertView(doc, userId);
  return {
    documentId: String(doc._id),
    title: doc.title,
    version: doc.version,
    content: doc.currentContent,
    snapshot: (doc.snapshot || []).map((c) => (c.toObject ? c.toObject() : c)),
  };
}

/**
 * Every operation after `sinceVersion`, as CRDT op objects ready to apply.
 * This powers `sync-missed-operations` (reconnect / offline catch-up).
 * @returns {{ version: number, operations: Object[] }}
 */
async function getOperationsSince(userId, documentId, sinceVersion = 0) {
  const doc = await loadOrThrow(documentId);
  assertView(doc, userId);
  const rows = await Operation.find({ documentId, version: { $gt: Number(sinceVersion) || 0 } })
    .sort({ version: 1 })
    .limit(5000);
  return { version: doc.version, operations: rows.map(rowToCrdtOp) };
}

// ---- History + revert ------------------------------------------------------

/** The operation log for a document (for the history panel / timeline). */
async function getHistory(userId, documentId, { limit = 200, order = 'asc' } = {}) {
  const doc = await loadOrThrow(documentId);
  assertView(doc, userId);
  return Operation.find({ documentId })
    .sort({ version: order === 'desc' ? -1 : 1 })
    .limit(Math.min(Number(limit) || 200, 1000))
    .populate('userId', 'name email');
}

/** Compute the minimal prefix/suffix-trimmed edit turning `cur` into `tgt`. */
function minimalEdit(cur, tgt) {
  let p = 0;
  const min = Math.min(cur.length, tgt.length);
  while (p < min && cur[p] === tgt[p]) p++;
  let s = 0;
  while (s < min - p && cur[cur.length - 1 - s] === tgt[tgt.length - 1 - s]) s++;
  return { at: p, del: cur.length - p - s, ins: tgt.slice(p, tgt.length - s) };
}

/**
 * Restore document content to the state at `targetVersion`.
 *
 * Strategy (collaboration-safe): replay the log up to targetVersion to learn the
 * TARGET text, diff it against the CURRENT text, and APPEND new CRDT ops that
 * transform current -> target. History is never rewritten, the log stays the
 * source of truth, and live clients can be resynced from the new ops.
 */
async function revertToVersion(userId, documentId, targetVersion) {
  return docLock.run(String(documentId), () =>
    _revertToVersionLocked(userId, documentId, targetVersion)
  );
}

async function _revertToVersionLocked(userId, documentId, targetVersion) {
  const doc = await loadOrThrow(documentId);
  assertEdit(doc, userId);

  const v = Number(targetVersion);
  if (!Number.isInteger(v) || v < 0 || v > doc.version) {
    throw ApiError.badRequest(`Invalid target version (0..${doc.version})`);
  }

  // 1. Target text = replay log up to targetVersion.
  const upto = await Operation.find({ documentId, version: { $lte: v } }).sort({ version: 1 });
  const targetDoc = new CRDTDocument(`replay:${documentId}`);
  for (const row of upto) targetDoc.applyRemote(rowToCrdtOp(row));
  const targetText = targetDoc.getText();

  // 2. Current text from snapshot, then minimal edit to reach target.
  const current = crdtFromSnapshot(doc, `revert:${userId}`);
  const currentText = current.getText();
  const { at, del, ins } = minimalEdit(currentText, targetText);

  // 3. Generate real CRDT ops on the current doc.
  const newOps = [];
  for (let k = 0; k < del; k++) {
    const op = current.localDelete(at); // index `at` collapses as we delete
    if (op) newOps.push(op);
  }
  for (let i = 0; i < ins.length; i++) {
    newOps.push(current.localInsert(at + i, ins[i]));
  }

  // 4. Persist appended ops + refresh snapshot.
  let version = doc.version;
  if (newOps.length) {
    const rows = newOps.map((op) => ({ ...crdtOpToRow(op), documentId, userId, version: ++version }));
    await Operation.insertMany(rows, { ordered: false }).catch((err) => {
      if (err.code !== 11000 && !err.writeErrors) throw err;
    });
    doc.snapshot = current.toJSON();
    doc.currentContent = current.getText();
    doc.version = version;
    await doc.save();
  }

  return { document: doc, revertedTo: v, appliedOperations: newOps, content: doc.currentContent };
}

module.exports = {
  // CRUD
  createDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  // content
  applyOperations,
  // realtime
  getSocketState,
  getOperationsSince,
  // history
  getHistory,
  revertToVersion,
  // exposed for reuse/tests
  ensureAccess,
  canView,
  canEdit: canView,
  isOwner,
  crdtFromSnapshot,
};
