/**
 * socket/index.js
 * -----------------------------------------------------------------------------
 * Creates and wires the Socket.IO server.
 *
 * WHY IT EXISTS
 *   One place that: attaches Socket.IO to the HTTP server, installs the
 *   handshake auth guard, (optionally) installs the Redis adapter for
 *   multi-instance scaling, and registers every feature's handlers per
 *   connection.
 *
 * WHAT PROBLEM IT SOLVES
 *   Keeps server.js tiny and makes the socket server independently testable: the
 *   test harness calls initSocket(httpServer) against an ephemeral port.
 *
 * HOW IT CONNECTS
 *   server.js calls initSocket(httpServer, { adapter }). The Redis adapter is
 *   built in Module 8 and passed in here, so this file doesn't depend on Redis.
 */

const { Server } = require('socket.io');
const config = require('../config/env');
const logger = require('../config/logger');
const { socketAuth } = require('./auth.socket');
const registerDocumentHandlers = require('./document.socket');
const registerPresenceHandlers = require('./presence.socket');

/**
 * @param {import('http').Server} httpServer
 * @param {Object} [opts]
 * @param {Function} [opts.adapter] - a Socket.IO adapter factory (e.g. redis).
 * @param {Object}   [opts.serverOptions] - extra Socket.IO Server options.
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer, opts = {}) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, credentials: true },
    ...(opts.serverOptions || {}),
  });

  // Cross-instance fan-out (Module 8). No-op when not provided (single instance).
  if (opts.adapter) io.adapter(opts.adapter);

  // Authenticate the handshake — unauthenticated sockets never reach handlers.
  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger
      .child({ module: 'socket' })
      .info({ socketId: socket.id, userId: socket.user.id }, 'client connected');

    // Each feature registers its own events on the connection.
    registerDocumentHandlers(io, socket);
    registerPresenceHandlers(io, socket);
  });

  return io;
}

module.exports = { initSocket };
