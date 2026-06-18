import { marked } from 'marked';
import hljs from 'highlight.js';

let configured = false;

/** 为 marked 配置代码块语法高亮 */
export function configureMarkdownHighlight(): void {
  if (configured) return;
  configured = true;

  marked.use({
    renderer: {
      code({ text, lang }) {
        const safeLang = (lang || '').replace(/[^\w-]/g, '');

        if (safeLang && hljs.getLanguage(safeLang)) {
          const highlighted = hljs.highlight(text, { language: safeLang }).value;
          return `<pre><code class="hljs language-${safeLang}">${highlighted}</code></pre>`;
        }

        const auto = hljs.highlightAuto(text);
        const language = auto.language || 'plaintext';
        return `<pre><code class="hljs language-${language}">${auto.value}</code></pre>`;
      },
    },
  });
}

configureMarkdownHighlight();
