/**
 * utils/exportDocument.js
 * -----------------------------------------------------------------------------
 * Export a document's content as Markdown (.md download) or PDF (print dialog).
 *
 * PDF uses a printable popup with the rendered HTML — the browser's "Save as PDF"
 * handles the actual conversion (no heavy client-side PDF library needed).
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';

function slugify(title) {
  return (title || 'document').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'document';
}

/** Download the raw text as a .md file. */
export function exportMarkdown(title, text) {
  const blob = new Blob([text || ''], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Open a print-ready window of the rendered document; user saves it as PDF. */
export function exportPdf(title, text) {
  const body = DOMPurify.sanitize(marked.parse(text || ''));
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) return; // popup blocked
  win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
    <title>${(title || 'Document').replace(/</g, '&lt;')}</title>
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #1e293b; line-height: 1.7; }
      h1,h2,h3 { font-family: Inter, system-ui, sans-serif; line-height: 1.25; }
      pre { background: #f1f5f9; padding: 14px 16px; border-radius: 8px; overflow:auto; font-size: 13px; }
      code { font-family: ui-monospace, Menlo, Consolas, monospace; }
      :not(pre) > code { background:#f1f5f9; padding:2px 5px; border-radius:4px; font-size: 90%; }
      a { color: #4f46e5; }
      blockquote { border-left: 3px solid #cbd5e1; margin: 0; padding-left: 16px; color:#475569; }
      img { max-width: 100%; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h1 style="border-bottom:1px solid #e2e8f0;padding-bottom:8px">${(title || 'Untitled').replace(/</g, '&lt;')}</h1>
    ${body}
    </body></html>`);
  win.document.close();
  win.focus();
  // Give the content a tick to lay out before printing.
  setTimeout(() => win.print(), 300);
}
