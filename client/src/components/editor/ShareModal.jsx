/**
 * components/editor/ShareModal.jsx — copy invite link + manage collaborators.
 */

import { useState } from 'react';
import documentsApi from '../../services/documents.service';
import { useToast } from '../../context/ToastContext';

export default function ShareModal({ doc, isOwner, onClose, onUpdated }) {
  const toast = useToast();
  const [emails, setEmails] = useState((doc.collaborators || []).map((c) => c.email).join(', '));
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

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const list = emails.split(',').map((e) => e.trim()).filter(Boolean);
      const updated = await documentsApi.update(doc._id, { collaborators: list });
      onUpdated(updated);
      toast.success('Sharing updated');
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
      <div
        className="card w-full max-w-md p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-lg text-white">
            ↗
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Share document</h2>
            <p className="text-xs text-slate-400">Anyone you add can edit in real time.</p>
          </div>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Invite link</label>
        <div className="mb-5 flex gap-2">
          <input readOnly value={inviteLink} className="input flex-1 truncate bg-slate-50 dark:bg-slate-800" />
          <button onClick={copy} className={copied ? 'btn-ghost' : 'btn-primary'}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Collaborators
          <span className="ml-1 font-normal text-slate-400">(emails, comma-separated)</span>
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
