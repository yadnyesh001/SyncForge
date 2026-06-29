/**
 * tests/document.test.js
 * -----------------------------------------------------------------------------
 * Document REST APIs + authorization + applyOperations idempotency + history +
 * revert (history restoration).
 */

const { setupTestDB } = require('./helpers/db');
const { app, request, registerUser, authHeader } = require('./helpers/utils');
const documentService = require('../services/document.service');
const CRDTDocument = require('../crdt/CRDTDocument');

setupTestDB();

async function makeDoc(ownerToken, title = 'Doc') {
  const res = await request(app).post('/api/documents').set(authHeader(ownerToken)).send({ title });
  return res.body.document;
}

describe('Documents CRUD + authorization', () => {
  test('create -> list -> get for the owner', async () => {
    const alice = await registerUser('alice@x.com');
    const doc = await makeDoc(alice.token, 'Design');
    expect(doc.title).toBe('Design');

    const list = await request(app).get('/api/documents').set(authHeader(alice.token));
    expect(list.body.documents).toHaveLength(1);

    const got = await request(app).get(`/api/documents/${doc._id}`).set(authHeader(alice.token));
    expect(got.status).toBe(200);
  });

  test('an outsider cannot view, even after the doc is shared with someone else', async () => {
    const alice = await registerUser('alice@x.com');
    const bob = await registerUser('bob@x.com');
    const eve = await registerUser('eve@x.com');
    const doc = await makeDoc(alice.token);

    await request(app).put(`/api/documents/${doc._id}`).set(authHeader(alice.token))
      .send({ collaborators: ['bob@x.com'] });

    expect((await request(app).get(`/api/documents/${doc._id}`).set(authHeader(bob.token))).status).toBe(200);
    expect((await request(app).get(`/api/documents/${doc._id}`).set(authHeader(eve.token))).status).toBe(403);
  });

  test('collaborators can rename + edit but cannot delete or re-share', async () => {
    const alice = await registerUser('alice@x.com');
    const bob = await registerUser('bob@x.com');
    const doc = await makeDoc(alice.token);
    await request(app).put(`/api/documents/${doc._id}`).set(authHeader(alice.token))
      .send({ collaborators: ['bob@x.com'] });

    const rename = await request(app).put(`/api/documents/${doc._id}`).set(authHeader(bob.token))
      .send({ title: 'Renamed by Bob' });
    expect(rename.status).toBe(200);
    expect(rename.body.document.title).toBe('Renamed by Bob');

    expect((await request(app).delete(`/api/documents/${doc._id}`).set(authHeader(bob.token))).status).toBe(403);
    expect((await request(app).put(`/api/documents/${doc._id}`).set(authHeader(bob.token))
      .send({ collaborators: [] })).status).toBe(403);
  });

  test('owner delete cascades to operations (history 404 afterwards)', async () => {
    const alice = await registerUser('alice@x.com');
    const doc = await makeDoc(alice.token);
    expect((await request(app).delete(`/api/documents/${doc._id}`).set(authHeader(alice.token))).status).toBe(200);
    expect((await request(app).get(`/api/documents/${doc._id}/history`).set(authHeader(alice.token))).status).toBe(404);
  });
});

describe('applyOperations (the content chokepoint)', () => {
  test('builds content and is idempotent on replay', async () => {
    const alice = await registerUser('alice@x.com');
    const doc = await makeDoc(alice.token);

    const client = new CRDTDocument('aliceSite');
    const ops = 'HELLO'.split('').map((ch, i) => client.localInsert(i, ch));

    let r = await documentService.applyOperations(alice.id, doc._id, ops);
    expect(r.content).toBe('HELLO');
    expect(r.version).toBe(5);

    r = await documentService.applyOperations(alice.id, doc._id, ops); // replay
    expect(r.content).toBe('HELLO');
    expect(r.version).toBe(5); // unchanged
  });

  test('serializes concurrent batches on the same document (no lost update)', async () => {
    const alice = await registerUser('alice@x.com');
    const doc = await makeDoc(alice.token);

    // Two independent clients each insert 3 chars concurrently.
    const c1 = new CRDTDocument('s1');
    const c2 = new CRDTDocument('s2');
    const ops1 = 'ABC'.split('').map((ch, i) => c1.localInsert(i, ch));
    const ops2 = 'XYZ'.split('').map((ch, i) => c2.localInsert(i, ch));

    await Promise.all([
      documentService.applyOperations(alice.id, doc._id, ops1),
      documentService.applyOperations(alice.id, doc._id, ops2),
    ]);

    const got = await request(app).get(`/api/documents/${doc._id}`).set(authHeader(alice.token));
    // All six characters survive (order is deterministic but content-agnostic here).
    expect(got.body.document.currentContent).toHaveLength(6);
    expect(got.body.document.version).toBe(6);
  });
});

describe('History + revert (history restoration)', () => {
  test('history lists every operation; revert restores an earlier version', async () => {
    const alice = await registerUser('alice@x.com');
    const doc = await makeDoc(alice.token);

    const client = new CRDTDocument('aliceSite');
    const hello = 'HELLO'.split('').map((ch, i) => client.localInsert(i, ch));
    await documentService.applyOperations(alice.id, doc._id, hello);
    const helloVersion = 5;

    const world = ' WORLD'.split('').map((ch, i) => client.localInsert(5 + i, ch));
    await documentService.applyOperations(alice.id, doc._id, world);

    const history = await request(app).get(`/api/documents/${doc._id}/history`).set(authHeader(alice.token));
    expect(history.body.operations).toHaveLength(11);

    const revert = await request(app).post(`/api/documents/${doc._id}/revert`).set(authHeader(alice.token))
      .send({ version: helloVersion });
    expect(revert.status).toBe(200);
    expect(revert.body.content).toBe('HELLO');

    const got = await request(app).get(`/api/documents/${doc._id}`).set(authHeader(alice.token));
    expect(got.body.document.currentContent).toBe('HELLO');
  });

  test('rejects an out-of-range revert version with 400', async () => {
    const alice = await registerUser('alice@x.com');
    const doc = await makeDoc(alice.token);
    const res = await request(app).post(`/api/documents/${doc._id}/revert`).set(authHeader(alice.token))
      .send({ version: 9999 });
    expect(res.status).toBe(400);
  });
});
