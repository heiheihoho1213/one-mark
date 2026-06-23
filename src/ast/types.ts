/** 行内样式标记（块级标题与行内样式分离） */
export interface InlineMark {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  /** Markdown 链接目标 URL */
  link?: string;
}

/** 行内文本片段 */
export interface TextSegment {
  text: string;
  marks: InlineMark;
}

export type InlineContent = TextSegment[];

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'blockquote'
  | 'code'
  | 'mermaid'
  | 'table'
  | 'list'
  | 'thematicBreak';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: InlineContent;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  content: InlineContent;
}

export interface BlockquoteBlock extends BaseBlock {
  type: 'blockquote';
  content: InlineContent;
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  lang: string;
  code: string;
}

export interface MermaidBlock extends BaseBlock {
  type: 'mermaid';
  code: string;
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  headers: InlineContent[];
  rows: InlineContent[][];
  /** 各列对齐（对应 GFM 第二行分隔符 :--- / :---: / ---:，预览按列渲染） */
  colAligns?: TableColAlign[];
}

export type TableColAlign = 'left' | 'center' | 'right';

export interface ListItem {
  content: InlineContent;
  children?: ListBlock;
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export interface ThematicBreakBlock extends BaseBlock {
  type: 'thematicBreak';
}

export type BlockNode =
  | ParagraphBlock
  | HeadingBlock
  | BlockquoteBlock
  | CodeBlock
  | MermaidBlock
  | TableBlock
  | ListBlock
  | ThematicBreakBlock;

export interface DocumentAst {
  blocks: BlockNode[];
}

/** 即时渲染选区：块内纯文本偏移；blockSelected 表示整块选中（如图片） */
export interface EditorSelection {
  blockId: string;
  anchor: number;
  focus: number;
  blockSelected?: boolean;
}

export function newBlockId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
