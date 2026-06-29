/**
 * crdt/CRDTDocument.js  (browser ESM port — identical logic to server/crdt)
 *
 * The browser's local replica. localInsert/localDelete produce ops to emit over
 * the socket; applyRemote folds in ops from peers (and the reconnect backlog).
 * `crypto.randomUUID` is available in both Node and modern browsers, so opId
 * generation is isomorphic.
 */
import LogicalClock from './LogicalClock.js';
import Character from './Character.js';
import MergeEngine from './MergeEngine.js';

function uid() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  // Fallback for very old environments.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default class CRDTDocument {
  constructor(siteId, { merge, clock } = {}) {
    this.siteId = siteId;
    this.clock = clock || new LogicalClock();
    this.merge = merge || new MergeEngine();
    this.chars = [];
    this.byOpId = new Map();
    this.appliedOps = new Set();
    this.pendingDeletes = new Map();
  }

  getText() {
    let out = '';
    for (const c of this.chars) if (!c.deleted) out += c.value;
    return out;
  }

  _visible() {
    return this.chars.filter((c) => !c.deleted);
  }

  localInsert(index, value) {
    const visible = this._visible();
    const prev = index > 0 && visible[index - 1] ? visible[index - 1].position : [];
    const next = index < visible.length && visible[index] ? visible[index].position : [];
    const position = this.merge.generatePositionBetween(prev, next, this.siteId);
    const clock = this.clock.tick();
    const opId = uid();
    const ch = new Character({ position, value, siteId: this.siteId, clock, opId });
    this._insertChar(ch);
    this.appliedOps.add(opId);
    return { type: 'insert', opId, siteId: this.siteId, clock, char: ch.toJSON() };
  }

  localDelete(index) {
    const visible = this._visible();
    const target = visible[index];
    if (!target) return null;
    target.markDeleted();
    const clock = this.clock.tick();
    const opId = uid();
    this.appliedOps.add(opId);
    return {
      type: 'delete',
      opId,
      siteId: this.siteId,
      clock,
      targetOpId: target.opId,
      position: target.position.map((d) => d.toJSON()),
    };
  }

  applyRemote(op) {
    if (!op || (op.type !== 'insert' && op.type !== 'delete')) return { applied: false };
    if (this.appliedOps.has(op.opId)) return { applied: false, reason: 'duplicate' };
    this.clock.update(op.clock);

    if (op.type === 'insert') {
      if (!this.byOpId.has(op.char.opId)) {
        const ch = Character.fromJSON(op.char);
        this._insertChar(ch);
        if (this.pendingDeletes.has(ch.opId)) {
          ch.markDeleted();
          this.pendingDeletes.delete(ch.opId);
        }
      }
    } else {
      const target = this.byOpId.get(op.targetOpId);
      if (target) target.markDeleted();
      else this.pendingDeletes.set(op.targetOpId, op);
    }

    this.appliedOps.add(op.opId);
    return { applied: true };
  }

  _insertChar(ch) {
    const arr = this.chars;
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].comparePosition(ch) < 0) lo = mid + 1;
      else hi = mid;
    }
    arr.splice(lo, 0, ch);
    this.byOpId.set(ch.opId, ch);
  }

  toJSON() {
    return this.chars.map((c) => c.toJSON());
  }

  static fromCharacters(siteId, charsJson, deps) {
    const doc = new CRDTDocument(siteId, deps);
    let maxClock = 0;
    for (const cj of charsJson || []) {
      const ch = Character.fromJSON(cj);
      doc._insertChar(ch);
      doc.appliedOps.add(ch.opId);
      if (typeof ch.clock === 'number') maxClock = Math.max(maxClock, ch.clock);
    }
    doc.clock = LogicalClock.fromJSON(maxClock);
    return doc;
  }
}
