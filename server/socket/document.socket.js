/**
 * socket/document.socket.js
 * -----------------------------------------------------------------------------
 * The realtime document channel: join/leave rooms, apply + broadcast edits, and
 * catch up missed operations after a reconnect.
 *
 * WHY IT EXISTS
 *   This is the heart of "collaborative". It turns one user's keystroke into a
 *   durable operation AND a sub-second broadcast to everyone else editing the
 *   same document.
 *
 * THE CORE LOOP (document-operation)
 *   1. Client makes a local CRDT edit and emits the resulting op(s).
 *   2. Server funnels them through documentService.applyOperations (authorize ->
 *      apply to in-memory CRDT -> persist NEW ops -> refresh snapshot).
 *   3. Server broadcasts ONLY the genuinely-new ops to the rest of the room as
 *      `document-updated`. Each peer applies them to its local CRDT and converges.
 *   The ack returned to the sender carries the new version (its replay cursor).
 *
 * WHY ROOMS
 *   Each document is a Socket.IO room (`doc:<id>`). `socket.to(room).emit(...)`
 *   reaches exactly the peers on that document — and, once the Redis adapter is
 *   installed (Module 8), peers on OTHER server instances too, unchanged.
 *
 * HOW IT CONNECTS
 *   Registered per-connection by socket/index.js. Reuses the same
 *   documentService chokepoint as the REST layer, so edits from either path stay
 *   consistent. Presence (cursors/typing) is a SEPARATE channel (Module 9).
 */

const documentService = require('../services/document.service');
const logger = require('../config/logger');

const roomName = (documentId) => `doc:${documentId}`;

module.exports = function registerDocumentHandlers(io, socket) {
  const user = socket.user;
  const log = logger.child({ module: 'doc-socket', socketId: socket.id, userId: user.id });

  // Track which document rooms this socket is in, for clean teardown.
  socket.data.documents = socket.data.documents || new Set();

  /**
   * join-document: authorize, join the room, and return the current CRDT state
   * so the client can build its local document.
   * payload: { documentId }   ack: { ok, documentId, title, version, content, snapshot }
   */
  socket.on('join-document', async ({ documentId } = {}, ack) => {
    try {
      const state = await documentService.getSocketState(user.id, documentId);
      socket.join(roomName(documentId));
      socket.data.documents.add(documentId);

      // Let peers know someone arrived (lightweight; rich presence is Module 9).
      socket.to(roomName(documentId)).emit('user-joined', {
        documentId,
        userId: user.id,
        name: user.name,
      });

      log.info({ documentId }, 'joined document');
      if (ack) ack({ ok: true, ...state });
    } catch (err) {
      if (ack) ack({ ok: false, error: err.message });
    }
  });

  /** leave-document: leave the room and notify peers. */
  socket.on('leave-document', ({ documentId } = {}) => {
    socket.leave(roomName(documentId));
    socket.data.documents.delete(documentId);
    socket.to(roomName(documentId)).emit('user-left', { documentId, userId: user.id });
  });

  /**
   * document-operation: apply edit(s) and broadcast the new ones.
   * payload: { documentId, operations: Op | Op[] }
   * ack: { ok, version, applied }
   */
  socket.on('document-operation', async ({ documentId, operations } = {}, ack) => {
    try {
      const ops = Array.isArray(operations) ? operations : [operations].filter(Boolean);
      const result = await documentService.applyOperations(user.id, documentId, ops);

      if (result.applied.length) {
        socket.to(roomName(documentId)).emit('document-updated', {
          documentId,
          operations: result.applied,
          version: result.version,
          by: user.id,
        });
      }

      if (ack) ack({ ok: true, version: result.version, applied: result.applied.length });
    } catch (err) {
      if (ack) ack({ ok: false, error: err.message });
    }
  });

  /**
   * sync-missed-operations: reconnect/offline catch-up.
   * payload: { documentId, sinceVersion }   ack: { ok, version, operations }
   */
  socket.on('sync-missed-operations', async ({ documentId, sinceVersion } = {}, ack) => {
    try {
      const data = await documentService.getOperationsSince(user.id, documentId, sinceVersion);
      if (ack) ack({ ok: true, ...data });
    } catch (err) {
      if (ack) ack({ ok: false, error: err.message });
    }
  });

  /**
   * Application-level heartbeat (separate from Socket.IO's transport ping).
   * Tolerates both `emit('ping', cb)` and `emit('ping', payload, cb)` — the ack
   * is always the LAST argument when present.
   */
  socket.on('ping', (...args) => {
    const ack = args[args.length - 1];
    if (typeof ack === 'function') ack({ pong: Date.now() });
    else socket.emit('pong', { time: Date.now() });
  });

  /** On disconnect, tell each room this socket was in that the user left. */
  socket.on('disconnect', (reason) => {
    for (const documentId of socket.data.documents) {
      socket.to(roomName(documentId)).emit('user-left', { documentId, userId: user.id, reason });
    }
    log.info({ reason }, 'disconnected');
  });
};

module.exports.roomName = roomName;
