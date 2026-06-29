/**
 * components/editor/PresenceBar.jsx
 * -----------------------------------------------------------------------------
 * Online users (avatars), a typing indicator, and each remote collaborator's
 * caret position — the visible half of the presence channel.
 */

function initials(name = '?') {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function PresenceBar({ users, cursors, typing, status }) {
  const typingNames = Object.values(typing);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ConnectionDot status={status} />

      <div className="flex -space-x-2">
        {users.map((u) => {
          const cursor = cursors[u.userId];
          return (
            <div key={u.userId} className="group relative">
              <div
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-xs font-semibold text-white shadow dark:border-slate-900"
                style={{ backgroundColor: u.color }}
                title={u.name}
              >
                {initials(u.name)}
              </div>
              <span className="pointer-events-none absolute left-1/2 top-9 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-[10px] text-white group-hover:block">
                {u.name}
                {cursor ? ` · @${cursor.cursorPosition}` : ''}
              </span>
            </div>
          );
        })}
      </div>

      {users.length === 0 && (
        <span className="text-xs text-slate-400">No one else here</span>
      )}

      {typingNames.length > 0 && (
        <span className="text-xs italic text-slate-500 dark:text-slate-400">
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing
          <span className="caret-blink">…</span>
        </span>
      )}
    </div>
  );
}

function ConnectionDot({ status }) {
  const map = {
    online: { c: 'bg-emerald-500', t: 'Live' },
    offline: { c: 'bg-amber-500', t: 'Offline — edits queued' },
    connecting: { c: 'bg-slate-400', t: 'Connecting…' },
  };
  const s = map[status] || map.connecting;
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span className={`h-2 w-2 rounded-full ${s.c}`} />
      {s.t}
    </span>
  );
}
