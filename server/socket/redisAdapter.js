/**
 * socket/redisAdapter.js
 * -----------------------------------------------------------------------------
 * Builds the Socket.IO Redis adapter that lets MANY backend instances behave
 * like one.
 *
 * WHY IT EXISTS
 *   By default, `io.to(room).emit(...)` only reaches sockets connected to THIS
 *   Node process. In production you run several instances behind a load
 *   balancer, so two users editing the same document may be pinned to different
 *   instances. Without coordination, instance A's broadcast never reaches
 *   instance B's user — collaboration silently breaks.
 *
 * WHAT PROBLEM IT SOLVES
 *   The Redis adapter publishes every room emit to a Redis channel; every other
 *   instance is subscribed and re-emits locally. Result: `io.to(room).emit(...)`
 *   transparently fans out across the whole cluster. Our document.socket.js code
 *   doesn't change AT ALL — that's the beauty of the adapter pattern.
 *
 * HOW IT WORKS
 *   @socket.io/redis-adapter needs two connections: one to PUBLISH, one to
 *   SUBSCRIBE (a subscribing connection can't run other commands). config/redis
 *   already provisions exactly that pair, so we reuse it.
 *
 * HOW IT CONNECTS
 *   server.js calls buildRedisAdapter() at boot and passes the result to
 *   initSocket({ adapter }). createSocketAdapter() is factored out so tests can
 *   inject mock pub/sub clients and verify cross-instance fan-out in-process.
 */

const { createAdapter } = require('@socket.io/redis-adapter');
const { initRedis, getPubSub } = require('../config/redis');

/**
 * Build a Socket.IO adapter factory from explicit pub/sub clients.
 * @param {import('ioredis').Redis} pubClient
 * @param {import('ioredis').Redis} subClient
 * @returns {Function} adapter factory for io.adapter(...)
 */
function createSocketAdapter(pubClient, subClient) {
  return createAdapter(pubClient, subClient);
}

/**
 * Connect Redis (if not already) and build the adapter from the shared pair.
 * Throws if Redis is unreachable — server.js catches and degrades to single
 * instance in development.
 * @returns {Promise<Function>}
 */
async function buildRedisAdapter() {
  await initRedis();
  const { publisher, subscriber } = getPubSub();
  return createSocketAdapter(publisher, subscriber);
}

module.exports = { buildRedisAdapter, createSocketAdapter };
