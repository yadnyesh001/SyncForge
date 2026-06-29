/**
 * LogicalClock.js
 * -----------------------------------------------------------------------------
 * A Lamport logical clock.
 *
 * WHY IT EXISTS
 *   In a distributed system there is no reliable shared wall-clock. Two machines'
 *   `Date.now()` values drift, and even if they didn't, two events that happen in
 *   the "same" millisecond give us no way to order them. We still need to answer
 *   one question over and over: "did event A happen before event B?"
 *
 * WHAT PROBLEM IT SOLVES
 *   A Lamport clock gives every event a monotonically increasing integer stamp
 *   such that: if A causally happened-before B, then stamp(A) < stamp(B).
 *   That lets every replica order operations consistently and break ties
 *   deterministically, which is a precondition for eventual consistency.
 *
 * HOW IT WORKS  (two rules — that's the entire algorithm)
 *   1. Before you create a local event, increment your counter (`tick`).
 *   2. When you receive a remote event carrying counter R, set your counter to
 *      max(local, R) + 1 (`update`). This "pulls your clock forward" so your next
 *      event is guaranteed to stamp higher than anything you've already seen.
 *
 * HOW IT CONNECTS
 *   Every CRDT operation we generate (insert/delete) is stamped with the current
 *   clock value. The MergeEngine uses that stamp (together with siteId) as the
 *   tie-breaker when two operations are concurrent. The clock value is what the
 *   database stores in the Operation document's `logicalClock` field.
 */

class LogicalClock {
  /**
   * @param {number} [initial=0] - starting counter, used when rehydrating a
   *                               replica's clock from persisted state.
   */
  constructor(initial = 0) {
    this.counter = initial;
  }

  /**
   * Advance the clock for a NEW local event and return the fresh stamp.
   * Call this exactly once per locally-generated operation.
   * @returns {number}
   */
  tick() {
    this.counter += 1;
    return this.counter;
  }

  /**
   * Merge in the clock value carried by a REMOTE event, keeping our clock
   * strictly ahead of anything we've observed.
   * @param {number} receivedCounter - the logicalClock stamp on the remote op.
   * @returns {number} the updated local counter.
   */
  update(receivedCounter) {
    this.counter = Math.max(this.counter, receivedCounter) + 1;
    return this.counter;
  }

  /** Current value without advancing. */
  get value() {
    return this.counter;
  }

  /** Plain-number serialization for transport / persistence. */
  toJSON() {
    return this.counter;
  }

  /** Rebuild a clock from a persisted value. */
  static fromJSON(value) {
    return new LogicalClock(typeof value === 'number' ? value : 0);
  }
}

module.exports = LogicalClock;
