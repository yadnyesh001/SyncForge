/**
 * controllers/auth.controller.js
 * -----------------------------------------------------------------------------
 * HTTP adapter for the auth service.
 *
 * WHY IT EXISTS
 *   Controllers translate between HTTP and the service layer: pull fields off
 *   req, call the service, shape the JSON response + status code. They contain
 *   no business rules, which keeps them trivial to read and the rules testable
 *   in isolation.
 *
 * HOW IT CONNECTS
 *   Mounted by routes/auth.routes.js. Delegates everything to
 *   services/auth.service.js. Wrapped in asyncHandler so thrown ApiErrors reach
 *   the central error handler.
 */

const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { user, token } = await authService.register({ name, email, password });
  res.status(201).json({ user, token });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await authService.login({ email, password });
  res.status(200).json({ user, token });
});

// GET /api/auth/profile  (protected)
const profile = asyncHandler(async (req, res) => {
  // req.user is attached by the protect middleware.
  const user = await authService.getProfile(req.user.id);
  res.status(200).json({ user });
});

module.exports = { register, login, profile };
