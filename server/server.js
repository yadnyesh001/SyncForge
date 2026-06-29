/**
 * server.js
 * -----------------------------------------------------------------------------
 * The production entry point: connect dependencies, bind HTTP + WebSockets, and
 * listen. (app.js builds the Express app; this file gives it a network + sockets.)
 *
 * WHY IT EXISTS
 *   Tests import `app` and drive it in-memory. Production needs a real HTTP
 *   server that ALSO hosts Socket.IO on the same port, plus database/redis
 *   connections and graceful shutdown. That's this file's job.
 *
 * STARTUP ORDER (matters)
 *   1. Connect MongoDB (fail fast if unreachable).
 *   2. Try Redis; if present, install the Socket.IO Redis adapter so multiple
 *      instances share rooms (Module 8 builds the adapter). Optional in dev.
 *   3. Create the HTTP server from the Express app, attach Socket.IO, listen.
 *
 * HOW IT CONNECTS
 *   Uses config/db, config/redis, socket/index, and (Module 8) the redis adapter.
 */

const http = require('http');
const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/db');
const { initSocket } = require('./socket');

const log = logger.child({ module: 'bootstrap' });

let httpServer;
let io;

async function start() {
  // 1. Database — required.
  await connectDB();

  // 2. Redis adapter — optional in dev, enables horizontal scaling in prod.
  //    Set DISABLE_REDIS=1 to skip entirely (e.g. local dev without Redis).
  let adapter;
  if (process.env.DISABLE_REDIS) {
    log.warn('DISABLE_REDIS set — running single-instance without Redis');
  } else {
    try {
      const { buildRedisAdapter } = require('./socket/redisAdapter');
      adapter = await buildRedisAdapter();
      log.info('Socket.IO Redis adapter enabled');
    } catch (err) {
      log.warn({ err: err.message }, 'Redis adapter not enabled — running single-instance');
      await require('./config/redis').closeRedis().catch(() => {});
    }
  }

  // 3. HTTP + Socket.IO on one port.
  httpServer = http.createServer(app);
  io = initSocket(httpServer, { adapter });

  httpServer.listen(config.port, () => {
    log.info({ port: config.port, env: config.env }, 'server listening');
  });
}

/** Close everything in reverse order so in-flight work can settle. */
async function shutdown(signal) {
  log.info({ signal }, 'shutting down');
  try {
    if (io) await new Promise((resolve) => io.close(resolve));
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    await disconnectDB();
    try {
      await require('./config/redis').closeRedis();
    } catch (_) {
      /* redis may never have started */
    }
  } finally {
    process.exit(0);
  }
}

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
process.on('unhandledRejection', (reason) => log.error({ reason }, 'unhandledRejection'));

start().catch((err) => {
  log.error({ err }, 'failed to start');
  process.exit(1);
});

module.exports = { start, shutdown };
