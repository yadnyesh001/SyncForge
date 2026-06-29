/**
 * utils/diff.js
 * -----------------------------------------------------------------------------
 * Turn a textarea value change into a minimal (index, removed, inserted) edit.
 *
 * WHY IT EXISTS
 *   A <textarea> hands us the WHOLE new string on every change; the CRDT needs
 *   per-character insert/delete operations. By trimming the common prefix and
 *   suffix between the old and new strings, a single keystroke yields exactly one
 *   insert or delete, a selection-replacement yields a delete+insert, and a paste
 *   yields one delete (of the selection) + one multi-char insert.
 *
 * HOW IT CONNECTS
 *   useCollaborativeDocument applies the result: `removed` localDelete()s at
 *   `index`, then localInsert()s each char of `inserted` from `index`.
 */

/**
 * @param {string} oldStr
 * @param {string} newStr
 * @returns {{ index: number, removed: number, inserted: string }}
 */
export function computeDiff(oldStr, newStr) {
  if (oldStr === newStr) return { index: 0, removed: 0, inserted: '' };

  let prefix = 0;
  const min = Math.min(oldStr.length, newStr.length);
  while (prefix < min && oldStr[prefix] === newStr[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < min - prefix &&
    oldStr[oldStr.length - 1 - suffix] === newStr[newStr.length - 1 - suffix]
  ) {
    suffix++;
  }

  return {
    index: prefix,
    removed: oldStr.length - prefix - suffix,
    inserted: newStr.slice(prefix, newStr.length - suffix),
  };
}

/**
 * Shift a caret index to account for a remote edit applied before it.
 * @param {number} caret   current caret position
 * @param {number} index   where the edit happened
 * @param {number} removed how many chars were removed there
 * @param {number} insertedLen how many chars were inserted there
 */
export function adjustCaret(caret, index, removed, insertedLen) {
  if (index >= caret) return caret; // edit entirely after the caret
  if (index + removed <= caret) return caret - removed + insertedLen; // entirely before
  return index + insertedLen; // edit straddles the caret — clamp to its end
}
