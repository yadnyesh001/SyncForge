/**
 * components/Navbar.jsx
 * -----------------------------------------------------------------------------
 * Top bar: brand, dark-mode toggle, current user, logout.
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

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-sm text-white">S</span>
          SyncForge
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Toggle dark mode"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>

          {user && (
            <>
              <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
