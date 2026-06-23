import type { InlineContent, InlineMark } from '../ast/types';
import { normalizeSegments } from '../ast/inline';

/** 从 contenteditable DOM 还原行内 AST（保留链接等结构） */
export function domToInlineContent(root: HTMLElement): InlineContent {
  const segments: InlineContent = [];

  const walk = (node: Node, marks: InlineMark) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text) segments.push({ text, marks: { ...marks } });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const linkUrl = el.dataset.linkUrl;
    if (el.tagName === 'A' && linkUrl) {
      const text = el.textContent ?? '';
      if (text) segments.push({ text, marks: { ...marks, link: linkUrl } });
      return;
    }

    const next: InlineMark = { ...marks };
    const tag = el.tagName;
    if (tag === 'STRONG' || tag === 'B') next.bold = true;
    if (tag === 'EM' || tag === 'I') next.italic = true;
    if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') next.strike = true;
    if (tag === 'CODE') next.code = true;

    el.childNodes.forEach((child) => walk(child, next));
  };

  root.childNodes.forEach((child) => walk(child, {}));
  return normalizeSegments(segments);
}

/** 行内 AST 转为可编辑 HTML */
export function inlineContentToHtml(content: InlineContent): string {
  return content
    .map((seg) => {
      if (!seg.text) return '';
      let t = escapeHtml(seg.text);
      const m = seg.marks;
      if (m.code) t = `<code>${t}</code>`;
      if (m.strike) t = `<s>${t}</s>`;
      if (m.bold && m.italic) t = `<strong><em>${t}</em></strong>`;
      else if (m.bold) t = `<strong>${t}</strong>`;
      else if (m.italic) t = `<em>${t}</em>`;
      if (m.link) {
        const url = escapeHtml(m.link);
        t = `<a href="${url}" data-link-url="${url}" class="text-brand-rust underline decoration-brand-rust/50 underline-offset-2">${t}</a>`;
      }
      return t;
    })
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
