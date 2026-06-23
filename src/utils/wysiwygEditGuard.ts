/** 工具栏正在修改 WYSIWYG 块时递增；为 0 时禁止 contenteditable 被键盘/鼠标直接改写 */
let toolbarEditingDepth = 0;

export function isToolbarEditing(): boolean {
  return toolbarEditingDepth > 0;
}

export function beginToolbarEdit(): void {
  toolbarEditingDepth += 1;
}

export function endToolbarEdit(): void {
  toolbarEditingDepth = Math.max(0, toolbarEditingDepth - 1);
}

/** 允许方向键、翻页、复制、全选等，仅拦截会改内容的按键 */
export function isNavigationOrCopyKey(e: React.KeyboardEvent | KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (['a', 'c', 'z', 'y'].includes(key)) return true;
  }
  const passthrough = [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End', 'PageUp', 'PageDown',
    'Escape', 'Tab', 'Shift', 'Control', 'Meta', 'Alt',
  ];
  return passthrough.includes(e.key);
}
