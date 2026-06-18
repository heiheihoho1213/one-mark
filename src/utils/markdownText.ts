import { marked } from 'marked';

/**
 * 将 Markdown 行内语法转为纯文本（用于目录大纲等展示场景）
 */
export function stripMarkdownInline(text: string): string {
  if (!text.trim()) return '';

  const html = marked.parseInline(text, { async: false }) as string;
  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.textContent || '').replace(/\s+/g, ' ').trim();
}
