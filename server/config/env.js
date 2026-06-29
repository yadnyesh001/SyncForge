/**
 * config/env.js
 * -----------------------------------------------------------------------------
 * The single source of truth for configuration.
 *
 * WHY IT EXISTS
 *   Configuration leaks everywhere if you read `process.env.X` directly in 30
 *   files: typos go unnoticed, defaults drift, and missing values blow up deep in
 *   the call stack at runtime. This module reads the environment ONCE, validates
 *   it, applies defaults, and exports a frozen, typed config object.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Fail fast: if a required secret (JWT_SECRET in production) is missing, we
 *     crash on boot with a clear message instead of issuing unsigned tokens.
 *   - One canonical shape for the rest of the app to import.
 *
 * HOW IT WORKS
 *   Loads `.env` via dotenv (no-op in production where real env vars are set),
 *   coerces types, validates, then Object.freeze()s the result so nothing can
 *   mutate config at runtime.
 *
 * HOW IT CONNECTS
 *   Imported by logger, db, redis, the JWT middleware, and server bootstrap.
 */

require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

function required(name, value) {
  if (value === undefined || value === '') {
    // In production a missing secret is fatal; in dev/test we allow a fallback
    // so contributors can run without a full .env.
    if (isProd) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }
  return value;
}

const config = {
  env: NODE_ENV,
  isProd,
  isTest,

  port: parseInt(process.env.PORT, 10) || 5000,

  // Accept a comma-separated list, trimmed, for CORS allow-listing.
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/rt_collab',

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwt: {
    secret: required('JWT_SECRET', process.env.JWT_SECRET) || 'dev-insecure-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  logLevel: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
};

module.exports = Object.freeze(config);
