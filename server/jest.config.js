/**
 * jest.config.js
 * -----------------------------------------------------------------------------
 * Test runner configuration.
 *
 * - Node environment (no jsdom; this is a backend).
 * - Tests live in tests/ and end with .test.js.
 * - Generous timeout: each suite spins up an in-memory MongoDB.
 * - runInBand + forceExit are set in the npm script so suites don't fight over
 *   ports / Mongo and the process exits even if a stray handle lingers.
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 60000,
  // Quieter output; our logger is already silent in NODE_ENV=test.
  verbose: true,
};
