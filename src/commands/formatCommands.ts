import type { DocumentStore } from '../document/DocumentStore';
import type { EditorSelection, BlockNode, InlineContent, TableColAlign } from '../ast/types';
import { newBlockId } from '../ast/types';
import { getInlineContent, setInlineContent, cloneAst } from '../ast/parse';
import {
  toggleMarkOnRange,
  insertPlainText,
  deleteRange,
  plainTextOf,
  selectionHasMark,
  replaceInlineRange,
  getTextInRange,
} from '../ast/inline';
import { serializeDocument } from '../ast/serialize';
import { focusTableCell, focusTextBlock } from '../utils/tableNavigation';
import { buildImageParagraph } from '../utils/imageBlock';
import { selectBlock } from '../utils/blockSelection';
import { parseInline } from '../ast/inline';

export type FormatCommand =
  | { type: 'toggleBold' }
  | { type: 'toggleItalic' }
  | { type: 'toggleStrike' }
  | { type: 'toggleInlineCode' }
  | { type: 'setHeading'; level: 1 | 2 | 3 | 4 | 0 }
  | { type: 'toggleBlockquote' }
  | { type: 'insertLink'; url: string; text?: string }
  | { type: 'insertImage'; url: string; alt?: string }
  | { type: 'insertTable' }
  | { type: 'insertCodeBlock' }
  | { type: 'toggleUl' }
  | { type: 'toggleOl' };

function getSelectionRange(sel: EditorSelection | null): { blockId: string; start: number; end: number } | null {
  if (!sel) return null;
  return {
    blockId: sel.blockId,
    start: Math.min(sel.anchor, sel.focus),
    end: Math.max(sel.anchor, sel.focus),
  };
}

/** 格式命令改 AST 后保留选区快照，供 DOM 同步后恢复高亮 */
function commitFormatSelection(store: DocumentStore, selection: EditorSelection) {
  store.setPendingRestoreSelection(selection);
}

function applyInlineToggle(
  store: DocumentStore,
  mark: 'bold' | 'italic' | 'strike' | 'code'
) {
  const captured = store.getState().selection;
  const range = getSelectionRange(captured);
  if (!range || range.start === range.end) return;

  // 须在 updateAst 触发 DOM 同步之前登记，否则 useLayoutEffect 读不到
  commitFormatSelection(store, captured!);

  store.updateAst((ast) => {
    const blocks = ast.blocks.map((block) => {
      if (block.id !== range.blockId) return block;
      const content = getInlineContent(block);
      if (!content) return block;
      const next = toggleMarkOnRange(content, range.start, range.end, mark);
      return setInlineContent(block, next);
    });
    return { blocks };
  });
}

