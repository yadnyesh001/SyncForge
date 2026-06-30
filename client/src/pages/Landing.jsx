/**
 * pages/Landing.jsx — public marketing/hero page for logged-out visitors.
 * Logged-in users get a "Go to app" CTA instead of "Get started".
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const FEATURES = [
  { icon: '⚡', title: 'Real-time sync', text: 'Edits appear instantly for everyone, with sub-second latency.' },
  { icon: '🧠', title: 'Hand-rolled CRDT', text: 'A conflict-free merge engine built from scratch — no Yjs, no Automerge.' },
  { icon: '🌐', title: 'Offline-ready', text: 'Keep typing offline; your edits sync automatically on reconnect.' },
  { icon: '👥', title: 'Live presence', text: 'See who’s online, their cursors, and who’s typing right now.' },
  { icon: '🕘', title: 'Version history', text: 'Every keystroke is logged. Restore any previous version anytime.' },
  { icon: '🔒', title: 'Secure by default', text: 'JWT auth on both REST and WebSocket connections.' },
];

export default function Landing() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Nav */}
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-sm font-bold text-white shadow-soft">S</span>
          <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Sync<span className="text-brand-600 dark:text-brand-400">Forge</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user ? (
            <Link to="/dashboard" className="btn-primary px-4 py-2 text-sm">Go to app →</Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost px-4 py-2 text-sm">Sign in</Link>
              <Link to="/register" className="btn-primary px-4 py-2 text-sm">Get started</Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-soft dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Built from first principles — no CRDT libraries
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-6xl animate-slide-up">
            Write together,
            <br />
            <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
              in perfect sync.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 dark:text-slate-400 animate-slide-up">
            A real-time collaborative editor powered by a hand-built CRDT engine. Multiple people, one
            document, zero conflicts — even offline.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 animate-slide-up">
            <Link to={user ? '/dashboard' : '/register'} className="btn-primary px-6 py-3 text-base">
              {user ? 'Open your documents' : 'Start writing — it’s free'}
            </Link>
            <a
              href="https://github.com/yadnyesh001/SyncForge"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost px-6 py-3 text-base"
            >
              ★ View on GitHub
            </a>
          </div>

          {/* Faux editor preview */}
          <div className="mx-auto mt-16 max-w-3xl animate-fade-in">
            <div className="card overflow-hidden text-left">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs text-slate-400">Project Kickoff Notes</span>
                <span className="ml-auto flex -space-x-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-brand-500 text-[10px] font-semibold text-white dark:border-slate-900">AL</span>
                  <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-emerald-500 text-[10px] font-semibold text-white dark:border-slate-900">BK</span>
                </span>
              </div>
              <div className="p-6 font-mono text-sm leading-7 text-slate-700 dark:text-slate-200">
                <p>Real-Time Collaborative Sync Engine</p>
                <p className="mt-2 text-slate-400"># Multiple cursors, one source of truth</p>
                <p>
                  - Hand-rolled CRDT
                  <span className="relative mx-0.5 inline-block border-l-2 border-brand-500">
                    <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-brand-500 px-1.5 py-0.5 text-[10px] text-white">Ada</span>
                  </span>
                </p>
                <p>- Eventual consistency, proven across 5 clients</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
          Everything you’d expect — and the hard parts done right
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 transition-transform hover:-translate-y-1">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-xl dark:bg-brand-500/10">
                {f.icon}
              </div>
              <h3 className="mt-4 font-semibold text-slate-800 dark:text-slate-100">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-20">
        <div className="card overflow-hidden bg-gradient-to-br from-brand-600 to-violet-600 p-10 text-center text-white">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to collaborate?</h2>
          <p className="mx-auto mt-2 max-w-md text-white/80">
            Create a document and share the link — anyone you invite can edit it live.
          </p>
          <Link
            to={user ? '/dashboard' : '/register'}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 transition hover:bg-slate-100 active:scale-[0.98]"
          >
            {user ? 'Go to your documents' : 'Create your free account'}
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
        SyncForge — real-time collaborative editing, built from first principles.
      </footer>
    </div>
  );
}
