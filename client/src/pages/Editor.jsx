/**
 * pages/Editor.jsx
 * -----------------------------------------------------------------------------
 * The live collaborative editor. Pulls everything together:
 *   - useCollaborativeDocument: CRDT replica + socket sync + presence + offline.
 *   - A <textarea> whose changes become CRDT operations (via the diff util).
 *   - Title rename with debounced auto-save.
 *   - Presence bar, history panel, share modal, live stats.
 *   - Keyboard shortcuts (Ctrl/Cmd+S = save hint, Ctrl/Cmd+H = history).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';
import PresenceBar from '../components/editor/PresenceBar';
import HistoryPanel from '../components/editor/HistoryPanel';
import ShareModal from '../components/editor/ShareModal';
import { useAuth } from '../context/AuthContext';
import documentsApi from '../services/documents.service';
import { useCollaborativeDocument } from '../hooks/useCollaborativeDocument';

export default function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const textareaRef = useRef(null);

  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [saveState, setSaveState] = useState('saved'); // saved | saving
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [error, setError] = useState('');
  const titleTimer = useRef(null);

  const { ready, text, version, status, users, cursors, typing, onChange, onCursor } =
    useCollaborativeDocument(id, textareaRef);

  // Load metadata (title, collaborators, ownership) once.
  useEffect(() => {
    documentsApi
      .get(id)
      .then((d) => {
        setDoc(d);
        setTitle(d.title);
      })
      .catch((err) => setError(err.response?.data?.error?.message || 'Failed to open document'));
  }, [id]);

  const isOwner = doc && String(doc.owner?._id || doc.owner) === String(user?._id || user?.id);

  // Debounced title auto-save (rename).
  const onTitleChange = (value) => {
    setTitle(value);
    setSaveState('saving');
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      try {
        await documentsApi.update(id, { title: value });
        setSaveState('saved');
      } catch {
        setSaveState('saved');
      }
    }, 600);
  };

  // Textarea change -> CRDT ops.
  const handleInput = (e) => {
    setSaveState('saving');
    onChange(e.target.value, e.target.selectionStart);
    // Content is persisted server-side on every op; reflect "saved" shortly after.
    clearTimeout(titleTimer.current);
    setTimeout(() => setSaveState('saved'), 400);
  };

  const handleCursor = (e) => onCursor(e.target.selectionStart);

  // Keyboard shortcuts.
  const onKeyDown = useCallback((e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault(); // auto-save already handles persistence
    } else if (mod && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      setShowHistory((v) => !v);
    }
  }, []);

  if (error) {
    return (
      <Shell>
        <p className="mt-6 text-red-600">{error}</p>
      </Shell>
    );
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <Link to="/" className="text-sm text-indigo-600 hover:underline">←</Link>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-lg font-semibold text-slate-800 outline-none focus:bg-slate-100 dark:text-slate-100 dark:focus:bg-slate-800"
            />
            <span className="text-xs text-slate-400">{saveState === 'saving' ? 'Saving…' : 'Saved'}</span>
            <button onClick={() => setShowShare(true)} className="rounded-md border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              Share
            </button>
            <button onClick={() => setShowHistory((v) => !v)} className="rounded-md border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              History
            </button>
          </div>

          {/* Presence */}
          <div className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
            <PresenceBar users={users} cursors={cursors} typing={typing} status={status} />
          </div>

          {/* Editor surface */}
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {!ready ? (
              <Spinner label="Joining document…" />
            ) : (
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleInput}
                onKeyUp={handleCursor}
                onClick={handleCursor}
                onKeyDown={onKeyDown}
                spellCheck={false}
                placeholder="Start typing… your edits sync in real time."
                className="mx-auto block h-full min-h-[60vh] w-full max-w-3xl resize-none rounded-xl border border-slate-200 bg-white p-6 font-mono text-[15px] leading-7 text-slate-800 shadow-sm outline-none focus:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            )}
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <span>{text.length} chars</span>
            <span>{words} words</span>
            <span>version {version}</span>
            <span>{users.length + 1} editing</span>
            <span className="ml-auto opacity-70">Ctrl/⌘+H history · Ctrl/⌘+S save</span>
          </div>
        </main>

        {showHistory && (
          <HistoryPanel documentId={id} currentVersion={version} onClose={() => setShowHistory(false)} />
        )}
      </div>

      {showShare && doc && (
        <ShareModal
          doc={doc}
          isOwner={isOwner}
          onClose={() => setShowShare(false)}
          onUpdated={(updated) => setDoc(updated)}
        />
      )}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/" className="text-sm text-indigo-600 hover:underline">← Back to documents</Link>
        {children}
      </main>
    </div>
  );
}
