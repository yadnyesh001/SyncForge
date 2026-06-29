/**
 * Identifier.js
 * -----------------------------------------------------------------------------
 * One "digit" of a character's position path: a (pos, siteId) pair.
 *
 * WHY IT EXISTS
 *   A CRDT character can't be located by its array index, because indices shift
 *   every time anyone inserts or deletes. Instead each character carries a fixed
 *   POSITION PATH — an ordered list of these Identifier digits — that behaves
 *   like a coordinate in a densely-divisible space (think Dewey-decimal: 1, 1.5,
 *   1.51, 2 ...). This file is a single coordinate component of that path.
 *
 * WHAT PROBLEM IT SOLVES
 *   It provides a TOTAL ORDER over digits. Two replicas, given the same two
 *   digits, must independently agree which one is "smaller." We achieve that by
 *   comparing the integer `pos` first, and using `siteId` purely as a
 *   deterministic tie-breaker when two sites pick the same `pos`. Without the
 *   siteId tie-break, two users inserting at the same place could order the same
 *   character differently on different machines — that is exactly the divergence
 *   a CRDT must prevent.
 *
 * HOW IT WORKS
 *   - `pos`    : an integer chosen from a bounded range at this tree depth.
 *   - `siteId` : the unique id of the replica/site that minted this digit.
 *   - `compareTo` returns -1 / 0 / 1, comparing pos then siteId.
 *
 * HOW IT CONNECTS
 *   Character.position is an array<Identifier>. The MergeEngine generates new
 *   paths between two neighbours by allocating `pos` values digit-by-digit, and
 *   compares whole paths by comparing these digits in sequence.
 */

class Identifier {
  /**
   * @param {number} pos    - integer coordinate at this depth of the path.
   * @param {string} siteId - id of the site that created this digit (tie-break).
   */
  constructor(pos, siteId) {
    this.pos = pos;
    this.siteId = siteId;
  }

  /**
   * Total-order comparison against another Identifier.
   * @param {Identifier} other
   * @returns {-1 | 0 | 1}
   */
  compareTo(other) {
    if (this.pos < other.pos) return -1;
    if (this.pos > other.pos) return 1;
    // pos is equal -> deterministic tie-break on siteId (lexicographic).
    if (this.siteId < other.siteId) return -1;
    if (this.siteId > other.siteId) return 1;
    return 0;
  }

  /** Compact serialization for transport / persistence. */
  toJSON() {
    return { pos: this.pos, siteId: this.siteId };
  }

  /** Rebuild an Identifier from its serialized form. */
  static fromJSON(obj) {
    return new Identifier(obj.pos, obj.siteId);
  }
}

module.exports = Identifier;
