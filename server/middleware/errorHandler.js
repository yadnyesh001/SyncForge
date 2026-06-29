/**
 * middleware/errorHandler.js
 * -----------------------------------------------------------------------------
 * The single place that turns any thrown error into an HTTP response.
 *
 * WHY IT EXISTS
 *   With one terminal error handler, every layer can just THROW. Controllers and
 *   services never touch status codes or response bodies for failures, and the
 *   response shape stays consistent across the whole API.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Maps common non-ApiError failures (Mongo duplicate key, Mongoose
 *     validation, cast errors, JWT errors) to the right status code.
 *   - Hides internal details for unexpected 5xx errors in production while still
 *     logging the full error server-side.
 *
 * HOW IT CONNECTS
 *   Registered LAST in app.js, after all routes. `notFound` handles unmatched
 *   routes by funnelling a 404 into the same handler.
 */

const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const logger = require('../config/logger');

const log = logger.child({ module: 'error' });

/** Catch-all for unmatched routes -> 404 through the normal pipeline. */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/* eslint-disable no-unused-vars */ // Express requires the 4-arg signature.
function errorHandler(err, req, res, next) {
  let error = err;

  // Normalize well-known library errors into ApiError.
  if (!(error instanceof ApiError)) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      error = ApiError.conflict(`Duplicate value for ${field}`);
    } else if (error.name === 'ValidationError') {
      const details = Object.values(error.errors || {}).map((e) => e.message);
      error = ApiError.badRequest('Validation failed', details);
    } else if (error.name === 'CastError') {
      error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
    } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error = ApiError.unauthorized('Invalid or expired token');
    } else {
      error = new ApiError(error.statusCode || 500, error.message || 'Internal server error');
    }
  }

  if (error.statusCode >= 500) {
    log.error({ err, path: req.originalUrl }, 'Unhandled server error');
  }

  const body = {
    error: {
      message:
        error.statusCode >= 500 && config.isProd ? 'Internal server error' : error.message,
    },
  };
  if (error.details) body.error.details = error.details;

  res.status(error.statusCode || 500).json(body);
}

module.exports = { notFound, errorHandler };
