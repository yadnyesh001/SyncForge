/**
 * components/editor/RemoteCursors.jsx
 * -----------------------------------------------------------------------------
 * Renders other users' carets INLINE inside the editor text.
 *
 * HOW IT WORKS
 *   A transparent "mirror" layer is positioned exactly over the <textarea> with
 *   identical font, padding, line-height, and wrapping. We interleave the text
 *   with zero-width caret markers at each collaborator's cursor index, so they
 *   reflow to the right spot automatically — no pixel math, no scroll syncing
 *   (the editor's textarea auto-grows, so it never scrolls internally).
 *
 *   `surfaceClass` MUST match the textarea's font/padding/leading classes so the
 *   two layers wrap text identically.
 */

function Caret({ color, name }) {
  return (
    <span className="relative" style={{ display: 'inline' }}>
      {/* the blinking caret line */}
      <span
        className="caret-blink absolute bottom-0 top-0 w-[2px] rounded-full"
        style={{ backgroundColor: color }}
      />
      {/* floating name label */}
      <span
        className="absolute -top-[18px] left-0 whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-semibold leading-none text-white shadow"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </span>
  );
}

export default function RemoteCursors({ text, cursors, surfaceClass }) {
  const points = Object.entries(cursors || {})
    .map(([userId, c]) => ({
      userId,
      name: c.name,
      color: c.color,
      pos: Math.max(0, Math.min(text.length, c.cursorPosition ?? 0)),
    }))
    .filter((p) => p.color)
    .sort((a, b) => a.pos - b.pos);

  if (points.length === 0) return null;

  const nodes = [];
  let last = 0;
  points.forEach((p) => {
    if (p.pos > last) nodes.push(text.slice(last, p.pos));
    nodes.push(<Caret key={p.userId} color={p.color} name={p.name} />);
    last = p.pos;
  });
  nodes.push(text.slice(last));

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-10 whitespace-pre-wrap break-words text-transparent ${surfaceClass}`}
    >
      {nodes}
    </div>
  );
}
