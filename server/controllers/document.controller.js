/**
 * controllers/document.controller.js
 * -----------------------------------------------------------------------------
 * HTTP adapter for the document service.
 *
 * WHY IT EXISTS
 *   Maps REST requests to service calls and shapes responses. No rules here —
 *   ownership/sharing/revert logic all live in the service.
 *
 * HOW IT CONNECTS
 *   Mounted by routes/document.routes.js behind the `protect` middleware, so
 *   req.user is always present.
 */

const asyncHandler = require('../utils/asyncHandler');
const documentService = require('../services/document.service');

// GET /api/documents
const list = asyncHandler(async (req, res) => {
  const documents = await documentService.listDocuments(req.user.id);
  res.json({ documents });
});

// POST /api/documents
const create = asyncHandler(async (req, res) => {
  const doc = await documentService.createDocument(req.user.id, { title: req.body.title });
  res.status(201).json({ document: doc });
});

// GET /api/documents/:id
const get = asyncHandler(async (req, res) => {
  const doc = await documentService.getDocument(req.user.id, req.params.id);
  res.json({ document: doc });
});

// PUT /api/documents/:id   (rename and/or share)
const update = asyncHandler(async (req, res) => {
  const { title, collaborators, isPublic } = req.body;
  const doc = await documentService.updateDocument(req.user.id, req.params.id, {
    title,
    collaborators,
    isPublic,
  });
  res.json({ document: doc });
});

// DELETE /api/documents/:id
const remove = asyncHandler(async (req, res) => {
  const result = await documentService.deleteDocument(req.user.id, req.params.id);
  res.json({ deleted: true, ...result });
});

// GET /api/documents/:id/history
const history = asyncHandler(async (req, res) => {
  const operations = await documentService.getHistory(req.user.id, req.params.id, {
    limit: req.query.limit,
    order: req.query.order,
  });
  res.json({ operations });
});

// POST /api/documents/:id/revert   body: { version }
const revert = asyncHandler(async (req, res) => {
  const result = await documentService.revertToVersion(
    req.user.id,
    req.params.id,
    req.body.version
  );
  res.json(result);
});

module.exports = { list, create, get, update, remove, history, revert };
