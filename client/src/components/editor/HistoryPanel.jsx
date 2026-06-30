/**
 * components/editor/HistoryPanel.jsx — operation history / version timeline + revert.
 */

import { useEffect, useState } from 'react';
import documentsApi from '../../services/documents.service';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function HistoryPanel({ documentId, currentVersion, onClose }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [ops, setOps] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    documentsApi
      .history(documentId, { order: 'desc', limit: 300 })
      .then(setOps)
      .catch(() => setOps([]));

  useEffect(() => {
    load();
  }, [documentId, currentVersion]);

  const revert = async (version) => {
    const ok = await confirm({
      title: `Restore version ${version}?`,
      message: 'This appends new operations to bring the document back to that state. History is preserved.',
      confirmText: 'Restore',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await documentsApi.revert(documentId, version);
      await load();
      toast.success(`Restored to version ${version}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to restore');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 flex h-full w-80 max-w-[85vw] flex-col border-l border-slate-200 bg-white animate-slide-up dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:max-w-none">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">History</h2>
          <p className="text-xs text-slate-400">{ops ? `${ops.length} operations` : '…'}</p>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {ops === null ? (
          <p className="p-4 text-sm text-slate-400">Loading…</p>
        ) : ops.length === 0 ? (
          <div className="flex flex-col items-center p-10 text-center">
            <div className="mb-2 text-2xl">🕘</div>
            <p className="text-sm text-slate-400">No operations yet.</p>
          </div>
        ) : (
          <ul className="p-2">
            {ops.map((op) => (
              <li
                key={op.operationId}
                className="group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                      op.operationType === 'insert'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                    }`}
                  >
                    {op.operationType === 'insert' ? '+' : '−'}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-700 dark:text-slate-200">
                      v{op.version}
                      {op.operationType === 'insert' && op.value ? ` · "${op.value}"` : ' · delete'}
                    </div>
                    <div className="truncate text-xs text-slate-400">{op.userId?.name || 'unknown'}</div>
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => revert(op.version)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 opacity-0 transition group-hover:opacity-100 hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                  title={`Revert to v${op.version}`}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </aside>
    </>
  );
}
