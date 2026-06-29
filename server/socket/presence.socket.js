/**
 * socket/presence.socket.js
 * -----------------------------------------------------------------------------
 * The presence channel: online users, live cursors, and typing indicators.
 *
 * WHY IT EXISTS / WHY SEPARATE
 *   Presence is intentionally decoupled from the edit channel:
 *     - Different ROOMS: `presence:<id>` vs `doc:<id>`. Subscribing to cursors is
 *       independent from subscribing to edits.
 *     - Different DURABILITY: cursor/typing frames are fire-and-forget. They are
 *       NEVER routed through applyOperations, so they can't slow or corrupt the
 *       convergence-critical edit pipeline.
 *     - Different FREQUENCY: cursors fire per mouse-move; we broadcast those as
 *       tiny targeted messages and only emit the FULL roster on join/leave.
 *
 * EVENT MAP
 *   in : presence-join · cursor-update · typing · presence-heartbeat · presence-leave
 *   out: presence-state (full roster) · cursor-update · typing
 *
 * HOW IT CONNECTS
 *   Registered per-connection by socket/index.js alongside the document handlers.
 *   Broadcasts ride the same Redis-backed rooms, so presence also scales across
 *   instances for free (Module 8).
 */

const presenceService = require('../services/presence.service');
const documentService = require('../services/document.service');
const logger = require('../config/logger');

const presenceRoom = (documentId) => `presence:${documentId}`;

module.exports = function registerPresenceHandlers(io, socket) {
  const user = socket.user;
  const color = presenceService.colorFor(user.id);
  const log = logger.child({ module: 'presence-socket', userId: user.id });

  socket.data.presenceDocs = socket.data.presenceDocs || new Set();

  /** Enter a document's presence room and announce the refreshed roster. */
  socket.on('presence-join', async ({ documentId } = {}, ack) => {
    try {
      await documentService.ensureAccess(user.id, documentId); // 403 if not allowed
      socket.join(presenceRoom(documentId));
      socket.data.presenceDocs.add(documentId);

      const users = await presenceService.join({
        documentId,
        userId: user.id,
        userName: user.name,
        socketId: socket.id,
        color,
      });

      // Everyone (including the joiner) gets the new roster.
      io.to(presenceRoom(documentId)).emit('presence-state', { documentId, users });
      if (ack) ack({ ok: true, users, color });
    } catch (err) {
      if (ack) ack({ ok: false, error: err.message });
    }
  });

  /** High-frequency cursor move: tiny targeted broadcast + lazy DB touch. */
  socket.on('cursor-update', ({ documentId, cursorPosition } = {}) => {
    if (!socket.data.presenceDocs.has(documentId)) return;
    socket.to(presenceRoom(documentId)).emit('cursor-update', {
      documentId,
      userId: user.id,
      name: user.name,
      color,
      cursorPosition,
    });
    // Persist for late joiners / TTL refresh, but never block the broadcast.
    presenceService.updateCursor({ documentId, userId: user.id, cursorPosition }).catch(() => {});
  });

  /** Typing indicator — purely ephemeral, not persisted. */
  socket.on('typing', ({ documentId, isTyping } = {}) => {
    if (!socket.data.presenceDocs.has(documentId)) return;
    socket.to(presenceRoom(documentId)).emit('typing', {
      documentId,
      userId: user.id,
      name: user.name,
      isTyping: !!isTyping,
    });
  });

  /** Idle keep-alive so an open-but-quiet tab isn't TTL-reaped. */
  socket.on('presence-heartbeat', ({ documentId } = {}) => {
    if (!socket.data.presenceDocs.has(documentId)) return;
    presenceService.heartbeat({ documentId, userId: user.id }).catch(() => {});
  });

  /** Explicit leave (closed the doc but stayed connected). */
  socket.on('presence-leave', async ({ documentId } = {}) => {
    socket.leave(presenceRoom(documentId));
    socket.data.presenceDocs.delete(documentId);
    const users = await presenceService.leave({ documentId, userId: user.id }).catch(() => []);
    socket.to(presenceRoom(documentId)).emit('presence-state', { documentId, users });
  });

  /** On disconnect, drop this socket's presence everywhere and refresh rosters. */
  socket.on('disconnect', async () => {
    try {
      const documentIds = await presenceService.leaveAllForSocket(socket.id);
      for (const documentId of documentIds) {
        const users = await presenceService.list(documentId);
        io.to(presenceRoom(documentId)).emit('presence-state', { documentId, users });
      }
    } catch (err) {
      log.warn({ err: err.message }, 'presence cleanup on disconnect failed');
    }
  });
};
