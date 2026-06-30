/**
 * context/ConfirmContext.jsx
 * -----------------------------------------------------------------------------
 * A promise-based confirm dialog that replaces the native window.confirm().
 * Usage:  const confirm = useConfirm();
 *         if (await confirm({ title, message, danger: true })) { ... }
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmText, danger }
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    setState({
      title: opts.title || 'Are you sure?',
      message: opts.message || '',
      confirmText: opts.confirmText || 'Confirm',
      danger: !!opts.danger,
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    setState(null);
    if (resolver.current) resolver.current(result);
    resolver.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => close(false)}
        >
          <div className="card w-full max-w-sm p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{state.title}</h2>
            {state.message && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{state.message}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => close(false)} className="btn-ghost px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => close(true)}
                className={
                  state.danger
                    ? 'inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 active:scale-[0.98]'
                    : 'btn-primary px-4 py-2 text-sm'
                }
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
