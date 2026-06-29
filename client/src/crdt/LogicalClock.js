/**
 * crdt/LogicalClock.js  (browser ESM port — identical logic to server/crdt)
 * A Lamport logical clock. See server/crdt/LogicalClock.js for the full rationale.
 */
export default class LogicalClock {
  constructor(initial = 0) {
    this.counter = initial;
  }
  tick() {
    this.counter += 1;
    return this.counter;
  }
  update(receivedCounter) {
    this.counter = Math.max(this.counter, receivedCounter) + 1;
    return this.counter;
  }
  get value() {
    return this.counter;
  }
  toJSON() {
    return this.counter;
  }
  static fromJSON(value) {
    return new LogicalClock(typeof value === 'number' ? value : 0);
  }
}
