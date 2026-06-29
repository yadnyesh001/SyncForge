/**
 * crdt/Identifier.js  (browser ESM port — identical logic to server/crdt)
 * One (pos, siteId) digit of a position path. Total order: pos, then siteId.
 */
export default class Identifier {
  constructor(pos, siteId) {
    this.pos = pos;
    this.siteId = siteId;
  }
  compareTo(other) {
    if (this.pos < other.pos) return -1;
    if (this.pos > other.pos) return 1;
    if (this.siteId < other.siteId) return -1;
    if (this.siteId > other.siteId) return 1;
    return 0;
  }
  toJSON() {
    return { pos: this.pos, siteId: this.siteId };
  }
  static fromJSON(obj) {
    return new Identifier(obj.pos, obj.siteId);
  }
}
