/**
 * components/Navbar.jsx — top bar: brand, dark-mode toggle, user, logout.
 */

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-sm font-bold text-white shadow-soft transition-transform group-hover:scale-105">
            S
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Sync<span className="text-brand-600 dark:text-brand-400">Forge</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user && (
            <>
              <div className="ml-1 flex items-center gap-2 rounded-xl py-1 pl-1 pr-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-xs font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden text-sm font-medium text-slate-600 dark:text-slate-300 sm:inline">
                  {user.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
