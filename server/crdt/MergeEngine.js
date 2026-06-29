/**
 * MergeEngine.js
 * -----------------------------------------------------------------------------
 * The ordering + position-allocation core of the CRDT.
 *
 * WHY IT EXISTS
 *   Two things must be true for the document to converge:
 *     (a) every replica orders the same set of characters identically, and
 *     (b) you can always mint a brand-new position STRICTLY BETWEEN any two
 *         existing positions (so "insert between H and I" never runs out of room).
 *   This file owns both: path comparison and dense position generation. It is
 *   pure, stateless math — it touches no document, network, or database.
 *
 * WHAT PROBLEM IT SOLVES
 *   A naive scheme runs out of integers ("insert between 1 and 2"). We solve it
 *   the Logoot/LSEQ way: a position is a PATH (array of digits). When there is no
 *   integer gap at the current depth, we descend one level deeper and allocate a
 *   finer digit — an effectively infinite, densely-divisible coordinate space.
 *
 * HOW IT WORKS  (generatePositionBetween)
 *   Walk the two boundary paths digit by digit:
 *     - Identical digit on both sides  -> copy it and descend (bounds still apply).
 *     - Integer gap > 0 between digits -> allocate a digit inside the gap. Done.
 *     - Adjacent digits / same-pos-different-site -> copy the LOWER digit, descend,
 *       and drop the upper bound (we're now guaranteed below it). Allocate deeper.
 *   The freshly allocated digit always carries OUR siteId, so even concurrent
 *   inserts that pick the same integer stay deterministically ordered.
 *
 * HOW IT CONNECTS
 *   CRDTDocument calls generatePositionBetween() for every local insert, and uses
 *   comparePath()/insertSorted() (via Character.comparePosition) to keep its
 *   sequence ordered as remote characters stream in.
 */

const Identifier = require('./Identifier');

// Virtual bounds for the integer coordinate at each depth. 0 and BASE are
// reserved as "-infinity" / "+infinity" sentinels; real digits live in (0, BASE).
const LOWER_BOUND = 0;
const BASE = 65536;
// Cap how far into a gap we jump, so position paths stay short instead of one
// edit consuming the whole interval. A classic LSEQ "boundary".
const BOUNDARY = 10;
// Safety valve: a correct call can never descend this deep; if it does, throw
// instead of looping forever (guards against being handed prev >= next).
const MAX_DEPTH = 1000;

class MergeEngine {
  /**
   * @param {Object} [opts]
   * @param {() => number} [opts.rng=Math.random] - injectable RNG so tests can be
   *        made deterministic. Must return a float in [0, 1).
   */
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
  }

  /**
   * Total order over two position paths (arrays of Identifier).
   * Lexicographic by digit; shorter prefix sorts first.
   * @returns {-1 | 0 | 1}
   */
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

  /**
   * Pick an integer strictly inside a gap, biased to the low end and capped by
   * BOUNDARY so paths stay compact.
   * @param {number} pPos - lower digit value (exclusive).
   * @param {number} gap  - count of integers strictly between the two digits.
   */
  _allocateInGap(pPos, gap) {
    const step = Math.min(BOUNDARY, gap);
    // floor(rng * step) is in [0, step-1]; +1 makes it [1, step] -> strictly > pPos.
    return pPos + 1 + Math.floor(this.rng() * step);
  }

  /**
   * Generate a position path strictly between `prev` and `next`.
   * Empty `prev` means "start of document"; empty `next` means "end of document".
   *
   * @param {Identifier[]} prev   - lower-bound path (may be []).
   * @param {Identifier[]} next   - upper-bound path (may be []).
   * @param {string}       siteId - id of the site creating the new position.
   * @returns {Identifier[]} a new path P with prev < P < next.
   */
  generatePositionBetween(prev, next, siteId) {
    // Precondition: prev must be strictly less than next. An empty array is a
    // sentinel — empty `prev` = start-of-doc (-inf), empty `next` = end (+inf) —
    // so we only compare when `next` is a real (non-empty) position.
    if (next.length && this.comparePath(prev, next) >= 0) {
      throw new Error('generatePositionBetween requires prev < next');
    }

    const newPath = [];
    let upper = next; // once we commit to being below `next`, we drop this to [].
    let depth = 0;

    while (depth < MAX_DEPTH) {
      const pHas = depth < prev.length;
      const qHas = depth < upper.length;
      const pPos = pHas ? prev[depth].pos : LOWER_BOUND;
      const qPos = qHas ? upper[depth].pos : BASE;

      if (pPos === qPos) {
        // Same integer at this depth. If the digits are fully identical we are
        // still in the shared prefix -> copy and descend, keeping both bounds.
        const pSite = pHas ? prev[depth].siteId : siteId;
        const sameSite = pHas && qHas && prev[depth].siteId === upper[depth].siteId;

        newPath.push(new Identifier(pPos, pSite));
        if (!sameSite) {
          // Same pos but different site (the first point of divergence): there is
          // no integer room here. We've copied the LOWER digit, so we are now
          // strictly below `next` via siteId — drop the upper bound and go deeper.
          upper = [];
        }
        depth++;
        continue;
      }

      const gap = qPos - pPos - 1;
      if (gap >= 1) {
        // Integer room exists: allocate a digit inside it and we're done.
        newPath.push(new Identifier(this._allocateInGap(pPos, gap), siteId));
        return newPath;
      }

      // Adjacent integers (qPos === pPos + 1): copy the lower digit, drop the
      // upper bound, and descend to allocate a finer digit underneath.
      const pSite = pHas ? prev[depth].siteId : siteId;
      newPath.push(new Identifier(pPos, pSite));
      upper = [];
      depth++;
    }

    throw new Error(
      'MergeEngine.generatePositionBetween exceeded MAX_DEPTH — ' +
        'prev must be strictly less than next.'
    );
  }
}

module.exports = MergeEngine;
