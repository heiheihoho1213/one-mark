import type { InlineContent, InlineMark } from './types';

const EMPTY_MARK: InlineMark = {};

export function plainTextOf(content: InlineContent): string {
  return content.map((s) => s.text).join('');
}

export function normalizeSegments(segments: InlineContent): InlineContent {
  const merged: InlineContent = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const last = merged[merged.length - 1];
    if (last && marksEqual(last.marks, seg.marks)) {
      last.text += seg.text;
    } else {
      merged.push({ text: seg.text, marks: { ...seg.marks } });
    }
  }
  return merged.length ? merged : [{ text: '', marks: {} }];
}

function marksEqual(a: InlineMark, b: InlineMark): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.strike === !!b.strike &&
    !!a.code === !!b.code &&
    (a.link ?? '') === (b.link ?? '')
  );
}

/** 解析行内 Markdown 为片段列表 */
export function parseInline(source: string): InlineContent {
  if (!source) return [{ text: '', marks: {} }];

  const root: { marks: InlineMark; children: InlineContent } = { marks: {}, children: [] };
  let text = '';
  let i = 0;

  const flushText = () => {
    if (!text) return;
    root.children.push({ text, marks: {} });
    text = '';
  };

  while (i < source.length) {
    if (source.startsWith('![', i)) {
      const close = source.indexOf(']', i + 2);
      const paren = close >= 0 ? source.indexOf(')', close) : -1;
      if (close >= 0 && paren >= 0) {
        flushText();
        const alt = source.slice(i + 2, close);
        const url = source.slice(close + 2, paren);
        root.children.push({ text: `![${alt}](${url})`, marks: {} });
        i = paren + 1;
        continue;
      }
    }

    if (source[i] === '[') {
      const close = source.indexOf(']', i + 1);
      const paren = close >= 0 ? source.indexOf(')', close) : -1;
      if (close >= 0 && paren >= 0 && source[close + 1] === '(') {
        flushText();
        const linkText = source.slice(i + 1, close);
        const url = source.slice(close + 2, paren);
        root.children.push({ text: linkText, marks: { link: url } });
        i = paren + 1;
        continue;
      }
    }

    if (source.startsWith('***', i)) {
      flushText();
      const close = source.indexOf('***', i + 3);
      if (close >= 0) {
        const inner = source.slice(i + 3, close);
        const parsed = parseInline(inner).map((s) => ({
          text: s.text,
          marks: { ...s.marks, bold: true, italic: true },
        }));
        root.children.push(...parsed);
        i = close + 3;
        continue;
      }
    }

    if (source.startsWith('**', i)) {
      flushText();
      const close = source.indexOf('**', i + 2);
      if (close >= 0) {
        const inner = source.slice(i + 2, close);
        const parsed = parseInline(inner).map((s) => ({
          text: s.text,
          marks: { ...s.marks, bold: true },
        }));
        root.children.push(...parsed);
        i = close + 2;
        continue;
      }
    }

    if (source[i] === '*' && source[i + 1] !== '*') {
      flushText();
      const close = source.indexOf('*', i + 1);
      if (close >= 0) {
        const inner = source.slice(i + 1, close);
        const parsed = parseInline(inner).map((s) => ({
          text: s.text,
          marks: { ...s.marks, italic: true },
        }));
        root.children.push(...parsed);
        i = close + 1;
        continue;
      }
    }

    if (source.startsWith('~~', i)) {
      flushText();
      const close = source.indexOf('~~', i + 2);
      if (close >= 0) {
        const inner = source.slice(i + 2, close);
        const parsed = parseInline(inner).map((s) => ({
          text: s.text,
          marks: { ...s.marks, strike: true },
        }));
        root.children.push(...parsed);
        i = close + 2;
        continue;
      }
    }

    if (source[i] === '`') {
      flushText();
      const close = source.indexOf('`', i + 1);
      if (close >= 0) {
        root.children.push({ text: source.slice(i + 1, close), marks: { code: true } });
        i = close + 1;
        continue;
      }
    }

    text += source[i];
    i += 1;
  }

  flushText();
  return normalizeSegments(root.children);
}

