/**
 * models/Presence.js
 * -----------------------------------------------------------------------------
 * Who is currently in a document, and where their cursor is.
 *
 * WHY IT EXISTS
 *   The presence layer (online users, names, cursors, typing) is deliberately a
 *   SEPARATE concern from document edits — different update frequency, different
 *   durability needs. This model persists the "last known" presence so a fresh
 *   page load can render the room immediately, and so presence survives a single
 *   instance restart.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Presence is EPHEMERAL: if a browser tab is closed without a clean
 *     disconnect, its row should not linger forever. A TTL index auto-expires
 *     rows whose `lastSeen` is older than the cutoff, so ghosts clean themselves.
 *   - One row per (document, user) keeps the "online users" list de-duplicated.
 *
 * HOW IT WORKS
 *   - `expires` on `lastSeen` creates a MongoDB TTL index; the background reaper
 *     deletes rows ~PRESENCE_TTL_SECONDS after their last heartbeat.
 *   - The socket layer "touches" lastSeen on every ping/cursor update (Module 9).
 *
 * HOW IT CONNECTS
 *   The presence socket channel upserts these rows on join/cursor/typing and the
 *   client renders avatars + remote cursors from them. (Hot, per-keystroke
 *   presence is also fanned out live over Redis; Mongo is the durable backstop.)
 */

const mongoose = require('mongoose');

// How long after the last heartbeat a presence row is considered stale.
const PRESENCE_TTL_SECONDS = 60;

const presenceSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalized so the UI can label cursors without a second lookup.
    userName: { type: String, required: true },
    // Stable per-user color for the cursor/caret.
    color: { type: String },
    // The socket connection backing this presence (helps clean up on disconnect).
    socketId: { type: String },
    // Caret index in the VISIBLE document (and optional selection later).
    cursorPosition: { type: Number, default: 0 },

    lastSeen: { type: Date, default: Date.now, expires: PRESENCE_TTL_SECONDS },
  },
  { timestamps: true }
);

// One presence row per user per document (upsert target).
presenceSchema.index({ documentId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Presence', presenceSchema);
module.exports.PRESENCE_TTL_SECONDS = PRESENCE_TTL_SECONDS;
