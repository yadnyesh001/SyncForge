/** A minimal centered loading spinner. */
export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-10 animate-fade-in">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <div className="relative h-9 w-9">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-500" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
