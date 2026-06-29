/**
 * components/editor/HistoryPanel.jsx
 * -----------------------------------------------------------------------------
 * The operation history / version timeline. Lists every persisted operation and
 * lets the user revert the document to an earlier version.
 *
 * Reverting hits POST /documents/:id/revert, which APPENDS new ops (history is
 * never rewritten). The live editor picks those up via the normal
 * document-updated broadcast, so everyone converges to the reverted text.
 */

import { useEffect, useState } from 'react';
import documentsApi from '../../services/documents.service';

export default function HistoryPanel({ documentId, currentVersion, onClose }) {
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
    if (!window.confirm(`Restore the document to version ${version}?`)) return;
    setBusy(true);
    try {
      await documentsApi.revert(documentId, version);
      // The live broadcast updates the editor; refresh the list too.
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex h-full w-80 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="font-medium text-slate-800 dark:text-slate-100">History</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {ops === null ? (
          <p className="p-4 text-sm text-slate-400">Loading…</p>
        ) : ops.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No operations yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {ops.map((op) => (
              <li key={op.operationId} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="min-w-0">
                  <span
                    className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      op.operationType === 'insert'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    v{op.version} {op.operationType === 'insert' ? `+'${op.value}'` : 'del'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{op.userId?.name || 'unknown'}</span>
                </div>
                <button
                  disabled={busy}
                  onClick={() => revert(op.version)}
                  className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  title={`Revert to v${op.version}`}
                >
                  restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
