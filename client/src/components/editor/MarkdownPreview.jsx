/**
 * components/editor/MarkdownPreview.jsx
 * -----------------------------------------------------------------------------
 * Renders the document text as Markdown.
 *
 * SAFETY: collaborators' text is untrusted, so we sanitize the parsed HTML with
 * DOMPurify before injecting it — otherwise one user could inject a <script>
 * that runs for everyone. The @tailwindcss/typography `prose` classes style it.
 */

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

export default function MarkdownPreview({ text }) {
  const html = useMemo(() => {
    const raw = marked.parse(text || '');
    return DOMPurify.sanitize(raw);
  }, [text]);

  if (!text?.trim()) {
    return (
      <div className="p-6 text-sm text-slate-400 sm:p-8">Nothing to preview yet — start writing.</div>
    );
  }

  return (
    <div
      className="prose prose-slate max-w-none p-6 dark:prose-invert sm:p-8 prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
