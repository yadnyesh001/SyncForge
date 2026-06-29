/**
 * utils/operationMapper.js
 * -----------------------------------------------------------------------------
 * Translates between the CRDT engine's operation objects and Operation rows.
 *
 * WHY IT EXISTS
 *   The CRDT engine speaks in plain op objects ({ type, opId, char, ... }); the
 *   database speaks in Operation documents ({ operationType, operationId, ... }).
 *   Both the REST layer (revert) and the socket layer (live edits, replay) need
 *   to convert between them, so the mapping lives in exactly one place.
 *
 * WHAT PROBLEM IT SOLVES
 *   Prevents the field-naming drift that would silently break replay if two
 *   places mapped these shapes slightly differently.
 *
 * HOW IT CONNECTS
 *   document.service uses crdtOpToRow when persisting and rowToCrdtOp when
 *   replaying the log; the socket layer (Module 7) reuses both.
 */

/**
 * CRDT op object -> partial Operation row (documentId/userId/version added by caller).
 * @param {Object} op - from CRDTDocument.localInsert/localDelete/applyRemote.
 */
function crdtOpToRow(op) {
  const row = {
    operationId: op.opId,
    siteId: op.siteId,
    operationType: op.type,
    logicalClock: op.clock,
  };
  if (op.type === 'insert') {
    row.value = op.char.value;
    row.position = op.char.position; // [{ pos, siteId }]
  } else {
    row.targetOpId = op.targetOpId;
  }
  return row;
}

/**
 * Operation row (Mongoose doc or plain) -> CRDT op object the engine accepts.
 * @param {Object} row
 */
function rowToCrdtOp(row) {
  const op = {
    type: row.operationType,
    opId: row.operationId,
    siteId: row.siteId,
    clock: row.logicalClock,
  };
  if (row.operationType === 'insert') {
    op.char = {
      // For an insert op, the character's opId IS the operation's id.
      opId: row.operationId,
      value: row.value,
      siteId: row.siteId,
      clock: row.logicalClock,
      position: (row.position || []).map((d) => ({ pos: d.pos, siteId: d.siteId })),
      deleted: false,
    };
  } else {
    op.targetOpId = row.targetOpId;
  }
  return op;
}

module.exports = { crdtOpToRow, rowToCrdtOp };
