/**
 * OperationValidator.js
 * -----------------------------------------------------------------------------
 * A guard that checks the SHAPE of an operation before the merge trusts it.
 *
 * WHY IT EXISTS
 *   Operations arrive from the network (other clients) and from the database
 *   (replay after reconnect). Either source can hand us malformed, truncated, or
 *   hostile data. The merge algorithm assumes well-formed input; this validator
 *   is the single choke point that makes that assumption safe.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Prevents a corrupt op from poisoning the document (e.g. a delete with no
 *     target, or an insert whose position path isn't an array of {pos, siteId}).
 *   - Gives a clear, typed error we can log and reject at the socket boundary
 *     instead of crashing deep inside the merge.
 *
 * HOW IT WORKS
 *   `inspect(op)` returns { valid, error } without throwing — handy for soft
 *   paths like socket handlers that want to reply with an error event.
 *   `validate(op)` throws on the first problem — handy inside CRDTDocument where
 *   an invalid op is a programmer error that should stop the line.
 *
 * HOW IT CONNECTS
 *   CRDTDocument.applyRemote() calls validate() first. Later, the Socket layer
 *   will call inspect() to reject bad client payloads before they ever reach the
 *   document, and to keep the per-document operation log clean.
 */

const VALID_TYPES = new Set(['insert', 'delete']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isValidPosition(position) {
  if (!Array.isArray(position) || position.length === 0) return false;
  return position.every(
    (d) =>
      d &&
      typeof d === 'object' &&
      typeof d.pos === 'number' &&
      Number.isFinite(d.pos) &&
      isNonEmptyString(d.siteId)
  );
}

class OperationValidator {
  /**
   * Non-throwing check.
   * @param {any} op
   * @returns {{ valid: boolean, error: string|null }}
   */
  static inspect(op) {
    if (!op || typeof op !== 'object') {
      return { valid: false, error: 'operation must be an object' };
    }
    if (!VALID_TYPES.has(op.type)) {
      return { valid: false, error: `unknown operation type: ${op.type}` };
    }
    if (!isNonEmptyString(op.opId)) {
      return { valid: false, error: 'opId is required' };
    }
    if (!isNonEmptyString(op.siteId)) {
      return { valid: false, error: 'siteId is required' };
    }
    if (typeof op.clock !== 'number' || !Number.isFinite(op.clock)) {
      return { valid: false, error: 'clock (logical timestamp) must be a number' };
    }

    if (op.type === 'insert') {
      const char = op.char;
      if (!char || typeof char !== 'object') {
        return { valid: false, error: 'insert op must carry a char object' };
      }
      if (typeof char.value !== 'string' || char.value.length !== 1) {
        return { valid: false, error: 'char.value must be a single character' };
      }
      if (!isNonEmptyString(char.opId)) {
        return { valid: false, error: 'char.opId is required' };
      }
      if (!isValidPosition(char.position)) {
        return { valid: false, error: 'char.position must be a non-empty array of {pos, siteId}' };
      }
    } else {
      // delete
      if (!isNonEmptyString(op.targetOpId)) {
        return { valid: false, error: 'delete op must reference a targetOpId' };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Throwing check — use where an invalid op is unrecoverable.
   * @param {any} op
   * @returns {true}
   * @throws {Error}
   */
  static validate(op) {
    const { valid, error } = OperationValidator.inspect(op);
    if (!valid) {
      throw new Error(`Invalid operation: ${error}`);
    }
    return true;
  }
}

module.exports = OperationValidator;
