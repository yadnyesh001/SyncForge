/**
 * tests/crdt.test.js
 * -----------------------------------------------------------------------------
 * The CRDT engine: ordering math, merge properties, and — the headline — the
 * 5-client EVENTUAL CONSISTENCY test. No DB or network; pure algorithm.
 */

const LogicalClock = require('../crdt/LogicalClock');
const Identifier = require('../crdt/Identifier');
const Character = require('../crdt/Character');
const MergeEngine = require('../crdt/MergeEngine');
const CRDTDocument = require('../crdt/CRDTDocument');
const OperationValidator = require('../crdt/OperationValidator');

// Deterministic RNG (mulberry32) so a failing case is reproducible from its seed.
function mulberry32(seed) {
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rng) =>
  arr.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

describe('LogicalClock', () => {
  test('tick increments; update keeps clock ahead of anything seen', () => {
    const c = new LogicalClock();
    expect(c.tick()).toBe(1);
    expect(c.tick()).toBe(2);
    expect(c.update(10)).toBe(11); // max(2,10)+1
    expect(c.tick()).toBe(12);
  });
});

describe('Identifier / Character ordering', () => {
  test('Identifier compares pos first, then siteId as tie-break', () => {
    expect(new Identifier(1, 'A').compareTo(new Identifier(2, 'A'))).toBe(-1);
    expect(new Identifier(2, 'A').compareTo(new Identifier(2, 'B'))).toBe(-1);
    expect(new Identifier(2, 'B').compareTo(new Identifier(2, 'B'))).toBe(0);
  });

  test('Character compares position paths lexicographically; shorter prefix first', () => {
    const ch = (path) =>
      new Character({
        position: path.map(([p, s]) => new Identifier(p, s)),
        value: 'x', siteId: 's', clock: 1, opId: Math.random().toString(),
      });
    expect(ch([[1, 'A']]).comparePosition(ch([[1, 'A'], [5, 'A']]))).toBe(-1);
    expect(ch([[2, 'A']]).comparePosition(ch([[1, 'A']]))).toBe(1);
  });
});

describe('MergeEngine.generatePositionBetween', () => {
  test('always yields a position strictly between its bounds (1000 nested allocs)', () => {
    const m = new MergeEngine({ rng: mulberry32(42) });
    let prev = [];
    let next = [];
    for (let i = 0; i < 1000; i++) {
      const p = m.generatePositionBetween(prev, next, `S${i % 5}`);
      expect(m.comparePath(prev, p)).toBe(-1);
      if (next.length) expect(m.comparePath(p, next)).toBe(-1);
      // Alternate the side we keep, to stress both ends of the space.
      if (i % 2 === 0) next = p;
      else prev = p;
    }
  });

  test('throws if asked to insert between equal/inverted bounds', () => {
    const m = new MergeEngine();
    const pos = m.generatePositionBetween([], [], 'A');
    expect(() => m.generatePositionBetween(pos, pos, 'A')).toThrow();
  });
});

describe('OperationValidator', () => {
  test('rejects malformed ops', () => {
    expect(OperationValidator.inspect(null).valid).toBe(false);
    expect(OperationValidator.inspect({ type: 'nope', opId: 'x', siteId: 's', clock: 1 }).valid).toBe(false);
    expect(OperationValidator.inspect({ type: 'delete', opId: 'x', siteId: 's', clock: 1 }).valid).toBe(false); // no target
  });

  test('accepts a well-formed insert', () => {
    const op = {
      type: 'insert', opId: 'o1', siteId: 's', clock: 1,
      char: { opId: 'o1', value: 'H', siteId: 's', clock: 1, position: [{ pos: 3, siteId: 's' }] },
    };
    expect(OperationValidator.inspect(op).valid).toBe(true);
  });
});

describe('Merge properties', () => {
  test('concurrent insert at the same spot converges deterministically', () => {
    const A = new CRDTDocument('A');
    const B = new CRDTDocument('B');
    const seed = 'XY'.split('').map((ch, i) => A.localInsert(i, ch));
    seed.forEach((op) => B.applyRemote(op));

    const opA = A.localInsert(1, 'a');
    const opB = B.localInsert(1, 'b');
    B.applyRemote(opA);
    A.applyRemote(opB);

    expect(A.getText()).toBe(B.getText());
  });

  test('duplicate replay is idempotent', () => {
    const A = new CRDTDocument('A');
    const ops = 'ABC'.split('').map((ch, i) => A.localInsert(i, ch));
    const B = new CRDTDocument('B');
    ops.forEach((op) => B.applyRemote(op));
    ops.forEach((op) => B.applyRemote(op)); // replay
    expect(B.getText()).toBe('ABC');
  });

  test('a delete delivered before its insert still converges', () => {
    const A = new CRDTDocument('A');
    const ins = A.localInsert(0, 'Z');
    const del = A.localDelete(0);
    expect(A.getText()).toBe('');

    const B = new CRDTDocument('B');
    B.applyRemote(del); // out of order: delete first
    B.applyRemote(ins);
    expect(B.getText()).toBe('');
  });
});

