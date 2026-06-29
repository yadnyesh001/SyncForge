/**
 * tests/helpers/db.js
 * -----------------------------------------------------------------------------
 * Wires an in-memory MongoDB into a test suite's lifecycle.
 *
 * Call `setupTestDB()` at the top of a test file. It:
 *   - starts a fresh MongoMemoryServer before all tests,
 *   - wipes every collection between tests (isolation), and
 *   - tears everything down afterwards.
 *
 * Using a real (but ephemeral) Mongo means our tests exercise the actual
 * indexes, validators, and queries — not mocks.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDB, disconnectDB, mongoose } = require('../../config/db');

function setupTestDB() {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectDB(mongod.getUri());
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await disconnectDB();
    if (mongod) await mongod.stop();
  });
}

module.exports = { setupTestDB };
