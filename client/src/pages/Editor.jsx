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
import RemoteCursors from '../components/editor/RemoteCursors';
import MarkdownPreview from '../components/editor/MarkdownPreview';
import { useAuth } from '../context/AuthContext';
import documentsApi from '../services/documents.service';
import { useCollaborativeDocument } from '../hooks/useCollaborativeDocument';

// Shared text metrics — the textarea and the cursor overlay MUST match exactly.
const SURFACE = 'p-5 sm:p-8 font-mono text-[15px] leading-8';
const VIEW_MODES = ['write', 'split', 'preview'];

export default function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const textareaRef = useRef(null);

  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [saveState, setSaveState] = useState('saved');
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [viewMode, setViewMode] = useState('write');
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

  // Auto-grow the textarea so it never scrolls internally (keeps cursors aligned).
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.max(ta.scrollHeight, window.innerHeight * 0.5)}px`;
    }
  }, [text, ready, viewMode]);

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
    } else if (mod && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      setViewMode((m) => (m === 'preview' ? 'write' : 'preview'));
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <Link to="/dashboard" className="text-sm text-brand-600 hover:underline">← Back to documents</Link>
          <div className="card mt-6 p-8 text-center">
            <div className="mb-3 text-4xl">😕</div>
            <p className="font-medium text-red-600">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const writeSurface = (
    <div className="card relative overflow-hidden">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyUp={handleCursor}
        onClick={handleCursor}
        onKeyDown={onKeyDown}
        spellCheck={false}
        placeholder="Start typing… Markdown supported. Your edits sync in real time."
        className={`relative block w-full resize-none overflow-hidden bg-transparent text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 ${SURFACE}`}
      />
      <RemoteCursors text={text} cursors={cursors} surfaceClass={SURFACE} />
    </div>
  );

  const previewSurface = (
    <div className="card min-h-[50vh] overflow-hidden">
      <MarkdownPreview text={text} />
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/80 px-3 py-2.5 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80 sm:px-4">
            <Link
              to="/dashboard"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Back to documents"
            >
              ←
            </Link>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Untitled"
              className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-base font-semibold text-slate-800 outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800 sm:text-lg"
            />

            {/* View mode segmented control */}
            <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
              {VIEW_MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    viewMode === m
                      ? 'bg-brand-600 text-white shadow-soft'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  } ${m === 'split' ? 'hidden sm:block' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>

            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
              {saveState === 'saving' ? (
                <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" /> Saving…</>
              ) : (
                <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Saved</>
              )}
            </span>
            <button onClick={() => setShowShare(true)} className="btn-ghost px-3 py-1.5 text-sm">
              <span className="sm:hidden">↗</span><span className="hidden sm:inline">↗ Share</span>
            </button>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`btn-ghost px-3 py-1.5 text-sm ${showHistory ? 'ring-2 ring-brand-500/30' : ''}`}
            >
              <span className="sm:hidden">🕘</span><span className="hidden sm:inline">🕘 History</span>
            </button>
          </div>

          {/* Presence */}
          <div className="border-b border-slate-200/80 bg-white/60 px-3 py-2 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/60 sm:px-4">
            <PresenceBar users={users} cursors={cursors} typing={typing} status={status} />
          </div>

          {/* Surface */}
          <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-4 sm:py-8">
            {!ready ? (
              <Spinner label="Joining document…" />
            ) : viewMode === 'split' ? (
              <div className="mx-auto grid max-w-6xl gap-4 animate-fade-in md:grid-cols-2">
                {writeSurface}
                {previewSurface}
              </div>
            ) : (
              <div className="mx-auto max-w-3xl animate-fade-in">
                {viewMode === 'preview' ? previewSurface : writeSurface}
              </div>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-3 border-t border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-500 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-400 sm:gap-4 sm:px-4">
            <Stat icon="✍️" value={`${text.length}`} label="chars" />
            <Stat icon="📝" value={`${words}`} label="words" />
            <Stat icon="⚙️" value={`v${version}`} />
            <Stat icon="👥" value={`${users.length + 1}`} label="editing" />
            <span className="ml-auto hidden opacity-60 lg:inline">
              ⌘/Ctrl + K palette · + E preview · + H history
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

function Stat({ icon, value, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="opacity-70">{icon}</span>
      {value}
      {label && <span className="hidden sm:inline">&nbsp;{label}</span>}
    </span>
  );
}