/**
 * THE CONVERGENCE TEST (the distributed-systems proof).
 *
 * 5 simulated clients edit concurrently. Every operation is delivered to every
 * client in a RANDOM order. After all operations are delivered, every client
 * MUST hold the exact same document. Repeated across many seeds.
 */
describe('Eventual consistency — 5 clients, random delivery order', () => {
  function runScenario(seed) {
    const rng = mulberry32(seed);
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const replicas = ids.map((id) => new CRDTDocument(`site-${id}`));
    const allOps = [];

    // Deliver a batch of ops to EVERY replica, each in its own shuffled order.
    const deliver = (ops) => {
      for (const r of replicas) for (const op of shuffle(ops, rng)) r.applyRemote(op);
    };

    // --- Phase 1: every client concurrently inserts its own letters. ---------
    const phase1 = [];
    const words = ['HELLO', 'WORLD', 'CRDT', 'SYNC', 'EDIT'];
    replicas.forEach((r, i) => {
      words[i].split('').forEach((ch, k) => phase1.push(r.localInsert(k, ch)));
    });
    allOps.push(...phase1);
    deliver(phase1); // now all replicas hold the same merged text

    const convergedAfterP1 = replicas[0].getText();
    for (const r of replicas) expect(r.getText()).toBe(convergedAfterP1);

    // --- Phase 2: concurrent deletes + inserts from the converged state. ------
    const phase2 = [];
    replicas.forEach((r) => {
      const len = r.getText().length;
      // delete two pseudo-random visible characters
      for (let d = 0; d < 2 && r.getText().length > 0; d++) {
        const idx = Math.floor(rng() * r.getText().length);
        const op = r.localDelete(idx);
        if (op) phase2.push(op);
      }
      // insert two characters at pseudo-random spots
      for (let ins = 0; ins < 2; ins++) {
        const idx = Math.floor(rng() * (r.getText().length + 1));
        phase2.push(r.localInsert(idx, '*'));
      }
    });
    allOps.push(...phase2);
    deliver(phase2);

    // --- Assert: all five replicas are byte-for-byte identical. --------------
    const finalText = replicas[0].getText();
    for (const r of replicas) expect(r.getText()).toBe(finalText);

    // And a FRESH replica that replays every op in a totally different random
    // order lands on the same text (delivery-order independence).
    const fresh = new CRDTDocument('site-fresh');
    for (const op of shuffle(allOps, mulberry32(seed + 999))) fresh.applyRemote(op);
    expect(fresh.getText()).toBe(finalText);

    return finalText;
  }

  test('converges across 25 random seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      expect(() => runScenario(seed)).not.toThrow();
    }
  });

  test('faithful spec scenario (A,B,C edit; delivered in random order)', () => {
    const rng = mulberry32(7);
    const A = new CRDTDocument('A');
    const B = new CRDTDocument('B');
    const C = new CRDTDocument('C');
    const ops = [];
    // A: insert H, E, L
    ['H', 'E', 'L'].forEach((ch, i) => ops.push(A.localInsert(i, ch)));
    // B: insert O
    ops.push(B.localInsert(0, 'O'));
    // C: insert !
    ops.push(C.localInsert(0, '!'));

    for (const r of [A, B, C]) for (const op of shuffle(ops, rng)) r.applyRemote(op);

    // Now B deletes the 'E' it can finally see, concurrently with C inserting '?'.
    const eIndex = B.getText().indexOf('E');
    const delE = B.localDelete(eIndex);
    const insQ = C.localInsert(C.getText().length, '?');
    for (const r of [A, B, C]) for (const op of shuffle([delE, insQ], rng)) r.applyRemote(op);

    expect(A.getText()).toBe(B.getText());
    expect(B.getText()).toBe(C.getText());
    expect(A.getText()).not.toContain('E'); // the delete propagated everywhere
  });
});
