/**
 * components/editor/MarkdownPreview.jsx
 * -----------------------------------------------------------------------------
 * Renders the document text as Markdown with syntax-highlighted code blocks.
 *
 * SAFETY: collaborators' text is untrusted, so the parsed HTML is sanitized with
 * DOMPurify before injection. Highlighting uses a lean highlight.js core with a
 * handful of common languages registered (keeps the bundle small).
 */

import { useMemo } from 'react';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdownLang from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/github-dark.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdownLang);

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : null;
      return language ? hljs.highlight(code, { language }).value : hljs.highlightAuto(code).value;
    },
  })
);
marked.setOptions({ gfm: true, breaks: true });

export default function MarkdownPreview({ text }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || '')), [text]);

  if (!text?.trim()) {
    return (
      <div className="p-6 text-sm text-slate-400 sm:p-8">Nothing to preview yet — start writing.</div>
    );
  }

  return (
    <div
      className="prose prose-slate max-w-none p-6 dark:prose-invert sm:p-8 prose-pre:rounded-xl prose-pre:bg-slate-900"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
