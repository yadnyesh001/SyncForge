/**
 * models/Document.js
 * -----------------------------------------------------------------------------
 * A collaborative document's metadata + a CRDT state snapshot.
 *
 * WHY IT EXISTS
 *   We need somewhere to store a document's title, ownership, sharing, and its
 *   current content. Crucially, it also caches a SNAPSHOT of the CRDT character
 *   set so a server can rehydrate a CRDTDocument instantly on join, instead of
 *   replaying the entire operation log from the beginning of time.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Listing/dashboard needs cheap fields (title, updatedAt, owner).
 *   - `currentContent` is the rendered plain text — handy for previews/search
 *     without reconstructing the CRDT.
 *   - `snapshot` is the authoritative CRDT state (characters incl. tombstones).
 *     Loading it + applying only the operations newer than `version` is far
 *     cheaper than replaying everything (see the Operation model).
 *   - `version` is a monotonically increasing counter of applied operations; it
 *     doubles as the cursor for "what has this snapshot already absorbed?".
 *
 * HOW IT WORKS
 *   The `characterSchema` mirrors crdt/Character.toJSON() exactly, so a snapshot
 *   round-trips through Mongo without lossy conversion. `_id: false` keeps these
 *   sub-docs lean (we already have a globally-unique opId).
 *
 * HOW IT CONNECTS
 *   The document service (later) builds a CRDTDocument via
 *   CRDTDocument.fromCharacters(snapshot) on join, persists new ops to the
 *   Operation model, and periodically writes back snapshot/currentContent/version.
 */

const mongoose = require('mongoose');

// One CRDT position digit: { pos, siteId } — mirrors crdt/Identifier.toJSON().
const identifierSchema = new mongoose.Schema(
  {
    pos: { type: Number, required: true },
    siteId: { type: String, required: true },
  },
  { _id: false }
);

// One CRDT character cell — mirrors crdt/Character.toJSON().
const characterSchema = new mongoose.Schema(
  {
    position: { type: [identifierSchema], required: true },
    value: { type: String, required: true },
    siteId: { type: String, required: true },
    clock: { type: Number, required: true },
    opId: { type: String, required: true },
    deleted: { type: Boolean, default: false },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Untitled', trim: true, maxlength: 200 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Rendered plain text — cheap preview/search source of truth.
    currentContent: { type: String, default: '' },

    // Authoritative CRDT snapshot (includes tombstones).
    snapshot: { type: [characterSchema], default: [] },

    // Count of operations folded into `snapshot`. Acts as the replay cursor.
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Fast "documents I can see" queries (owned OR shared with me).
documentSchema.index({ collaborators: 1 });
// Recent-documents / dashboard ordering.
documentSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
