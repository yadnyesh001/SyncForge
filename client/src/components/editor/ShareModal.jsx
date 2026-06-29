/**
 * components/editor/ShareModal.jsx
 * -----------------------------------------------------------------------------
 * Share a document: copy the invite link and (owner only) manage collaborators
 * by email. PUT /documents/:id replaces the collaborator list.
 */

import { useState } from 'react';
import documentsApi from '../../services/documents.service';

export default function ShareModal({ doc, isOwner, onClose, onUpdated }) {
  const [emails, setEmails] = useState(
    (doc.collaborators || []).map((c) => c.email).join(', ')
  );
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inviteLink = window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
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
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update collaborators');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">Share document</h2>

        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Invite link</label>
        <div className="mb-4 flex gap-2">
          <input
            readOnly
            value={inviteLink}
            className="flex-1 truncate rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <button onClick={copy} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Collaborators (emails, comma-separated)
        </label>
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          disabled={!isOwner}
          rows={2}
          placeholder={isOwner ? 'alice@example.com, bob@example.com' : 'Only the owner can edit sharing'}
          className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Close
          </button>
          {isOwner && (
            <button onClick={save} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60">
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
