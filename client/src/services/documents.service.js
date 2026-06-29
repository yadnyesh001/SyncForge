/**
 * services/documents.service.js
 * -----------------------------------------------------------------------------
 * Thin wrappers around the document REST endpoints. Keeping these in one module
 * means components call `documentsApi.list()` instead of sprinkling URL strings
 * everywhere.
 */

import api from './api';

export const documentsApi = {
  list: () => api.get('/documents').then((r) => r.data.documents),
  create: (title) => api.post('/documents', { title }).then((r) => r.data.document),
  get: (id) => api.get(`/documents/${id}`).then((r) => r.data.document),
  update: (id, payload) => api.put(`/documents/${id}`, payload).then((r) => r.data.document),
  remove: (id) => api.delete(`/documents/${id}`).then((r) => r.data),
  history: (id, params) => api.get(`/documents/${id}/history`, { params }).then((r) => r.data.operations),
  revert: (id, version) => api.post(`/documents/${id}/revert`, { version }).then((r) => r.data),
};

export default documentsApi;
