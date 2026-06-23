import type { DocumentStore } from '../document/DocumentStore';
import type { EditorSelection } from '../ast/types';
import { getTextOffsets, setTextOffsets } from './keyboardInputGuard';

/** 从 DOM 选区同步到 store；若 DOM 已折叠则保留 store 中已有的非折叠选区 */
export function syncDomSelectionToStore(store: DocumentStore): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  let node: Node | null = sel.anchorNode;
  while (node) {
    if (node instanceof HTMLElement && node.dataset.blockId) {
      const offsets = getTextOffsets(node);
      if (!offsets) return;

      const existing = store.getState().selection;
      const domCollapsed = offsets.anchor === offsets.focus;
      const storeExpanded =
        existing &&
        existing.blockId === node.dataset.blockId &&
        existing.anchor !== existing.focus;

      // 工具栏 mousedown 时浏览器常先折叠 DOM 选区，勿用其覆盖 store
      if (domCollapsed && storeExpanded) return;

      store.setSelection({
        blockId: node.dataset.blockId,
        anchor: offsets.anchor,
        focus: offsets.focus,
        blockSelected: false,
      });
      return;
    }
    node = node.parentNode;
  }
}

/** 将指定选区写回块 DOM；先设选区再聚焦，避免 focus() 折叠选区 */
export function restoreBlockSelection(el: HTMLElement, selection: EditorSelection): void {
  if (selection.blockId !== el.dataset.blockId) return;
  if (selection.anchor === selection.focus) return;

  const apply = () => {
    setTextOffsets(el, selection.anchor, selection.focus);
    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
      setTextOffsets(el, selection.anchor, selection.focus);
    }
  };

  apply();
  requestAnimationFrame(apply);
}
