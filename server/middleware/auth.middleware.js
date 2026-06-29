/**
 * middleware/auth.middleware.js
 * -----------------------------------------------------------------------------
 * The `protect` gate for REST routes.
 *
 * WHY IT EXISTS
 *   Protected endpoints (everything about documents) must know WHO is calling.
 *   This middleware extracts the bearer token, verifies it, confirms the user
 *   still exists, and attaches a minimal `req.user` for downstream handlers.
 *
 * WHAT PROBLEM IT SOLVES
 *   - One reusable guard instead of token parsing in every controller.
 *   - Confirms the account wasn't deleted after the token was issued.
 *   - Emits typed 401s the error handler renders consistently.
 *
 * HOW IT CONNECTS
 *   Applied to protected routers (auth/profile, all document routes). The socket
 *   layer (Module 7) reuses utils/jwt.verifyToken for the same check on connect.
 */

const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    // jwt throws TokenExpiredError / JsonWebTokenError — normalize to 401.
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists');
  }

  // Attach a small, consistent identity for downstream handlers.
  req.user = { id: String(user._id), name: user.name, email: user.email };
  next();
});

module.exports = { protect };
