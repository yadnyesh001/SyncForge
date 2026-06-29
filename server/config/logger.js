/**
 * config/logger.js
 * -----------------------------------------------------------------------------
 * Application-wide structured logger (Pino).
 *
 * WHY IT EXISTS
 *   `console.log` is fine for toys, but a distributed system needs logs you can
 *   search, level-filter, and ship to a log aggregator. Pino emits structured
 *   JSON, is extremely fast, and lets us attach context (documentId, userId,
 *   socketId) to every line.
 *
 * WHAT PROBLEM IT SOLVES
 *   - One configured logger instance instead of ad-hoc console calls.
 *   - Pretty, human-readable output in development; raw JSON in production (so a
 *     collector like Loki/ELK can parse it).
 *   - `logger.child({ ... })` lets each subsystem (socket, crdt, auth) tag its
 *     logs with stable fields for easy filtering.
 *
 * HOW IT WORKS
 *   In dev we pipe through `pino-pretty` for colorized output. In prod (and test)
 *   we emit plain JSON. Level comes from config (env-driven).
 *
 * HOW IT CONNECTS
 *   Imported anywhere we need to log. `pino-http` (wired up in the Express app
 *   later) reuses this instance to log every HTTP request with a request id.
 */

const pino = require('pino');
const config = require('./env');

const options = {
  level: config.logLevel,
  // Redact obvious secrets if they ever end up in a logged object.
  redact: {
    paths: ['req.headers.authorization', 'password', '*.password', 'token'],
    censor: '[redacted]',
  },
};

// Pretty-print only in development; production/test get raw JSON (or silence).
const transport =
  config.env === 'development'
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      }
    : undefined;

const logger = pino(transport ? { ...options, transport } : options);

module.exports = logger;
