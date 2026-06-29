/**
 * socket/socket.js
 * -----------------------------------------------------------------------------
 * A tiny singleton manager for the Socket.IO connection.
 *
 * WHY IT EXISTS
 *   The whole app shares ONE socket connection (multiplexed across document
 *   rooms and the presence channel). Creating it in one place — authenticated
 *   with the JWT — avoids duplicate connections and lets any component grab the
 *   live socket.
 *
 * RECONNECTION
 *   We rely on Socket.IO's built-in reconnection (enabled by default). On
 *   reconnect the Editor re-joins its room and runs sync-missed-operations
 *   (Module 12), which is why offline edits recover seamlessly.
 *
 * HOW IT CONNECTS
 *   AuthContext connects after login and disconnects on logout. The Editor
 *   reads the socket via getSocket().
 */

import { io } from 'socket.io-client';

// In Docker the app is served by Nginx which proxies /socket.io to the backend,
// so we connect same-origin. In local dev, set VITE_SOCKET_URL=http://localhost:5000.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

let socket = null;

/** Connect (or return the existing connection) authenticated with `token`. */
export function connectSocket(token) {
  if (socket && socket.connected) return socket;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    // Built-in resilience: keep retrying with backoff after a drop.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
