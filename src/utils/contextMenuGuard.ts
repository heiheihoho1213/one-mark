/** 是否保留 WebView 默认右键菜单（仅可编辑区与表单控件） */
export function shouldAllowNativeContextMenu(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('[contenteditable="true"], input, textarea, select');
}

/** 空白区域禁止系统右键菜单（Reload / 检查元素等） */
export function blockNativeContextMenuUnlessAllowed(e: MouseEvent): void {
  if (shouldAllowNativeContextMenu(e.target)) return;
  e.preventDefault();
}
