/**
 * crdt/Character.js  (browser ESM port — identical logic to server/crdt)
 * A character cell: value + immutable position path + ordering/dedup metadata.
 */
import Identifier from './Identifier.js';

export default class Character {
  constructor({ position, value, siteId, clock, opId, deleted = false }) {
    this.position = position;
    this.value = value;
    this.siteId = siteId;
    this.clock = clock;
    this.opId = opId;
    this.deleted = deleted;
  }

  comparePosition(other) {
    const a = this.position;
    const b = other.position;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const cmp = a[i].compareTo(b[i]);
      if (cmp !== 0) return cmp;
    }
    if (a.length < b.length) return -1;
    if (a.length > b.length) return 1;
    return 0;
  }

  markDeleted() {
    this.deleted = true;
  }

  toJSON() {
    return {
      position: this.position.map((id) => id.toJSON()),
      value: this.value,
      siteId: this.siteId,
      clock: this.clock,
      opId: this.opId,
      deleted: this.deleted,
    };
  }

  static fromJSON(obj) {
    return new Character({
      position: obj.position.map((d) => Identifier.fromJSON(d)),
      value: obj.value,
      siteId: obj.siteId,
      clock: obj.clock,
      opId: obj.opId,
      deleted: obj.deleted || false,
    });
  }
}
