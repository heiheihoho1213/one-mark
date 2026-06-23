import type { BlockNode, DocumentAst, InlineContent, ListBlock, TableColAlign } from './types';
import { serializeInline } from './inline';

function serializeList(block: ListBlock): string {
  return block.items
    .map((item, idx) => {
      const prefix = block.ordered ? `${idx + 1}. ` : '- ';
      return `${prefix}${serializeInline(item.content)}`;
    })
    .join('\n');
}

function serializeTableAlign(align: TableColAlign): string {
  if (align === 'center') return ':---:';
  if (align === 'right') return '---:';
  return '---';
}

function serializeTable(block: Extract<BlockNode, { type: 'table' }>): string {
  const aligns = block.colAligns ?? block.headers.map(() => 'left' as TableColAlign);
  const headerLine = `| ${block.headers.map((h) => serializeInline(h)).join(' | ')} |`;
  const sep = `| ${block.headers.map((_, i) => serializeTableAlign(aligns[i] ?? 'left')).join(' | ')} |`;
  const rows = block.rows.map((row) => {
    const cells = block.headers.map((_, i) => serializeInline(row[i] ?? [{ text: '', marks: {} }]));
    return `| ${cells.join(' | ')} |`;
  });
  return [headerLine, sep, ...rows].join('\n');
}

function serializeBlock(block: BlockNode): string {
  switch (block.type) {
    case 'paragraph':
      return serializeInline(block.content);
    case 'heading':
      return `${'#'.repeat(block.level)} ${serializeInline(block.content)}`;
    case 'blockquote':
      return `> ${serializeInline(block.content)}`;
    case 'code':
      return `\`\`\`${block.lang}\n${block.code}\n\`\`\``;
    case 'mermaid':
      return `\`\`\`mermaid\n${block.code}\n\`\`\``;
    case 'table':
      return serializeTable(block);
    case 'list':
      return serializeList(block);
    case 'thematicBreak':
      return '---';
    default:
      return '';
  }
}

/** 将 AST 序列化为持久化 Markdown */
export function serializeDocument(ast: DocumentAst): string {
  return ast.blocks.map(serializeBlock).join('\n\n');
}

export function emptyInline(): InlineContent {
  return [{ text: '', marks: {} }];
}
