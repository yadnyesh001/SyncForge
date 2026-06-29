/**
 * routes/index.js
 * -----------------------------------------------------------------------------
 * Aggregates every feature router under a single /api router.
 *
 * WHY IT EXISTS
 *   One mount point keeps app.js clean and gives us a natural place to add a
 *   health check and, later, the documents router. The API version/prefix lives
 *   in exactly one file.
 *
 * HOW IT CONNECTS
 *   app.js does `app.use('/api', routes)`. New feature routers (documents in
 *   Module 6) are added here.
 */

const express = require('express');
const authRoutes = require('./auth.routes');
const documentRoutes = require('./document.routes');

const router = express.Router();

// Liveness probe (used by Docker/healthchecks and quick manual checks).
router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);

module.exports = router;
