/**
 * config/redis.js
 * -----------------------------------------------------------------------------
 * Redis connection factory + pub/sub client pair.
 *
 * WHY IT EXISTS
 *   We run MORE THAN ONE backend instance (that's the whole point of "scalable").
 *   When user X edits a document on instance #1, instance #2 — which holds the
 *   socket for user Y on the same document — must learn about it. A single
 *   process's in-memory event emitter can't cross processes. Redis pub/sub can.
 *
 * WHAT PROBLEM IT SOLVES
 *   - A shared message bus so all instances broadcast/receive document ops.
 *   - The backing store for the Socket.IO Redis adapter, which transparently
 *     fans out `io.to(room).emit(...)` across every instance.
 *   - A place to keep cross-instance shared state (presence, sessions) later.
 *
 * HOW IT WORKS
 *   ioredis requires SEPARATE connections for publishing and subscribing: once a
 *   connection enters subscriber mode it can't issue normal commands. So we keep
 *   a general-purpose `client` and create `publisher`/`subscriber` duplicates.
 *   `maxRetriesPerRequest: null` is the setting the Socket.IO adapter expects.
 *
 * HOW IT CONNECTS
 *   server bootstrap calls initRedis(); the Socket.IO layer pulls pub/sub from
 *   here to install the redis adapter. Presence/session services reuse `client`.
 */

const IORedis = require('ioredis');
const config = require('./env');
const logger = require('./logger');

const log = logger.child({ module: 'redis' });

let client = null; // general-purpose commands (get/set/etc.)
let publisher = null; // dedicated PUBLISH connection
let subscriber = null; // dedicated SUBSCRIBE connection

function buildClient(name) {
  const conn = new IORedis(config.redisUrl, {
    // Required by the Socket.IO redis adapter; also avoids commands erroring out
    // during transient reconnects.
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });
  conn.on('connect', () => log.info({ name }, 'Redis client connected'));
  conn.on('error', (err) => log.error({ name, err }, 'Redis client error'));
  conn.on('close', () => log.warn({ name }, 'Redis client connection closed'));
  return conn;
}

/**
 * Initialize the three connections. Idempotent — safe to call once on boot.
 * @returns {Promise<{ client: IORedis, publisher: IORedis, subscriber: IORedis }>}
 */
async function initRedis() {
  if (!client) client = buildClient('main');
  if (!publisher) publisher = client.duplicate();
  if (!subscriber) subscriber = client.duplicate();
  // Touch the server so a bad URL fails fast at boot. Bounded so a DOWN Redis
  // can't hang startup forever (ioredis would otherwise queue the command).
  await Promise.race([
    client.ping(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis ping timed out')), 3000)
    ),
  ]);
  return { client, publisher, subscriber };
}

/** The general-purpose client (throws if initRedis hasn't run). */
function getClient() {
  if (!client) throw new Error('Redis not initialized — call initRedis() first');
  return client;
}

/** The { publisher, subscriber } pair for pub/sub and the Socket.IO adapter. */
function getPubSub() {
  if (!publisher || !subscriber) throw new Error('Redis pub/sub not initialized');
  return { publisher, subscriber };
}

/** Close all connections cleanly (shutdown / test teardown). */
async function closeRedis() {
  await Promise.all(
    [client, publisher, subscriber].filter(Boolean).map((c) => c.quit().catch(() => {}))
  );
  client = publisher = subscriber = null;
}

module.exports = { initRedis, getClient, getPubSub, closeRedis };
