/**
 * context/ToastContext.jsx
 * -----------------------------------------------------------------------------
 * Lightweight toast notifications. `useToast()` returns { success, error, info }.
 * Toasts auto-dismiss and stack in the bottom-right corner.
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = { success: '✅', error: '⚠️', info: 'ℹ️' };
const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/70 dark:text-emerald-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/70 dark:text-red-200',
  info: 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message, ttl = 3000) => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => remove(id), ttl);
    },
    [remove]
  );

  const api = useRef({
    success: (m) => push('success', m),
    error: (m) => push('error', m, 4500),
    info: (m) => push('info', m),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lift animate-slide-up ${STYLES[t.type]}`}
          >
            <span>{ICONS[t.type]}</span>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="opacity-50 transition hover:opacity-100">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
