/** 聚焦表格指定单元格（data-table-cell） */
export function focusTableCell(blockId: string, cellKey: string): void {
  requestAnimationFrame(() => {
    const el = document.querySelector(
      `[data-block-id="${blockId}"][data-table-cell="${cellKey}"]`
    ) as HTMLElement | null;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });
}

/** 聚焦文本块开头（段落/标题等，不含图片块） */
export function focusTextBlock(blockId: string): void {
  requestAnimationFrame(() => {
    const el = document.querySelector(
      `[data-block-id="${blockId}"][contenteditable="true"]`
    ) as HTMLElement | null;
    if (!el) return;
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });
}
