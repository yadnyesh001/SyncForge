/**
 * components/editor/ShareModal.jsx — invite link, read-only public toggle,
 * and collaborator management.
 */

import { useState } from 'react';
import documentsApi from '../../services/documents.service';
import { useToast } from '../../context/ToastContext';

export default function ShareModal({ doc, isOwner, onClose, onUpdated }) {
  const toast = useToast();
  const [emails, setEmails] = useState((doc.collaborators || []).map((c) => c.email).join(', '));
  const [publicAccess, setPublicAccess] = useState(!!doc.isPublic);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inviteLink = window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Invite link copied to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy — copy it manually.');
    }
  };

  // Toggle public read-only access immediately (owner only).
  const togglePublic = async () => {
    const next = !publicAccess;
    setPublicAccess(next);
    try {
      const updated = await documentsApi.update(doc._id, { isPublic: next });
      onUpdated(updated);
      toast.success(next ? 'Anyone with the link can now view' : 'Link sharing turned off');
    } catch (err) {
      setPublicAccess(!next); // revert on failure
      toast.error(err.response?.data?.error?.message || 'Failed to update sharing');
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const list = emails.split(',').map((e) => e.trim()).filter(Boolean);
      const updated = await documentsApi.update(doc._id, { collaborators: list });
      onUpdated(updated);
      toast.success('Collaborators updated');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update collaborators');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="card w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-lg text-white">↗</div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Share document</h2>
            <p className="text-xs text-slate-400">Invite editors or share a read-only link.</p>
          </div>
        </div>

        {/* Public read-only toggle (owner only) */}
        {isOwner && (
          <button
            onClick={togglePublic}
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2.5">
              <span className="text-lg">{publicAccess ? '🌍' : '🔒'}</span>
              <span>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {publicAccess ? 'Anyone with the link can view' : 'Private'}
                </span>
                <span className="block text-xs text-slate-400">Read-only · editing still needs an invite</span>
              </span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${publicAccess ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${publicAccess ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
          </button>
        )}

        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Invite link</label>
        <div className="mb-5 flex gap-2">
          <input readOnly value={inviteLink} className="input flex-1 truncate bg-slate-50 dark:bg-slate-800" />
          <button onClick={copy} className={copied ? 'btn-ghost' : 'btn-primary'}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Collaborators <span className="ml-1 font-normal text-slate-400">(emails, comma-separated)</span>
        </label>
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          disabled={!isOwner}
          rows={2}
          placeholder={isOwner ? 'alice@example.com, bob@example.com' : 'Only the owner can edit sharing'}
          className="input mb-2 resize-none disabled:opacity-60"
        />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Close</button>
          {isOwner && (
            <button onClick={save} disabled={busy} className="btn-primary px-4 py-2 text-sm">
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
