/**
 * pages/Dashboard.jsx — document list / home.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import documentsApi from '../services/documents.service';

const CARD_ACCENTS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
  'from-fuchsia-500 to-purple-500',
];

function relativeTime(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setDocs(await documentsApi.list());
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load documents');
      setDocs([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!docs) return [];
    const q = query.trim().toLowerCase();
    return q ? docs.filter((d) => d.title.toLowerCase().includes(q)) : docs;
  }, [docs, query]);

  const createDoc = async () => {
    setCreating(true);
    try {
      const doc = await documentsApi.create('Untitled');
      navigate(`/documents/${doc._id}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not create document');
    } finally {
      setCreating(false);
    }
  };

  const removeDoc = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    await documentsApi.remove(id);
    setDocs((d) => d.filter((x) => x._id !== id));
  };

  const isOwner = (doc) => String(doc.owner?._id || doc.owner) === String(user?._id || user?.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Hero header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
          <div>
            <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
              Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Your documents
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create, open, and collaborate in real time.
            </p>
          </div>
          <button onClick={createDoc} disabled={creating} className="btn-primary">
            <span className="text-lg leading-none">+</span>
            {creating ? 'Creating…' : 'New document'}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-sm">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="input pl-10"
          />
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {docs === null ? (
          <Spinner label="Loading documents…" />
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={createDoc} hasDocs={docs.length > 0} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc, i) => (
              <li
                key={doc._id}
                onClick={() => navigate(`/documents/${doc._id}`)}
                style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
                className="group card cursor-pointer overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift animate-slide-up"
              >
                <div className={`h-1.5 w-full bg-gradient-to-r ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
                      {doc.title || 'Untitled'}
                    </h3>
                    {isOwner(doc) ? (
                      <button
                        onClick={(e) => removeDoc(e, doc._id)}
                        className="shrink-0 rounded-lg px-1.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-950"
                        title="Delete"
                      >
                        ✕
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        Shared
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500 dark:text-slate-400">
                    {doc.currentContent ? doc.currentContent.slice(0, 120) : 'Empty document'}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate">{doc.owner?.name || 'You'}</span>
                    <span>{relativeTime(doc.updatedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onCreate, hasDocs }) {
  return (
    <div className="card flex flex-col items-center justify-center p-16 text-center animate-fade-in">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-3xl dark:bg-brand-500/10">
        📝
      </div>
      <p className="text-base font-medium text-slate-700 dark:text-slate-200">
        {hasDocs ? 'No documents match your search' : 'No documents yet'}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {hasDocs ? 'Try a different search term.' : 'Create your first document to get started.'}
      </p>
      {!hasDocs && (
        <button onClick={onCreate} className="btn-primary mt-6">
          <span className="text-lg leading-none">+</span> Create document
        </button>
      )}
    </div>
  );
}
