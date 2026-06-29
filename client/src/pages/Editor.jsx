/**
 * pages/Editor.jsx — the live collaborative editor.
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

  const handleInput = (e) => {
    setSaveState('saving');
    onChange(e.target.value, e.target.selectionStart);
    clearTimeout(titleTimer.current);
    setTimeout(() => setSaveState('saved'), 400);
  };

  const handleCursor = (e) => onCursor(e.target.selectionStart);

  const onKeyDown = useCallback((e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
    } else if (mod && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      setShowHistory((v) => !v);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <Link to="/" className="text-sm text-brand-600 hover:underline">← Back to documents</Link>
          <div className="card mt-6 p-8 text-center">
            <div className="mb-3 text-4xl">😕</div>
            <p className="font-medium text-red-600">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/80 px-4 py-2.5 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80">
            <Link
              to="/"
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Back to documents"
            >
              ←
            </Link>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Untitled"
              className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-lg font-semibold text-slate-800 outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
            />
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              {saveState === 'saving' ? (
                <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" /> Saving…</>
              ) : (
                <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Saved</>
              )}
            </span>
            <button onClick={() => setShowShare(true)} className="btn-ghost px-3 py-1.5 text-sm">
              ↗ Share
            </button>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`btn-ghost px-3 py-1.5 text-sm ${showHistory ? 'ring-2 ring-brand-500/30' : ''}`}
            >
              🕘 History
            </button>
          </div>

          {/* Presence */}
          <div className="border-b border-slate-200/80 bg-white/60 px-4 py-2 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/60">
            <PresenceBar users={users} cursors={cursors} typing={typing} status={status} />
          </div>

          {/* Writing surface */}
          <div className="min-h-0 flex-1 overflow-auto px-4 py-8">
            {!ready ? (
              <Spinner label="Joining document…" />
            ) : (
              <div className="mx-auto max-w-3xl animate-fade-in">
                <div className="card overflow-hidden">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleInput}
                    onKeyUp={handleCursor}
                    onClick={handleCursor}
                    onKeyDown={onKeyDown}
                    spellCheck={false}
                    placeholder="Start typing… your edits sync in real time."
                    className="block h-full min-h-[62vh] w-full resize-none bg-transparent p-8 sm:p-12 font-mono text-[15px] leading-8 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 border-t border-slate-200/80 bg-white/80 px-4 py-2 text-xs text-slate-500 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-400">
            <Stat icon="✍️" value={`${text.length} chars`} />
            <Stat icon="📝" value={`${words} words`} />
            <Stat icon="⚙️" value={`v${version}`} />
            <Stat icon="👥" value={`${users.length + 1} editing`} />
            <span className="ml-auto hidden opacity-60 sm:inline">
              ⌘/Ctrl + H history · ⌘/Ctrl + S save
            </span>
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

function Stat({ icon, value }) {
  return (
    <span className="flex items-center gap-1">
      <span className="opacity-70">{icon}</span>
      {value}
    </span>
  );
}
