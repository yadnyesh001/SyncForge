/**
 * CRDTDocument.js
 * -----------------------------------------------------------------------------
 * One collaborative document, as seen by one replica (one site).
 *
 * WHY IT EXISTS
 *   This is the object the rest of the backend talks to. It hides all the CRDT
 *   machinery behind a tiny, editor-friendly API: insert at a visible index,
 *   delete at a visible index, apply a remote operation, read the text. Each
 *   connected client — and each server-side document instance — owns one of these.
 *
 * WHAT PROBLEM IT SOLVES
 *   It bridges two worlds:
 *     - The EDITOR thinks in linear, visible indices ("insert at column 5").
 *     - The CRDT thinks in immutable position paths and opIds.
 *   CRDTDocument translates between them, stamps every local edit with a Lamport
 *   clock + unique opId, and guarantees that applying the same op twice (a
 *   reconnect replay) or out of order (a delete before its insert) is safe.
 *
 * HOW IT WORKS
 *   - `chars`        : the full sequence, kept sorted by position, INCLUDING
 *                      tombstones (deleted cells). Tombstones are never removed,
 *                      which is what keeps the merge commutative.
 *   - `byOpId`       : opId -> Character, for O(1) delete-target lookup.
 *   - `appliedOps`   : every opId we've already applied -> idempotent replay.
 *   - `pendingDeletes`: deletes that arrived BEFORE their target insert; applied
 *                      the moment the matching insert shows up (causal reordering).
 *
 * HOW IT CONNECTS
 *   Local edits produce an operation object that the Socket layer broadcasts and
 *   the Operation model persists. Inbound operations (from peers or from the DB
 *   on reconnect) flow through applyRemote(). fromCharacters() rehydrates a
 *   document from its stored character set.
 */

const { randomUUID } = require('crypto');
const LogicalClock = require('./LogicalClock');
const Character = require('./Character');
const MergeEngine = require('./MergeEngine');
const OperationValidator = require('./OperationValidator');

class CRDTDocument {
  /**
   * @param {string} siteId - unique id for this replica (e.g. `${userId}:${socketId}`).
   * @param {Object} [deps]
   * @param {MergeEngine}  [deps.merge] - injectable for deterministic tests.
   * @param {LogicalClock} [deps.clock]
   */
  constructor(siteId, { merge, clock } = {}) {
    this.siteId = siteId;
    this.clock = clock || new LogicalClock();
    this.merge = merge || new MergeEngine();

    this.chars = []; // sorted full sequence (includes tombstones)
    this.byOpId = new Map(); // opId -> Character
    this.appliedOps = new Set(); // every applied op's opId (dedup)
    this.pendingDeletes = new Map(); // targetOpId -> delete op (arrived early)
  }

  // ---- Reads ---------------------------------------------------------------

  /** The visible document text. */
  getText() {
    let out = '';
    for (const c of this.chars) if (!c.deleted) out += c.value;
    return out;
  }

  /** Visible (non-tombstone) characters, in order. */
  _visible() {
    return this.chars.filter((c) => !c.deleted);
  }

  // ---- Local edits (produce operations to broadcast) -----------------------

  /**
   * Insert `value` at a VISIBLE index (0..length). Returns the operation to
   * broadcast/persist, or applies locally as a side effect.
   * @param {number} index
   * @param {string} value - single character.
   * @returns {Object} insert operation
   */
  localInsert(index, value) {
    const visible = this._visible();
    const prev = index > 0 && visible[index - 1] ? visible[index - 1].position : [];
    const next = index < visible.length && visible[index] ? visible[index].position : [];

    const position = this.merge.generatePositionBetween(prev, next, this.siteId);
    const clock = this.clock.tick();
    const opId = randomUUID();

    const ch = new Character({ position, value, siteId: this.siteId, clock, opId });
    this._insertChar(ch);
    this.appliedOps.add(opId);

    return { type: 'insert', opId, siteId: this.siteId, clock, char: ch.toJSON() };
  }

  /**
   * Delete the character at a VISIBLE index. Returns the operation, or null if
   * the index is out of range.
   * @param {number} index
   * @returns {Object|null} delete operation
   */
  localDelete(index) {
    const visible = this._visible();
    const target = visible[index];
    if (!target) return null;

    target.markDeleted();
    const clock = this.clock.tick();
    const opId = randomUUID();
    this.appliedOps.add(opId);

    return {
      type: 'delete',
      opId,
      siteId: this.siteId,
      clock,
      targetOpId: target.opId,
      position: target.position.map((d) => d.toJSON()),
    };
  }

  // ---- Remote edits (from peers or DB replay) ------------------------------

  /**
   * Apply an operation produced elsewhere. Safe to call with duplicates and with
   * out-of-order deliveries — this is the heart of eventual consistency.
   * @param {Object} op
   * @returns {{ applied: boolean, reason?: string }}
   */
  applyRemote(op) {
    OperationValidator.validate(op);

    // Idempotency: the same op replayed (reconnect, at-least-once delivery) is a
    // no-op. This is what lets us deliver ops "at least once" without corruption.
    if (this.appliedOps.has(op.opId)) {
      return { applied: false, reason: 'duplicate' };
    }

    // Pull our Lamport clock ahead of anything we've now observed.
    this.clock.update(op.clock);

    if (op.type === 'insert') {
      // Guard against a duplicate character even if op ids differ.
      if (!this.byOpId.has(op.char.opId)) {
        const ch = Character.fromJSON(op.char);
        this._insertChar(ch);
        // A delete may have arrived before this insert — settle it now.
        if (this.pendingDeletes.has(ch.opId)) {
          ch.markDeleted();
          this.pendingDeletes.delete(ch.opId);
        }
      }
    } else {
      // delete
      const target = this.byOpId.get(op.targetOpId);
      if (target) {
        target.markDeleted();
      } else {
        // Insert hasn't arrived yet; buffer and apply on arrival.
        this.pendingDeletes.set(op.targetOpId, op);
      }
    }

    this.appliedOps.add(op.opId);
    return { applied: true };
  }

  // ---- Internals -----------------------------------------------------------

  /** Insert a character into the sorted sequence (binary search by position). */
  _insertChar(ch) {
    const arr = this.chars;
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].comparePosition(ch) < 0) lo = mid + 1;
      else hi = mid;
    }
    arr.splice(lo, 0, ch);
    this.byOpId.set(ch.opId, ch);
  }

  // ---- Persistence helpers -------------------------------------------------

  /** Serialize the full character set (for storing in Mongo / sending on join). */
  toJSON() {
    return this.chars.map((c) => c.toJSON());
  }

  /**
   * Rebuild a document from a persisted/transmitted character set.
   * @param {string} siteId
   * @param {Object[]} charsJson - array of Character.toJSON() objects.
   * @param {Object} [deps]
   * @returns {CRDTDocument}
   */
  static fromCharacters(siteId, charsJson, deps) {
    const doc = new CRDTDocument(siteId, deps);
    let maxClock = 0;
    for (const cj of charsJson) {
      const ch = Character.fromJSON(cj);
      doc._insertChar(ch);
      doc.appliedOps.add(ch.opId);
      if (typeof ch.clock === 'number') maxClock = Math.max(maxClock, ch.clock);
    }
    // Resume the clock ahead of everything we loaded.
    doc.clock = LogicalClock.fromJSON(maxClock);
    return doc;
  }
}

module.exports = CRDTDocument;
