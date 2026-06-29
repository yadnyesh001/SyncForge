/**
 * utils/asyncHandler.js
 * -----------------------------------------------------------------------------
 * Wraps an async Express handler so rejected promises reach the error handler.
 *
 * WHY IT EXISTS
 *   Express 4 does NOT catch errors thrown inside async functions — an
 *   unhandled rejection in a route would crash the process or hang the request.
 *   This tiny wrapper forwards any thrown/rejected error to `next()`.
 *
 * WHAT PROBLEM IT SOLVES
 *   Removes a try/catch from every single controller. Controllers stay focused
 *   on the happy path; failures are funnelled to one place.
 *
 * HOW IT CONNECTS
 *   Every controller export is wrapped with this. Errors land in
 *   middleware/errorHandler.js.
 */

module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
