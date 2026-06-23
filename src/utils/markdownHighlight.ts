import { marked } from 'marked';
import hljs from 'highlight.js';

let configured = false;

/** 将常见别名映射为 highlight.js 语言 id */
export function normalizeHighlightLang(lang: string): string {
  const raw = (lang || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    'c++': 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    h: 'c',
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
  };
  const mapped = aliases[raw] ?? raw;
  return mapped.replace(/[^\w-+#.]/g, '');
}

/** 解析出用于 CSS class 的语言名 */
export function highlightLangClass(lang: string): string {
  const safeLang = normalizeHighlightLang(lang);
  if (safeLang && hljs.getLanguage(safeLang)) return safeLang;
  return 'plaintext';
}

/** 为 marked 配置代码块语法高亮 */
export function configureMarkdownHighlight(): void {
  if (configured) return;
  configured = true;

  marked.use({
    renderer: {
      code({ text, lang }) {
        const safeLang = normalizeHighlightLang(lang || '');

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

/** 将代码文本转为高亮 HTML 片段（不含外层 pre/code 标签） */
export function highlightCode(text: string, lang: string): string {
  const safeLang = normalizeHighlightLang(lang);
  if (safeLang && hljs.getLanguage(safeLang)) {
    return hljs.highlight(text, { language: safeLang }).value;
  }
  return hljs.highlightAuto(text).value;
}
