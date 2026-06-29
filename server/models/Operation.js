/**
 * models/Operation.js
 * -----------------------------------------------------------------------------
 * The append-only log of every CRDT operation ever applied to a document.
 *
 * WHY IT EXISTS
 *   This single collection powers three headline features at once:
 *     1. HISTORY  — "view every operation" and "restore a previous version".
 *     2. OFFLINE / RECONNECT SYNC — a reconnecting client says "I last saw
 *        version N; give me everything after that," and we stream the tail.
 *     3. DURABILITY — the snapshot in Document is just a cache; the op log is the
 *        ground truth it can always be rebuilt from.
 *
 * WHAT PROBLEM IT SOLVES
 *   - `operationId` is the CRDT op's globally-unique id. The UNIQUE compound
 *     index on { documentId, operationId } makes persistence IDEMPOTENT: a client
 *     that resends an op after reconnect can't create a duplicate row. This is
 *     the database-level mirror of the in-memory `appliedOps` dedup.
 *   - `version` is a per-document monotonically increasing sequence number that
 *     gives operations a total, queryable order for replay ("everything with
 *     version > N").
 *
 * HOW IT WORKS
 *   Each row stores everything needed to RECONSTRUCT the exact operation object
 *   the CRDT engine expects: type, value, position path, targetOpId, siteId, and
 *   logicalClock. No lossy transforms.
 *
 * HOW IT CONNECTS
 *   The document service writes one row per applied op and reads tails of this
 *   log for the `sync-missed-operations` socket event and the `/history` and
 *   `/revert` REST endpoints.
 */

const mongoose = require('mongoose');

const identifierSchema = new mongoose.Schema(
  {
    pos: { type: Number, required: true },
    siteId: { type: String, required: true },
  },
  { _id: false }
);

const operationSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    // The CRDT operation's globally-unique id (from crypto.randomUUID()).
    operationId: { type: String, required: true },
    // Who performed it (for attribution / history UI).
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // The CRDT replica id that minted the op (userId + socket).
    siteId: { type: String, required: true },

    operationType: { type: String, enum: ['insert', 'delete'], required: true },

    // insert payload: the character glyph + its immutable position path.
    value: { type: String },
    position: { type: [identifierSchema], default: undefined },

    // delete payload: which character (by opId) this op tombstones.
    targetOpId: { type: String },

    // Lamport timestamp carried by the op (concurrency tie-breaker).
    logicalClock: { type: Number, required: true },

    // Per-document sequence number — the replay cursor.
    version: { type: Number, required: true },
  },
  { timestamps: true } // createdAt acts as the wall-clock "timestamp"
);

// Idempotent persistence: the same op can never be stored twice for a document.
operationSchema.index({ documentId: 1, operationId: 1 }, { unique: true });
// Ordered tail reads for replay / history ("version > lastSeen").
operationSchema.index({ documentId: 1, version: 1 });

module.exports = mongoose.model('Operation', operationSchema);
