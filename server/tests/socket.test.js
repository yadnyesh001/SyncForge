/**
 * tests/socket.test.js
 * -----------------------------------------------------------------------------
 * WebSocket events + offline synchronization + reconnect synchronization.
 *
 * Uses real Socket.IO over an ephemeral port and real (in-memory) Mongo.
 */

const { setupTestDB } = require('./helpers/db');
const {
  registerUser, startTestServer, makeClient, once, emitAck, closeServer, sleep,
} = require('./helpers/utils');
const documentService = require('../services/document.service');
const CRDTDocument = require('../crdt/CRDTDocument');

setupTestDB();

let ctx;
beforeEach(async () => {
  ctx = await startTestServer();
});
afterEach(async () => {
  if (ctx) await closeServer(ctx.server);
});

async function sharedDoc() {
  const a = await registerUser('a@x.com');
  const b = await registerUser('b@x.com');
  const doc = await documentService.createDocument(a.id, { title: 'Live' });
  await documentService.updateDocument(a.id, doc._id, { collaborators: ['b@x.com'] });
  return { a, b, docId: String(doc._id) };
}

describe('Socket handshake auth', () => {
  test('rejects an unauthenticated connection', async () => {
    const anon = makeClient(ctx.url, undefined);
    const err = await once(anon, 'connect_error');
    expect(err.message).toMatch(/UNAUTHORIZED/);
    anon.close();
  });
});

describe('Live editing', () => {
  test('an edit by A is broadcast to B and both converge', async () => {
    const { a, b, docId } = await sharedDoc();
    const ca = makeClient(ctx.url, a.token);
    const cb = makeClient(ctx.url, b.token);
    await Promise.all([once(ca, 'connect'), once(cb, 'connect')]);

    const joinA = await emitAck(ca, 'join-document', { documentId: docId });
    const joinB = await emitAck(cb, 'join-document', { documentId: docId });
    expect(joinA.version).toBe(0);

    const crdtA = CRDTDocument.fromCharacters('A', joinA.snapshot);
    const crdtB = CRDTDocument.fromCharacters('B', joinB.snapshot);

    const bUpdate = once(cb, 'document-updated');
    const ops = 'HELLO'.split('').map((ch, i) => crdtA.localInsert(i, ch));
    const ack = await emitAck(ca, 'document-operation', { documentId: docId, operations: ops });
    expect(ack.version).toBe(5);

    (await bUpdate).operations.forEach((op) => crdtB.applyRemote(op));
    expect(crdtA.getText()).toBe('HELLO');
    expect(crdtB.getText()).toBe('HELLO');

    ca.close();
    cb.close();
  });

  test('concurrent edits from both clients converge identically', async () => {
    const { a, b, docId } = await sharedDoc();
    const ca = makeClient(ctx.url, a.token);
    const cb = makeClient(ctx.url, b.token);
    await Promise.all([once(ca, 'connect'), once(cb, 'connect')]);
    const joinA = await emitAck(ca, 'join-document', { documentId: docId });
    const joinB = await emitAck(cb, 'join-document', { documentId: docId });
    const crdtA = CRDTDocument.fromCharacters('A', joinA.snapshot);
    const crdtB = CRDTDocument.fromCharacters('B', joinB.snapshot);

    const aGets = once(ca, 'document-updated');
    const bGets = once(cb, 'document-updated');
    const opA = crdtA.localInsert(0, '?');
    const opB = crdtB.localInsert(0, '!');
    await Promise.all([
      emitAck(ca, 'document-operation', { documentId: docId, operations: [opA] }),
      emitAck(cb, 'document-operation', { documentId: docId, operations: [opB] }),
    ]);
    (await aGets).operations.forEach((op) => crdtA.applyRemote(op));
    (await bGets).operations.forEach((op) => crdtB.applyRemote(op));
    await sleep(30);

    expect(crdtA.getText()).toBe(crdtB.getText());
    expect(crdtA.getText()).toHaveLength(2);

    ca.close();
    cb.close();
  });
});

