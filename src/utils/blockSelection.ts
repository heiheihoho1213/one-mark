import type { DocumentStore } from '../document/DocumentStore';
import { newBlockId } from '../ast/types';
import { plainTextOf } from '../ast/inline';
import { isEditableTextBlock, isStructuralBlock } from './blockEdit';
import { parseImageParagraph } from './imageBlock';
import { focusTextBlock } from './tableNavigation';
import { setTextOffsets } from './keyboardInputGuard';

/** 聚焦结构块容器（图片/代码/表格等） */
export function focusStructuralBlock(blockId: string): void {
  requestAnimationFrame(() => {
    const el = document.querySelector(
      `.wysiwyg-structural-block[data-block-id="${blockId}"]`
    ) as HTMLElement | null;
    el?.focus({ preventScroll: true });
  });
}

/** 选中整块（图片/代码/表格等） */
export function selectBlock(store: DocumentStore, blockId: string): void {
  window.getSelection()?.removeAllRanges();
  store.setSelection({ blockId, anchor: 0, focus: 0, blockSelected: true });
  focusStructuralBlock(blockId);
}

/** 清除整块选中 */
export function clearBlockSelection(store: DocumentStore): void {
  const sel = store.getState().selection;
  if (sel?.blockSelected) {
    store.setSelection(null);
  }
}

/** 在指定块后插入空段落 */
export function insertParagraphAfterBlock(store: DocumentStore, afterBlockId: string): string {
  const newId = newBlockId();
  store.updateAst((ast) => {
    const idx = ast.blocks.findIndex((b) => b.id === afterBlockId);
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

/** 聚焦下一段可编辑文字；若无则在其后插入空段落 */
export function focusOrInsertParagraphAfter(store: DocumentStore, blockId: string): void {
  const ast = store.getState().ast;
  const idx = ast.blocks.findIndex((b) => b.id === blockId);
  if (idx < 0) return;

  const next = ast.blocks[idx + 1];
  let targetId: string;
  if (next && isEditableTextBlock(next)) {
    targetId = next.id;
  } else {
    targetId = insertParagraphAfterBlock(store, blockId);
  }

  store.setSelection({ blockId: targetId, anchor: 0, focus: 0, blockSelected: false });
  focusTextBlock(targetId);
}

/** 删除指定块，并聚焦相邻块 */
export function deleteBlock(store: DocumentStore, blockId: string): void {
  const ast = store.getState().ast;
  const idx = ast.blocks.findIndex((b) => b.id === blockId);
  if (idx < 0) return;

  const prev = ast.blocks[idx - 1];
  const next = ast.blocks[idx + 1];

  store.updateAst((draft) => {
    let blocks = draft.blocks.filter((b) => b.id !== blockId);
    if (blocks.length === 0) {
      blocks = [{ type: 'paragraph', id: newBlockId(), content: [{ text: '', marks: {} }] }];
    }
    return { blocks };
  });

  focusNeighborAfterDelete(store, prev, next);
}

/** 删除光标处的空段落（Backspace 触发） */
export function deleteEmptyParagraph(store: DocumentStore, blockId: string): boolean {
  const ast = store.getState().ast;
  const block = ast.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== 'paragraph' || parseImageParagraph(block.content)) return false;
  if (plainTextOf(block.content).length > 0) return false;

  const idx = ast.blocks.findIndex((b) => b.id === blockId);
  const prev = ast.blocks[idx - 1];
  const next = ast.blocks[idx + 1];

  store.updateAst((draft) => {
    let blocks = draft.blocks.filter((b) => b.id !== blockId);
    if (blocks.length === 0) {
      blocks = [{ type: 'paragraph', id: newBlockId(), content: [{ text: '', marks: {} }] }];
    }
    return { blocks };
  });

  focusNeighborAfterDelete(store, prev, next);
  return true;
}

function focusNeighborAfterDelete(
  store: DocumentStore,
  prev: import('../ast/types').BlockNode | undefined,
  next: import('../ast/types').BlockNode | undefined
): void {
  if (prev && isStructuralBlock(prev)) {
    selectBlock(store, prev.id);
    return;
  }
  if (prev && isEditableTextBlock(prev)) {
    const len = plainTextOf(prev.content).length;
    store.setSelection({ blockId: prev.id, anchor: len, focus: len, blockSelected: false });
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-block-id="${prev.id}"][contenteditable="true"]`
      ) as HTMLElement | null;
      if (!el) return;
      el.focus({ preventScroll: true });
      setTextOffsets(el, len, len);
    });
    return;
  }
  if (next && isEditableTextBlock(next)) {
    store.setSelection({ blockId: next.id, anchor: 0, focus: 0, blockSelected: false });
    focusTextBlock(next.id);
    return;
  }
  if (next && isStructuralBlock(next)) {
    selectBlock(store, next.id);
    return;
  }
  store.setSelection(null);
}

/** 结构块键盘：回车下方续写、Delete 删除整块 */
export function handleStructuralBlockKeyDown(
  store: DocumentStore,
  blockId: string,
  e: React.KeyboardEvent
): void {
  if (e.key === 'Enter') {
    e.preventDefault();
    focusOrInsertParagraphAfter(store, blockId);
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    deleteBlock(store, blockId);
  }
}

/** @deprecated 使用 handleStructuralBlockKeyDown */
export const handleImageBlockKeyDown = handleStructuralBlockKeyDown;
