/**
 * socket/auth.socket.js
 * -----------------------------------------------------------------------------
 * Authenticates the WebSocket handshake — the realtime mirror of the REST
 * `protect` middleware.
 *
 * WHY IT EXISTS
 *   A socket connection must be tied to a real user before it can join document
 *   rooms or emit edits. We authenticate ONCE, at connect time, using the same
 *   JWT the REST API issued — so there's a single identity model across HTTP and
 *   WebSockets.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Rejects anonymous/forged connections at the door (handshake), not per-event.
 *   - Assigns each socket a stable CRDT `siteId` (`userId:socketId`). Two tabs of
 *     the same user are DIFFERENT sites, so their concurrent edits still get
 *     distinct, deterministically-ordered position identifiers.
 *
 * HOW IT WORKS
 *   Socket.IO `io.use(middleware)` runs once per connection. The client sends the
 *   token via `auth: { token }` (preferred) or an Authorization header. We verify
 *   it, load the user, and stash identity on the socket for every handler to use.
 *
 * HOW IT CONNECTS
 *   Registered by socket/index.js before the connection handler. Downstream
 *   handlers read socket.user / socket.siteId.
 */

const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

async function socketAuth(socket, next) {
  try {
    const headerToken = (socket.handshake.headers.authorization || '').split(' ')[1];
    const token = (socket.handshake.auth && socket.handshake.auth.token) || headerToken;

    if (!token) return next(new Error('UNAUTHORIZED: missing token'));

    const decoded = verifyToken(token); // throws on invalid/expired
    const user = await User.findById(decoded.sub);
    if (!user) return next(new Error('UNAUTHORIZED: account not found'));

    // Identity available to every handler on this connection.
    socket.user = { id: String(user._id), name: user.name, email: user.email };
    // Unique CRDT site for this connection (per-tab, not just per-user).
    socket.siteId = `${user._id}:${socket.id}`;

    return next();
  } catch (err) {
    return next(new Error('UNAUTHORIZED: invalid or expired token'));
  }
}

module.exports = { socketAuth };
