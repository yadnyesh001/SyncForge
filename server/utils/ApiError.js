/**
 * utils/ApiError.js
 * -----------------------------------------------------------------------------
 * A typed, HTTP-aware error.
 *
 * WHY IT EXISTS
 *   Throwing bare `Error`s loses the one thing an API needs: the right status
 *   code. With ApiError, any layer (service, controller, middleware) can throw a
 *   semantically correct failure and a single error handler turns it into the
 *   correct HTTP response.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Clean separation: services decide WHAT went wrong (404, 409, ...); they do
 *     not touch `res`. The central error handler decides how to render it.
 *   - `isOperational` distinguishes expected failures (bad input) from bugs, so
 *     we can log/alert differently and avoid leaking internals in production.
 *
 * HOW IT CONNECTS
 *   Thrown by services + middleware, caught by middleware/errorHandler.js.
 */

class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status.
   * @param {string} message    - human-readable, safe to send to clients.
   * @param {any}    [details]  - optional structured detail (e.g. field errors).
   */
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // expected error, not a programming bug
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new ApiError(401, msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new ApiError(403, msg);
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg);
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(409, msg);
  }
  static internal(msg = 'Internal server error') {
    return new ApiError(500, msg);
  }
}

module.exports = ApiError;