/** 执行格式命令（仅改 AST，样式与块级分离） */
export function executeFormatCommand(store: DocumentStore, command: FormatCommand) {
  const state = store.getState();
  const captured = state.selection;
  const range = getSelectionRange(captured);

  switch (command.type) {
    case 'toggleBold':
      applyInlineToggle(store, 'bold');
      return;
    case 'toggleItalic':
      applyInlineToggle(store, 'italic');
      return;
    case 'toggleStrike':
      applyInlineToggle(store, 'strike');
      return;
    case 'toggleInlineCode':
      applyInlineToggle(store, 'code');
      return;

    case 'setHeading': {
      if (!range || !captured) return;
      commitFormatSelection(store, captured);
      store.updateAst((ast) => {
        const blocks = ast.blocks.map((block) => {
          if (block.id !== range.blockId) return block;
          const content = getInlineContent(block);
          if (!content) return block;

          if (command.level === 0) {
            if (block.type === 'heading') {
              return { type: 'paragraph' as const, id: block.id, content: block.content };
            }
            return block;
          }

          const level = command.level;
          if (block.type === 'heading' && block.level === level) {
            return { type: 'paragraph' as const, id: block.id, content: block.content };
          }
          return { type: 'heading' as const, id: block.id, level, content };
        });
        return { blocks };
      });
      return;
    }

    case 'toggleBlockquote': {
      if (!range || !captured) return;
      commitFormatSelection(store, captured);
      store.updateAst((ast) => {
        const blocks = ast.blocks.map((block) => {
          if (block.id !== range.blockId) return block;
          const content = getInlineContent(block);
          if (!content) return block;
          if (block.type === 'blockquote') {
            return { type: 'paragraph' as const, id: block.id, content: block.content };
          }
          return { type: 'blockquote' as const, id: block.id, content };
        });
        return { blocks };
      });
      return;
    }

    case 'insertLink': {
      if (!range || !captured) return;
      const block = state.ast.blocks.find((b) => b.id === range.blockId);
      const content = block ? getInlineContent(block) : null;
      if (!content) return;

      const label =
        range.start !== range.end
          ? getTextInRange(content, range.start, range.end)
          : (command.text?.trim() || '链接');
      const linkSeg: InlineContent = [{ text: label, marks: { link: command.url } }];
      const newEnd = range.start + label.length;

      commitFormatSelection(store, {
        blockId: range.blockId,
        anchor: range.start,
        focus: newEnd,
      });

      store.updateAst((ast) => ({
        blocks: ast.blocks.map((b) => {
          if (b.id !== range.blockId) return b;
          const c = getInlineContent(b);
          if (!c) return b;
          const next = replaceInlineRange(c, range.start, range.end, linkSeg);
          return setInlineContent(b, next);
        }),
      }));
      return;
    }

    case 'insertImage': {
      const ast = cloneAst(state.ast);
      const idx = range
        ? ast.blocks.findIndex((b) => b.id === range.blockId)
        : ast.blocks.length - 1;
      const insertAt = idx >= 0 ? idx + 1 : ast.blocks.length;
      const alt = command.alt ?? '图片';
      const imageId = newBlockId();
      // 仅插入图片块；下方空行由用户按 Enter 按需创建
      ast.blocks.splice(insertAt, 0, {
        type: 'paragraph',
        id: imageId,
        content: buildImageParagraph(alt, command.url),
      });
      store.updateAst(() => ast);
      selectBlock(store, imageId);
      return;
    }

    case 'insertTable': {
      const ast = cloneAst(state.ast);
      const idx = range
        ? ast.blocks.findIndex((b) => b.id === range.blockId)
        : ast.blocks.length - 1;
      const insertAt = idx >= 0 ? idx + 1 : ast.blocks.length;
      ast.blocks.splice(insertAt, 0, {
        type: 'table',
        id: newBlockId(),
        headers: [
          [{ text: '表头1', marks: {} }],
          [{ text: '表头2', marks: {} }],
          [{ text: '表头3', marks: {} }],
        ],
        rows: [[
          [{ text: '内容1', marks: {} }],
          [{ text: '内容2', marks: {} }],
          [{ text: '内容3', marks: {} }],
        ]],
        colAligns: ['left', 'left', 'left'],
      });
      store.applyMarkdown(serializeDocument(ast));
      return;
    }

    case 'insertCodeBlock': {
      const ast = cloneAst(state.ast);
      const idx = range
        ? ast.blocks.findIndex((b) => b.id === range.blockId)
        : ast.blocks.length - 1;
      const insertAt = idx >= 0 ? idx + 1 : ast.blocks.length;
      ast.blocks.splice(insertAt, 0, {
        type: 'code',
        id: newBlockId(),
        lang: '',
        code: '// 在此编写代码',
      });
      store.applyMarkdown(serializeDocument(ast));
      return;
    }

    case 'toggleUl':
    case 'toggleOl': {
      if (!range || !captured) return;
      commitFormatSelection(store, captured);
      store.updateAst((ast) => {
        const blocks = ast.blocks.map((block) => {
          if (block.id !== range.blockId) return block;
          const content = getInlineContent(block);
          if (!content) return block;
          const ordered = command.type === 'toggleOl';
          if (block.type === 'list' && block.ordered === ordered) {
            return {
              type: 'paragraph' as const,
              id: block.id,
              content: block.items[0]?.content ?? content,
            };
          }
          return {
            type: 'list' as const,
            id: block.id,
            ordered,
            items: [{ content }],
          };
        });
        return { blocks };
      });
      return;
    }
  }
}

/** 查询工具栏高亮状态 */
export function queryActiveFormats(store: DocumentStore) {
  const { selection, ast } = store.getState();
  const range = getSelectionRange(selection);
  const empty = {
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
    h1: false,
    h2: false,
    h3: false,
    h4: false,
    blockquote: false,
    ul: false,
    ol: false,
  };
  if (!range) return empty;

  const block = ast.blocks.find((b) => b.id === range.blockId);
  if (!block) return empty;

  const content = getInlineContent(block);
  const result = { ...empty };

  if (content) {
    result.bold = selectionHasMark(content, range.start, range.end, 'bold');
    result.italic = selectionHasMark(content, range.start, range.end, 'italic');
    result.strikethrough = selectionHasMark(content, range.start, range.end, 'strike');
    result.code = selectionHasMark(content, range.start, range.end, 'code');
  }

  if (block.type === 'heading') {
    if (block.level === 1) result.h1 = true;
    if (block.level === 2) result.h2 = true;
    if (block.level === 3) result.h3 = true;
    if (block.level === 4) result.h4 = true;
  }
  if (block.type === 'blockquote') result.blockquote = true;
  if (block.type === 'list') {
    if (block.ordered) result.ol = true;
    else result.ul = true;
  }

  return result;
}

/** 键盘编辑：同步块纯文本 */
export function applyTextEdit(
  store: DocumentStore,
  blockId: string,
  newPlain: string
) {
  applyInlineContentEdit(store, blockId, parseInline(newPlain));
}

/** 将完整行内 AST 写回文档（保留链接等结构） */
export function applyInlineContentEdit(
  store: DocumentStore,
  blockId: string,
  content: InlineContent
) {
  store.updateAstFromTyping((ast) => ({
    blocks: ast.blocks.map((block) => {
      if (block.id !== blockId) return block;
      const existing = getInlineContent(block);
      if (!existing) return block;
      if (plainTextOf(existing) === plainTextOf(content) && JSON.stringify(existing) === JSON.stringify(content)) {
        return block;
      }
      return setInlineContent(block, content);
    }),
  }));
}

