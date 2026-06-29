/**
 * utils/KeyedMutex.js
 * -----------------------------------------------------------------------------
 * A lightweight per-key async lock (mutex), in-process.
 *
 * WHY IT EXISTS
 *   Applying an operation is a read-modify-write: load the document, fold the op
 *   into its CRDT, persist, save the new snapshot/version. If two edits to the
 *   SAME document interleave at their `await` points, they can both read version
 *   N and both write version N+1 — a classic lost update, and a failed apply that
 *   never gets broadcast. Serializing per document removes that race.
 *
 * WHAT PROBLEM IT SOLVES
 *   Critical sections keyed by documentId run one-at-a-time, while DIFFERENT
 *   documents still run fully in parallel (the lock is per key, not global).
 *
 * SCOPE / LIMITATION
 *   This guards a SINGLE server instance. Across instances you'd need a
 *   distributed lock (e.g. Redis). The unique { documentId, operationId } index
 *   is the cross-instance backstop that keeps even an unlucky interleaving from
 *   double-persisting an op (Module 8 discusses this).
 *
 * HOW IT WORKS
 *   Per key we keep a promise "tail". Acquiring chains a new promise after the
 *   current tail; the caller waits for the previous holder to release. The map
 *   entry is cleaned up when the last waiter releases, so it doesn't grow without
 *   bound.
 */

class KeyedMutex {
  constructor() {
    this._tails = new Map(); // key -> { promise, waiters }
  }

  /**
   * Run `fn` exclusively for `key`. Returns whatever `fn` resolves to.
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async run(key, fn) {
    const entry = this._tails.get(key) || { promise: Promise.resolve(), waiters: 0 };
    entry.waiters += 1;
    this._tails.set(key, entry);

    const previous = entry.promise;
    let release;
    entry.promise = new Promise((resolve) => {
      release = resolve;
    });

    await previous; // wait our turn
    try {
      return await fn();
    } finally {
      release();
      entry.waiters -= 1;
      // If nobody else is queued behind us, drop the map entry.
      if (entry.waiters === 0 && this._tails.get(key) === entry) {
        this._tails.delete(key);
      }
    }
  }
}

module.exports = KeyedMutex;
