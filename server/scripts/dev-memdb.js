/**
 * scripts/dev-memdb.js
 * -----------------------------------------------------------------------------
 * Boot the REAL server against an in-memory MongoDB and no Redis — handy for
 * local development / demos when you don't have MongoDB or Docker running.
 *
 *   node scripts/dev-memdb.js
 *
 * For production use Docker Compose (Module 14), which provides real Mongo+Redis.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('rt_collab');
  process.env.DISABLE_REDIS = '1';
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.PORT = process.env.PORT || '5000';

  // eslint-disable-next-line no-console
  console.log('[dev-memdb] in-memory MongoDB at', process.env.MONGO_URI);

  // Start the server now that env is configured.
  require('../server');

  const stop = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})();
