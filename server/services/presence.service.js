/**
 * services/presence.service.js
 * -----------------------------------------------------------------------------
 * The data side of "who is here and where is their cursor".
 *
 * WHY IT EXISTS
 *   Presence is a different kind of data than edits: high-frequency, ephemeral,
 *   and lossy-tolerant (a dropped cursor frame doesn't matter). Keeping its
 *   persistence here — separate from the operation pipeline — means cursor spam
 *   never competes with the durable, must-not-lose edit path.
 *
 * WHAT PROBLEM IT SOLVES
 *   - One row per (document, user) so the "online users" list is naturally
 *     de-duplicated (the unique index from the Presence model).
 *   - lastSeen is refreshed on activity; the model's TTL index reaps ghosts that
 *     vanish without a clean disconnect.
 *   - Deterministic per-user color so every client paints the same person the
 *     same hue without coordination.
 *
 * HOW IT CONNECTS
 *   socket/presence.socket.js calls these on join/cursor/typing/leave/disconnect
 *   and broadcasts the results over the SEPARATE presence rooms.
 */

const { Presence } = require('../models');

// A small, high-contrast palette. Color is chosen by hashing the userId so it's
// stable across sessions and identical on every client.
const COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

function colorFor(userId) {
  const s = String(userId);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Shape sent to clients for rendering avatars + remote cursors. */
function toPublic(row) {
  return {
    userId: String(row.userId),
    name: row.userName,
    color: row.color,
    cursorPosition: row.cursorPosition,
  };
}

/** Everyone currently present in a document. */
async function list(documentId) {
  const rows = await Presence.find({ documentId }).sort({ createdAt: 1 });
  return rows.map(toPublic);
}

/** Upsert this user's presence and return the refreshed roster. */
async function join({ documentId, userId, userName, socketId, color }) {
  await Presence.findOneAndUpdate(
    { documentId, userId },
    { documentId, userId, userName, color, socketId, lastSeen: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return list(documentId);
}

/** Record a cursor move (also refreshes lastSeen for the TTL). */
async function updateCursor({ documentId, userId, cursorPosition }) {
  await Presence.updateOne(
    { documentId, userId },
    { cursorPosition, lastSeen: new Date() }
  );
}

/** Idle keep-alive so an inactive-but-open tab isn't reaped by the TTL. */
async function heartbeat({ documentId, userId }) {
  await Presence.updateOne({ documentId, userId }, { lastSeen: new Date() });
}

/** Explicit leave (closed the document) — returns the refreshed roster. */
async function leave({ documentId, userId }) {
  await Presence.deleteOne({ documentId, userId });
  return list(documentId);
}

/**
 * Remove every presence row owned by a socket (on disconnect) and report which
 * documents were affected, so the caller can re-broadcast their rosters.
 * @returns {Promise<string[]>} affected documentIds
 */
async function leaveAllForSocket(socketId) {
  const rows = await Presence.find({ socketId }).select('documentId');
  const documentIds = rows.map((r) => String(r.documentId));
  if (documentIds.length) await Presence.deleteMany({ socketId });
  return documentIds;
}

module.exports = {
  colorFor,
  list,
  join,
  updateCursor,
  heartbeat,
  leave,
  leaveAllForSocket,
};