/** 序列化行内片段为 Markdown */
export function serializeInline(content: InlineContent): string {
  return normalizeSegments(content)
    .map((seg) => {
      let t = seg.text;
      if (!t) return '';
      const m = seg.marks;
      if (m.link) return `[${t}](${m.link})`;
      if (m.code) return `\`${t}\``;
      if (m.bold && m.italic) t = `***${t}***`;
      else if (m.bold) t = `**${t}**`;
      else if (m.italic) t = `*${t}*`;
      if (m.strike) t = `~~${t}~~`;
      return t;
    })
    .join('');
}

function splitAtOffset(content: InlineContent, offset: number): [InlineContent, InlineContent] {
  if (offset <= 0) return [[], normalizeSegments(content)];
  const plain = plainTextOf(content);
  if (offset >= plain.length) return [normalizeSegments(content), []];

  const left: InlineContent = [];
  const right: InlineContent = [];
  let pos = 0;

  for (const seg of normalizeSegments(content)) {
    const end = pos + seg.text.length;
    if (end <= offset) {
      left.push({ text: seg.text, marks: { ...seg.marks } });
      pos = end;
      continue;
    }
    if (pos >= offset) {
      right.push({ text: seg.text, marks: { ...seg.marks } });
      continue;
    }
    const split = offset - pos;
    left.push({ text: seg.text.slice(0, split), marks: { ...seg.marks } });
    right.push({ text: seg.text.slice(split), marks: { ...seg.marks } });
    pos = end;
  }

  return [normalizeSegments(left), normalizeSegments(right)];
}

/** 切换选区上的行内标记（可逆） */
export function toggleMarkOnRange(
  content: InlineContent,
  start: number,
  end: number,
  mark: keyof InlineMark
): InlineContent {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.max(0, Math.max(start, end));
  if (s === e) return content;

  const [before, rest] = splitAtOffset(content, s);
  const [middle, after] = splitAtOffset(rest, e - s);

  const allMarked = middle.length > 0 && middle.every((seg) => !!seg.marks[mark]);
  const toggled = middle.map((seg) => ({
    text: seg.text,
    marks: { ...seg.marks, [mark]: allMarked ? undefined : true },
  }));

  return normalizeSegments([...before, ...toggled, ...after]);
}

export function insertPlainText(content: InlineContent, offset: number, text: string): InlineContent {
  const [before, after] = splitAtOffset(content, offset);
  const mid: InlineContent = text ? [{ text, marks: EMPTY_MARK }] : [];
  return normalizeSegments([...before, ...mid, ...after]);
}

/** 替换选区内容为新的行内片段 */
export function replaceInlineRange(
  content: InlineContent,
  start: number,
  end: number,
  insert: InlineContent
): InlineContent {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.max(0, Math.max(start, end));
  const [before] = splitAtOffset(content, s);
  const [, rest] = splitAtOffset(content, s);
  const [, after] = splitAtOffset(rest, e - s);
  return normalizeSegments([...before, ...insert, ...after]);
}

/** 读取选区纯文本 */
export function getTextInRange(content: InlineContent, start: number, end: number): string {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.max(0, Math.max(start, end));
  const [, rest] = splitAtOffset(content, s);
  const [middle] = splitAtOffset(rest, e - s);
  return plainTextOf(middle);
}

export function deleteRange(content: InlineContent, start: number, end: number): InlineContent {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.max(0, Math.max(start, end));
  const [before] = splitAtOffset(content, s);
  const [, after] = splitAtOffset(content, e);
  return normalizeSegments([...before, ...after]);
}

export function selectionHasMark(
  content: InlineContent,
  start: number,
  end: number,
  mark: keyof InlineMark
): boolean {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.max(0, Math.max(start, end));
  if (s === e) return false;
  const [, rest] = splitAtOffset(content, s);
  const [middle] = splitAtOffset(rest, e - s);
  return middle.length > 0 && middle.every((seg) => !!seg.marks[mark]);
}
