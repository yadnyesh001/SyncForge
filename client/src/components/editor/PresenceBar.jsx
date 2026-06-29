/**
 * components/editor/PresenceBar.jsx — online users, typing, cursor positions.
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
      <ConnectionPill status={status} />

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

      <div className="flex -space-x-2">
        {users.map((u) => {
          const cursor = cursors[u.userId];
          return (
            <div key={u.userId} className="group relative">
              <div
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-soft ring-2 ring-transparent transition-transform hover:z-10 hover:scale-110 dark:border-slate-900"
                style={{ backgroundColor: u.color }}
                title={u.name}
              >
                {initials(u.name)}
              </div>
              <span className="pointer-events-none absolute left-1/2 top-10 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block">
                {u.name}
                {cursor ? ` · pos ${cursor.cursorPosition}` : ''}
              </span>
            </div>
          );
        })}
      </div>

      {users.length === 0 && (
        <span className="text-xs text-slate-400">You're the only one here</span>
      )}

      {typingNames.length > 0 && (
        <span className="flex items-center gap-1.5 text-xs italic text-slate-500 dark:text-slate-400">
          <span className="flex gap-0.5">
            <span className="typing-dot h-1 w-1 rounded-full bg-current" />
            <span className="typing-dot h-1 w-1 rounded-full bg-current" style={{ animationDelay: '0.2s' }} />
            <span className="typing-dot h-1 w-1 rounded-full bg-current" style={{ animationDelay: '0.4s' }} />
          </span>
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing
        </span>
      )}
    </div>
  );
}

function ConnectionPill({ status }) {
  const map = {
    online: { c: 'bg-emerald-500', t: 'Live', ring: 'bg-emerald-500/20' },
    offline: { c: 'bg-amber-500', t: 'Offline · edits queued', ring: 'bg-amber-500/20' },
    connecting: { c: 'bg-slate-400', t: 'Connecting…', ring: 'bg-slate-400/20' },
  };
  const s = map[status] || map.connecting;
  return (
    <span className="flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <span className="relative flex h-2 w-2">
        {status === 'online' && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.ring}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.c}`} />
      </span>
      {s.t}
    </span>
  );
}
