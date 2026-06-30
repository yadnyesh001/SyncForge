/**
 * components/editor/ExportMenu.jsx — a small dropdown to export the document.
 */

import { useEffect, useRef, useState } from 'react';
import { exportMarkdown, exportPdf } from '../../utils/exportDocument';
import { useToast } from '../../context/ToastContext';

export default function ExportMenu({ title, text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const doMarkdown = () => {
    exportMarkdown(title, text);
    setOpen(false);
    toast.success('Markdown downloaded');
  };
  const doPdf = () => {
    exportPdf(title, text);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-3 py-1.5 text-sm">
        <span className="sm:hidden">⬇</span>
        <span className="hidden sm:inline">⬇ Export</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lift animate-scale-in dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={doMarkdown}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            📄 Markdown (.md)
          </button>
          <button
            onClick={doPdf}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            🖨️ PDF (print)
          </button>
        </div>
      )}
    </div>
  );
}
