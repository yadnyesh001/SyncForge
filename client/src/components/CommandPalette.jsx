/**
 * components/CommandPalette.jsx
 * -----------------------------------------------------------------------------
 * A ⌘K / Ctrl+K command palette for quick navigation and actions.
 *
 * Only active for logged-in users. Supports type-to-filter and full keyboard
 * navigation (↑/↓ to move, Enter to run, Esc to close).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import documentsApi from '../services/documents.service';

export default function CommandPalette() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const commands = useMemo(
    () => [
      {
        id: 'new',
        label: 'New document',
        icon: '＋',
        hint: 'Create & open',
        run: async () => {
          try {
            const d = await documentsApi.create('Untitled');
            navigate(`/documents/${d._id}`);
          } catch {
            toast.error('Could not create document');
          }
        },
      },
      { id: 'dashboard', label: 'Go to dashboard', icon: '🏠', run: () => navigate('/dashboard') },
      {
        id: 'theme',
        label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        icon: theme === 'dark' ? '☀️' : '🌙',
        run: () => toggleTheme(),
      },
      {
        id: 'logout',
        label: 'Sign out',
        icon: '🚪',
        run: () => {
          logout();
          navigate('/login');
        },
      },
    ],
    [navigate, theme, toggleTheme, logout, toast]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
  }, [commands, query]);

  // Global hotkey to open (only when authenticated).
  useEffect(() => {
    if (!user) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, close]);

  // Keep the active index in range as the filter changes.
  useEffect(() => setActive(0), [query]);

  if (!user || !open) return null;

  const onListKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && filtered[active]) {
      e.preventDefault();
      const cmd = filtered[active];
      close();
      cmd.run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onClick={close}
    >
      <div
        className="card w-full max-w-lg overflow-hidden p-0 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
          <span className="text-slate-400">⌘</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            placeholder="Type a command…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-slate-700">esc</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-400">No matching commands</li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    close();
                    c.run();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    i === active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="flex-1 font-medium">{c.label}</span>
                  {c.hint && <span className="text-xs text-slate-400">{c.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