describe('Offline + reconnect synchronization', () => {
  test('a reconnecting client catches up missed operations and converges', async () => {
    const { a, b, docId } = await sharedDoc();
    const ca = makeClient(ctx.url, a.token);
    const cb = makeClient(ctx.url, b.token);
    await Promise.all([once(ca, 'connect'), once(cb, 'connect')]);
    const joinA = await emitAck(ca, 'join-document', { documentId: docId });
    await emitAck(cb, 'join-document', { documentId: docId });
    const crdtA = CRDTDocument.fromCharacters('A', joinA.snapshot);
    const crdtB = new CRDTDocument('B');

    // A types HELLO while both online; capture the version B last saw.
    const bUpdate = once(cb, 'document-updated');
    const hello = 'HELLO'.split('').map((ch, i) => crdtA.localInsert(i, ch));
    const ack = await emitAck(ca, 'document-operation', { documentId: docId, operations: hello });
    (await bUpdate).operations.forEach((op) => crdtB.applyRemote(op));
    const lastSeen = ack.version;
    expect(crdtB.getText()).toBe('HELLO');

    // B goes OFFLINE. A keeps typing " BYE".
    cb.disconnect();
    await sleep(20);
    const bye = ' BYE'.split('').map((ch, i) => crdtA.localInsert(5 + i, ch));
    await emitAck(ca, 'document-operation', { documentId: docId, operations: bye });

    // B reconnects and requests everything after lastSeen.
    cb.connect();
    await once(cb, 'connect');
    await emitAck(cb, 'join-document', { documentId: docId });
    const missed = await emitAck(cb, 'sync-missed-operations', { documentId: docId, sinceVersion: lastSeen });
    missed.operations.forEach((op) => crdtB.applyRemote(op));

    expect(crdtB.getText()).toBe('HELLO BYE');
    expect(crdtB.getText()).toBe(crdtA.getText());

    ca.close();
    cb.close();
  });

  test('offline edits queued by a client are not duplicated when flushed after reconnect', async () => {
    // Simulates: client edits while disconnected, buffering ops locally, then
    // sends the whole buffer on reconnect. At-least-once delivery must be safe.
    const { a, docId } = await sharedDoc();
    const ca = makeClient(ctx.url, a.token);
    await once(ca, 'connect');
    const joinA = await emitAck(ca, 'join-document', { documentId: docId });
    const crdtA = CRDTDocument.fromCharacters('A', joinA.snapshot);

    // "Offline" edits buffered locally.
    const buffered = 'OFFLINE'.split('').map((ch, i) => crdtA.localInsert(i, ch));

    // Flush the buffer TWICE (e.g. an over-eager retry) — must not duplicate.
    await emitAck(ca, 'document-operation', { documentId: docId, operations: buffered });
    const second = await emitAck(ca, 'document-operation', { documentId: docId, operations: buffered });
    expect(second.applied).toBe(0); // nothing new on the retry

    const state = await documentService.getSocketState(a.id, docId);
    expect(state.content).toBe('OFFLINE');
    expect(state.version).toBe(7);

    ca.close();
  });
});

describe('Presence channel', () => {
  test('roster, cursor relay, and disconnect cleanup', async () => {
    const { a, b, docId } = await sharedDoc();
    const ca = makeClient(ctx.url, a.token);
    const cb = makeClient(ctx.url, b.token);
    await Promise.all([once(ca, 'connect'), once(cb, 'connect')]);

    const aJoin = await emitAck(ca, 'presence-join', { documentId: docId });
    expect(aJoin.users).toHaveLength(1);
    expect(aJoin.color).toMatch(/^#/);

    const bJoin = await emitAck(cb, 'presence-join', { documentId: docId });
    expect(bJoin.users).toHaveLength(2);

    const bCursor = once(cb, 'cursor-update');
    ca.emit('cursor-update', { documentId: docId, cursorPosition: 3 });
    const cur = await bCursor;
    expect(cur.userId).toBe(a.id);
    expect(cur.cursorPosition).toBe(3);

    // A disconnects -> B sees the roster shrink.
    const bLeave = once(cb, 'presence-state');
    ca.disconnect();
    expect((await bLeave).users).toHaveLength(1);

    cb.close();
  });

  test('an outsider cannot join the presence room', async () => {
    const { docId } = await sharedDoc();
    const eve = await registerUser('eve@x.com');
    const ce = makeClient(ctx.url, eve.token);
    await once(ce, 'connect');
    const res = await emitAck(ce, 'presence-join', { documentId: docId });
    expect(res.ok).toBe(false);
    ce.close();
  });
});