/** 更新图片段落的路径与 alt */
export function applyImageParagraphEdit(
  store: DocumentStore,
  blockId: string,
  alt: string,
  url: string
) {
  store.updateAst((ast) => ({
    blocks: ast.blocks.map((block) => {
      if (block.id !== blockId || block.type !== 'paragraph') return block;
      return { ...block, content: buildImageParagraph(alt, url) };
    }),
  }));
}

/** 读取当前选区文字（供插入链接对话框预填） */
export function getSelectedPlainText(store: DocumentStore): string {
  const range = getSelectionRange(store.getState().selection);
  if (!range || range.start === range.end) return '';
  const block = store.getState().ast.blocks.find((b) => b.id === range.blockId);
  const content = block ? getInlineContent(block) : null;
  if (!content) return '';
  return getTextInRange(content, range.start, range.end);
}

export function applyCodeEdit(store: DocumentStore, blockId: string, code: string, lang?: string) {
  store.updateAst((ast) => ({
    blocks: ast.blocks.map((b) => {
      if (b.id !== blockId) return b;
      if (b.type === 'code') return { ...b, code, lang: lang ?? b.lang };
      if (b.type === 'mermaid') return { ...b, code };
      return b;
    }),
  }));
}

export function applyTableResize(
  store: DocumentStore,
  blockId: string,
  cols: number,
  bodyRows: number
) {
  store.updateAst((ast) => ({
    blocks: ast.blocks.map((b) => {
      if (b.id !== blockId || b.type !== 'table') return b;
      const safeCols = Math.max(1, cols);
      const safeRows = Math.max(0, bodyRows);
      const headers = Array.from({ length: safeCols }, (_, i) => b.headers[i] ?? [{ text: '', marks: {} }]);
      const rows = Array.from({ length: safeRows }, (_, r) =>
        Array.from({ length: safeCols }, (_, c) => b.rows[r]?.[c] ?? [{ text: '', marks: {} }])
      );
      const colAligns = Array.from(
        { length: safeCols },
        (_, i) => b.colAligns?.[i] ?? 'left'
      ) as TableColAlign[];
      return { ...b, headers, rows, colAligns };
    }),
  }));
}

/** 表格单元格定位（表头或正文行） */
export type TableCellTarget =
  | { kind: 'header'; col: number }
  | { kind: 'body'; row: number; col: number };

/** 同步表格单元格纯文本到 AST */
export function applyTableCellEdit(
  store: DocumentStore,
  blockId: string,
  target: TableCellTarget,
  newPlain: string
) {
  const cell: InlineContent = [{ text: newPlain.replace(/[\r\n]+/g, ''), marks: {} }];
  store.updateAstFromTyping((ast) => ({
    blocks: ast.blocks.map((b) => {
      if (b.id !== blockId || b.type !== 'table') return b;
      if (target.kind === 'header') {
        const headers = b.headers.map((h, i) => (i === target.col ? cell : h));
        return { ...b, headers };
      }
      const rows = b.rows.map((row, ri) =>
        ri === target.row ? row.map((c, ci) => (ci === target.col ? cell : c)) : row
      );
      return { ...b, rows };
    }),
  }));
}

/**
 * 设置整张表格的列对齐（GFM 分隔行语法：每列一条 :--- / :---: / ---:）。
 * 编辑器内统一整表对齐；序列化时各列写入相同分隔符。
 */
export function applyTableAlign(
  store: DocumentStore,
  blockId: string,
  align: TableColAlign
) {
  store.updateAst((ast) => ({
    blocks: ast.blocks.map((b) => {
      if (b.id !== blockId || b.type !== 'table') return b;
      const colAligns = Array.from(
        { length: b.headers.length },
        () => align
      ) as TableColAlign[];
      return { ...b, colAligns };
    }),
  }));
}

/** 在表格后插入空段落并返回新块 id */
export function insertParagraphAfterTable(store: DocumentStore, tableBlockId: string): string {
  const newId = newBlockId();
  store.updateAst((ast) => {
    const idx = ast.blocks.findIndex((b) => b.id === tableBlockId);
    if (idx < 0) return ast;
    const blocks = [...ast.blocks];
    blocks.splice(idx + 1, 0, {
      type: 'paragraph',
      id: newId,
      content: [{ text: '', marks: {} }],
    });
    return { blocks };
  });
  return newId;
}

/** 表格单元格回车：下移同列或表后换行 */
export function handleTableCellEnter(
  store: DocumentStore,
  blockId: string,
  target: TableCellTarget,
  bodyRowCount: number
): void {
  if (target.kind === 'header') {
    if (bodyRowCount > 0) {
      focusTableCell(blockId, `r0-c${target.col}`);
    } else {
      focusTextBlock(insertParagraphAfterTable(store, blockId));
    }
    return;
  }

  if (target.row < bodyRowCount - 1) {
    focusTableCell(blockId, `r${target.row + 1}-c${target.col}`);
    return;
  }

  focusTextBlock(insertParagraphAfterTable(store, blockId));
}
