/**
 * config/db.js
 * -----------------------------------------------------------------------------
 * MongoDB connection lifecycle (via Mongoose).
 *
 * WHY IT EXISTS
 *   The database connection is a shared, long-lived resource. Opening it in one
 *   place (with consistent options, logging, and error handling) keeps the rest
 *   of the codebase from each managing its own connection.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Centralized connect/disconnect so server bootstrap and the test harness
 *     share identical logic.
 *   - Surfaces connection problems loudly at startup rather than failing on the
 *     first query.
 *
 * HOW IT WORKS
 *   Mongoose keeps a single global connection pool. connectDB() awaits the
 *   initial connect and wires up event logging; disconnectDB() closes it
 *   cleanly (used on shutdown and between test runs).
 *
 * HOW IT CONNECTS
 *   server bootstrap calls connectDB() before listening. Models defined under
 *   server/models use this same default connection.
 */

const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

const log = logger.child({ module: 'db' });

// Buffering commands while disconnected just hides problems; fail fast instead.
mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () => log.info('MongoDB connected'));
mongoose.connection.on('error', (err) => log.error({ err }, 'MongoDB connection error'));
mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));

/**
 * Open the connection. Safe to call once at startup.
 * @param {string} [uri] - override (tests pass an in-memory server URI).
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB(uri = config.mongoUri) {
  // Some networks (home routers, college/corporate Wi-Fi) refuse the SRV DNS
  // query that `mongodb+srv://` needs, causing `querySrv ECONNREFUSED`. Setting
  // DNS_SERVERS makes Node resolve through public DNS (e.g. 8.8.8.8) instead,
  // without changing any OS settings.
  if (process.env.DNS_SERVERS) {
    const servers = process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
    if (servers.length) {
      dns.setServers(servers);
      log.info({ servers }, 'Using custom DNS servers for resolution');
    }
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  return mongoose;
}

/** Close the connection cleanly (shutdown / test teardown). */
async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB, mongoose };
