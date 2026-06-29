/** A minimal centered loading spinner. */
export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-10">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
