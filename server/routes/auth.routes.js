/**
 * routes/auth.routes.js
 * -----------------------------------------------------------------------------
 * URL -> controller wiring for authentication.
 *
 * WHY IT EXISTS
 *   Routers are the thinnest layer: they map HTTP method + path to a controller
 *   and attach the right middleware (e.g. `protect`). Keeping them declarative
 *   makes the API surface easy to read at a glance.
 *
 * Routes:
 *   POST /api/auth/register  -> create account
 *   POST /api/auth/login     -> obtain a token
 *   GET  /api/auth/profile   -> current user (protected)
 *
 * HOW IT CONNECTS
 *   Mounted under /api/auth by routes/index.js.
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', protect, authController.profile);

module.exports = router;
