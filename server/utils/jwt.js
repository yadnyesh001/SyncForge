/**
 * utils/jwt.js
 * -----------------------------------------------------------------------------
 * Thin wrapper around jsonwebtoken using our configured secret + expiry.
 *
 * WHY IT EXISTS
 *   Both the REST layer (auth middleware) and the realtime layer (Socket.IO
 *   handshake, Module 7) must verify tokens identically. Centralizing sign/verify
 *   guarantees they share one secret and one policy.
 *
 * WHAT PROBLEM IT SOLVES
 *   No scattered `jwt.sign(..., process.env.JWT_SECRET)` calls that could drift.
 *   One place to later add issuer/audience claims, key rotation, etc.
 *
 * HOW IT CONNECTS
 *   auth.service signs tokens here; auth.middleware and the socket auth guard
 *   verify them here.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Sign a token for a user.
 * @param {string} userId - Mongo _id; stored in the `sub` claim.
 * @returns {string} signed JWT
 */
function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Verify and decode a token. Throws on invalid/expired tokens.
 * @param {string} token
 * @returns {{ sub: string, iat: number, exp: number }}
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { signToken, verifyToken };
