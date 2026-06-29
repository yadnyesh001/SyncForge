/**
 * routes/document.routes.js
 * -----------------------------------------------------------------------------
 * URL -> controller wiring for documents. Every route is protected.
 *
 * Routes (all under /api/documents):
 *   GET    /                -> list my documents
 *   POST   /                -> create
 *   GET    /:id             -> open (full, incl. snapshot)
 *   PUT    /:id             -> rename / share
 *   DELETE /:id             -> delete (owner only)
 *   GET    /:id/history     -> operation log
 *   POST   /:id/revert      -> restore a previous version
 *
 * HOW IT CONNECTS
 *   Mounted under /api/documents by routes/index.js.
 */

const express = require('express');
const documentController = require('../controllers/document.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Guard the entire router — no anonymous access to documents.
router.use(protect);

router.route('/').get(documentController.list).post(documentController.create);

router
  .route('/:id')
  .get(documentController.get)
  .put(documentController.update)
  .delete(documentController.remove);

router.get('/:id/history', documentController.history);
router.post('/:id/revert', documentController.revert);

module.exports = router;
