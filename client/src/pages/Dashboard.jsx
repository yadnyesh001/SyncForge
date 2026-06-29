/**
 * pages/Dashboard.jsx
 * -----------------------------------------------------------------------------
 * The document list / home. Create, search, open, rename, share, delete — plus a
 * "recent" ordering (the API already returns docs newest-first).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import documentsApi from '../services/documents.service';

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Your documents</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create, open, and collaborate in real time.
            </p>
          </div>
          <button
            onClick={createDoc}
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {creating ? 'Creating…' : '+ New document'}
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents…"
          className="mb-6 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:max-w-xs"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {docs === null ? (
          <Spinner label="Loading documents…" />
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={createDoc} hasDocs={docs.length > 0} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc) => (
              <li
                key={doc._id}
                onClick={() => navigate(`/documents/${doc._id}`)}
                className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <div className="flex items-start justify-between">
                  <h3 className="truncate font-medium text-slate-800 dark:text-slate-100">{doc.title}</h3>
                  {isOwner(doc) ? (
                    <button
                      onClick={(e) => removeDoc(e, doc._id)}
                      className="opacity-0 transition group-hover:opacity-100 text-slate-400 hover:text-red-500"
                      title="Delete"
                    >
                      ✕
                    </button>
                  ) : (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                      shared
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                  {doc.currentContent ? doc.currentContent.slice(0, 120) : 'Empty document'}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  {doc.owner?.name ? `${doc.owner.name} · ` : ''}
                  {new Date(doc.updatedAt).toLocaleString()}
                </p>
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
    <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
      <p className="text-slate-500 dark:text-slate-400">
        {hasDocs ? 'No documents match your search.' : 'You have no documents yet.'}
      </p>
      {!hasDocs && (
        <button onClick={onCreate} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
          Create your first document
        </button>
      )}
    </div>
  );
}
