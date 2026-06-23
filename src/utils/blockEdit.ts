import type { BlockNode } from '../ast/types';
import type { EditorSelection } from '../ast/types';
import { parseImageParagraph } from './imageBlock';

/** 是否为用户可直接输入文字的块（排除图片段落、代码块等） */
export function isEditableTextBlock(block: BlockNode): boolean {
  if (block.type === 'paragraph') {
    return !parseImageParagraph(block.content);
  }
  return block.type === 'heading' || block.type === 'blockquote';
}

/** 是否为可整块选中的结构块（仅图片段落） */
export function isStructuralBlock(block: BlockNode): boolean {
  return block.type === 'paragraph' && !!parseImageParagraph(block.content);
}

/** 当前选区是否为指定块的整块选中 */
export function isBlockSelected(selection: EditorSelection | null, blockId: string): boolean {
  return !!selection?.blockSelected && selection.blockId === blockId;
}
