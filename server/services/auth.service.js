/**
 * services/auth.service.js
 * -----------------------------------------------------------------------------
 * The business logic for authentication.
 *
 * WHY IT EXISTS
 *   Controllers should be thin (parse request -> call service -> send response).
 *   ALL the real rules — "email must be unique", "password must match", "what a
 *   token contains" — live here, where they can be unit-tested without HTTP.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Keeps auth rules in one reusable place (REST and, later, the socket
 *     handshake can both lean on the same token policy).
 *   - Throws typed ApiErrors so the HTTP layer never has to interpret Mongo
 *     errors.
 *
 * HOW IT CONNECTS
 *   Called by controllers/auth.controller.js. Uses the User model + utils/jwt.
 */

const { User } = require('../models');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

/**
 * Create a new account and return the user (sans password) + a fresh token.
 * @param {{ name: string, email: string, password: string }} input
 */
async function register({ name, email, password }) {
  if (!name || !email || !password) {
    throw ApiError.badRequest('name, email and password are required');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('An account with that email already exists');
  }

  // The model's pre-save hook hashes the password.
  const user = await User.create({ name, email, password });
  const token = signToken(user._id);
  return { user, token };
}

/**
 * Validate credentials and return the user + a fresh token.
 * @param {{ email: string, password: string }} input
 */
async function login({ email, password }) {
  if (!email || !password) {
    throw ApiError.badRequest('email and password are required');
  }

  // Password is select:false on the schema, so ask for it explicitly.
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  // Same generic message whether the email or the password is wrong — never
  // reveal which accounts exist.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken(user._id);
  return { user, token };
}

/**
 * Fetch a user's public profile.
 * @param {string} userId
 */
async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

module.exports = { register, login, getProfile };
