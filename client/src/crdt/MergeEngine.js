/**
 * crdt/MergeEngine.js  (browser ESM port — identical logic to server/crdt)
 * Path comparison + dense position allocation. See server for full rationale.
 */
import Identifier from './Identifier.js';

const LOWER_BOUND = 0;
const BASE = 65536;
const BOUNDARY = 10;
const MAX_DEPTH = 1000;

export default class MergeEngine {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
  }

  comparePath(a, b) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const cmp = a[i].compareTo(b[i]);
      if (cmp !== 0) return cmp;
    }
    if (a.length < b.length) return -1;
    if (a.length > b.length) return 1;
    return 0;
  }

  _allocateInGap(pPos, gap) {
    const step = Math.min(BOUNDARY, gap);
    return pPos + 1 + Math.floor(this.rng() * step);
  }

  generatePositionBetween(prev, next, siteId) {
    if (next.length && this.comparePath(prev, next) >= 0) {
      throw new Error('generatePositionBetween requires prev < next');
    }

    const newPath = [];
    let upper = next;
    let depth = 0;

    while (depth < MAX_DEPTH) {
      const pHas = depth < prev.length;
      const qHas = depth < upper.length;
      const pPos = pHas ? prev[depth].pos : LOWER_BOUND;
      const qPos = qHas ? upper[depth].pos : BASE;

      if (pPos === qPos) {
        const pSite = pHas ? prev[depth].siteId : siteId;
        const sameSite = pHas && qHas && prev[depth].siteId === upper[depth].siteId;
        newPath.push(new Identifier(pPos, pSite));
        if (!sameSite) upper = [];
        depth++;
        continue;
      }

      const gap = qPos - pPos - 1;
      if (gap >= 1) {
        newPath.push(new Identifier(this._allocateInGap(pPos, gap), siteId));
        return newPath;
      }

      const pSite = pHas ? prev[depth].siteId : siteId;
      newPath.push(new Identifier(pPos, pSite));
      upper = [];
      depth++;
    }

    throw new Error('MergeEngine.generatePositionBetween exceeded MAX_DEPTH');
  }
}
