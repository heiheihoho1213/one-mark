import type { BlockNode, DocumentAst, InlineContent, ListItem, TableColAlign } from './types';
import { newBlockId } from './types';
import { parseInline } from './inline';

function parseTable(raw: string): BlockNode | null {
  const lines = raw.trim().split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return null;

  const parseRow = (line: string): InlineContent[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => parseInline(cell.trim()));

  const headers = parseRow(lines[0]);
  let bodyStart = 1;
  let colAligns: TableColAlign[] | undefined;

  if (lines.length > 1 && /^\|?\s*[-:]+/.test(lines[1].replace(/\s/g, ''))) {
    const parseColAlign = (sep: string): TableColAlign => {
      const t = sep.trim();
      const start = t.startsWith(':');
      const end = t.endsWith(':');
      if (start && end) return 'center';
      if (end) return 'right';
      return 'left';
    };
    const sepCells = lines[1].split('|').slice(1, -1);
    colAligns = sepCells.map(parseColAlign);
    bodyStart = 2;
  }

  const rows = lines.slice(bodyStart).map(parseRow);
  return { type: 'table', id: newBlockId(), headers, rows, colAligns };
}

function parseCode(raw: string): BlockNode | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return null;
  const firstLineEnd = trimmed.indexOf('\n');
  if (firstLineEnd === -1) {
    return { type: 'code', id: newBlockId(), lang: trimmed.slice(3).replace(/`+$/, '').trim(), code: '' };
  }
  const lang = trimmed.slice(3, firstLineEnd).trim();
  let body = trimmed.slice(firstLineEnd + 1);
  const closeIdx = body.lastIndexOf('```');
  if (closeIdx !== -1) body = body.slice(0, closeIdx);
  if (lang === 'mermaid') {
    return { type: 'mermaid', id: newBlockId(), code: body.replace(/\n$/, '') };
  }
  return { type: 'code', id: newBlockId(), lang, code: body.replace(/\n$/, '') };
}

function parseList(raw: string): BlockNode | null {
  const lines = raw.split('\n');
  const first = lines[0]?.trim() ?? '';
  const ordered = /^\d+\.\s/.test(first);
  const bullet = /^[-*+]\s/.test(first);
  if (!ordered && !bullet) return null;

  const items: ListItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (!m) continue;
    items.push({ content: parseInline(m[3]) });
  }
  if (!items.length) return null;
  return { type: 'list', id: newBlockId(), ordered, items };
}

/** 将整篇 Markdown 解析为块级 AST */
export function parseDocument(markdown: string): DocumentAst {
  if (!markdown.trim()) {
    return { blocks: [{ type: 'paragraph', id: newBlockId(), content: parseInline('') }] };
  }

  const parts = markdown.split(/\n\n+/);
  const blocks: BlockNode[] = [];

  for (const part of parts) {
    const trimmed = part.trim();

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({ type: 'thematicBreak', id: newBlockId() });
      continue;
    }

    const code = parseCode(part);
    if (code) {
      blocks.push(code);
      continue;
    }

    const table = parseTable(part);
    if (table) {
      blocks.push(table);
      continue;
    }

    const list = parseList(part);
    if (list) {
      blocks.push(list);
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+([\s\S]*)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        id: newBlockId(),
        level: Math.min(4, heading[1].length) as 1 | 2 | 3 | 4,
        content: parseInline(heading[2]),
      });
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteText = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('\n');
      blocks.push({ type: 'blockquote', id: newBlockId(), content: parseInline(quoteText) });
      continue;
    }

    blocks.push({ type: 'paragraph', id: newBlockId(), content: parseInline(trimmed) });
  }

  return { blocks };
}

export function cloneAst(ast: DocumentAst): DocumentAst {
  return JSON.parse(JSON.stringify(ast)) as DocumentAst;
}

export function findBlock(ast: DocumentAst, blockId: string): BlockNode | undefined {
  return ast.blocks.find((b) => b.id === blockId);
}

export function getInlineContent(block: BlockNode): InlineContent | null {
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'blockquote') {
    return block.content;
  }
  return null;
}

export function setInlineContent(block: BlockNode, content: InlineContent): BlockNode {
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'blockquote') {
    return { ...block, content };
  }
  return block;
}
