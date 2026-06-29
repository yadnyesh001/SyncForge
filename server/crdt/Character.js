/**
 * Character.js
 * -----------------------------------------------------------------------------
 * A single character cell in the CRDT sequence.
 *
 * WHY IT EXISTS
 *   The document is not stored as a plain string. It is stored as an ordered set
 *   of Character objects, each carrying enough metadata to be ordered, merged,
 *   and de-duplicated independently on every replica. This class is that cell.
 *
 * WHAT PROBLEM IT SOLVES
 *   It bundles the four things every replica needs to converge:
 *     1. value    - the visible glyph (e.g. "H").
 *     2. position - the immutable position PATH (array<Identifier>) that fixes
 *                   where this character sits relative to all others.
 *     3. ordering metadata - siteId + clock (Lamport) for deterministic
 *                   tie-breaking of concurrent edits.
 *     4. opId     - a globally-unique operation id, so the same insert applied
 *                   twice (e.g. after a reconnect replay) is recognised and
 *                   ignored. This is what makes the merge IDEMPOTENT.
 *
 * HOW IT WORKS
 *   - comparePosition() lexicographically compares two characters' position
 *     paths digit-by-digit. If one path is a prefix of the other, the shorter
 *     path sorts first (standard dense-identifier rule). This is the single
 *     source of truth for "what order do characters appear in."
 *   - Deletion is a TOMBSTONE (deleted = true) rather than a physical removal.
 *     Tombstones keep the merge commutative (a late-arriving insert next to a
 *     deleted char still has a stable neighbour) and make undo / history trivial.
 *
 * HOW IT CONNECTS
 *   CRDTDocument holds a sorted array of Characters. MergeEngine creates them
 *   (minting positions) and applies remote ones. The Operation Mongoose model
 *   persists their serialized form so history and offline replay work.
 */

const Identifier = require('./Identifier');

class Character {
  /**
   * @param {Object}   params
   * @param {Identifier[]} params.position - the position path (>= 1 digit).
   * @param {string}   params.value        - the character glyph.
   * @param {string}   params.siteId       - site that created it.
   * @param {number}   params.clock        - Lamport stamp at creation.
   * @param {string}   params.opId         - globally-unique operation id.
   * @param {boolean}  [params.deleted=false] - tombstone flag.
   */
  constructor({ position, value, siteId, clock, opId, deleted = false }) {
    this.position = position; // Identifier[]
    this.value = value;
    this.siteId = siteId;
    this.clock = clock;
    this.opId = opId;
    this.deleted = deleted;
  }

  /**
   * Compare THIS character's position path against another's.
   * Lexicographic over digits; shorter prefix wins on a tie.
   * @param {Character} other
   * @returns {-1 | 0 | 1}
   */
  comparePosition(other) {
    const a = this.position;
    const b = other.position;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      const cmp = a[i].compareTo(b[i]);
      if (cmp !== 0) return cmp;
    }
    // All shared digits equal -> the shorter path comes first.
    if (a.length < b.length) return -1;
    if (a.length > b.length) return 1;
    return 0;
  }

  /** Mark this cell deleted (tombstone) instead of removing it. */
  markDeleted() {
    this.deleted = true;
  }

  /** Serialize for transport / persistence. */
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

  /** Rebuild a Character (and its Identifier path) from serialized form. */
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

module.exports = Character;
