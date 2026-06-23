/** 允许键盘输入，禁止鼠标拖拽改字 */
const KEYBOARD_INPUT_TYPES = new Set([
  'insertText',
  'insertReplacementText',
  'deleteContentBackward',
  'deleteContentForward',
  'deleteWordBackward',
  'deleteWordForward',
  'insertLineBreak',
  'insertParagraph',
]);

/** 输入法（IME）组合阶段使用的 inputType */
const IME_INPUT_TYPES = new Set([
  'insertCompositionText',
  'deleteCompositionText',
  'insertFromComposition',
]);

export function isKeyboardInputType(inputType: string): boolean {
  return KEYBOARD_INPUT_TYPES.has(inputType);
}

/** 是否允许该 beforeinput 通过（含 IME 组合输入） */
export function isAllowedBeforeInput(inputType: string, isComposing: boolean): boolean {
  if (!inputType) return true;
  if (isComposing) return true;
  return isKeyboardInputType(inputType) || IME_INPUT_TYPES.has(inputType);
}

/** 阻止拖拽、拖放、鼠标改字 */
export function attachNoDragGuards(el: HTMLElement) {
  const prevent = (e: Event) => e.preventDefault();
  // 元素级组合态标记，弥补部分 WebView 未设置 isComposing 的情况
  let composing = false;

  const onCompositionStart = () => {
    composing = true;
  };
  const onCompositionEnd = () => {
    composing = false;
  };

  const onBeforeInput = (e: InputEvent) => {
    const t = e.inputType || '';
    if (t.includes('Drag') || t.includes('drop') || t === 'insertFromDrop' || t === 'insertFromPaste') {
      e.preventDefault();
      return;
    }
    if (!isAllowedBeforeInput(t, e.isComposing || composing)) {
      e.preventDefault();
    }
  };

  el.addEventListener('compositionstart', onCompositionStart);
  el.addEventListener('compositionend', onCompositionEnd);
  el.addEventListener('dragstart', prevent);
  el.addEventListener('drag', prevent);
  el.addEventListener('drop', prevent);
  el.addEventListener('dragover', prevent);
  el.addEventListener('beforeinput', onBeforeInput as EventListener);

  return () => {
    el.removeEventListener('compositionstart', onCompositionStart);
    el.removeEventListener('compositionend', onCompositionEnd);
    el.removeEventListener('dragstart', prevent);
    el.removeEventListener('drag', prevent);
    el.removeEventListener('drop', prevent);
    el.removeEventListener('dragover', prevent);
    el.removeEventListener('beforeinput', onBeforeInput as EventListener);
  };
}

/** 从 contenteditable 根节点计算选区纯文本偏移 */
export function getTextOffsets(root: HTMLElement): { anchor: number; focus: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null;

  const measure = (node: Node, offset: number): number => {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);
    return range.toString().length;
  };

  return {
    anchor: measure(sel.anchorNode, sel.anchorOffset),
    focus: measure(sel.focusNode, sel.focusOffset),
  };
}

/** 按纯文本偏移在 contenteditable 根节点内恢复选区 */
export function setTextOffsets(root: HTMLElement, anchor: number, focus: number): boolean {
  const findPosition = (targetOffset: number): { node: Node; offset: number } | null => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = targetOffset;
    let node: Node | null = null;

    while ((node = walker.nextNode())) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        return { node, offset: remaining };
      }
      remaining -= len;
    }

    // 偏移落在文末：锚定到最后一个文本节点末尾
    const endWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last: Node | null = null;
    while ((node = endWalker.nextNode())) last = node;
    if (last) {
      return { node: last, offset: last.textContent?.length ?? 0 };
    }
    return { node: root, offset: 0 };
  };

  const anchorPos = findPosition(anchor);
  const focusPos = findPosition(focus);
  if (!anchorPos || !focusPos) return false;

  const sel = window.getSelection();
  if (!sel) return false;

  try {
    // setBaseAndExtent 可正确处理反向选区，比 Range 更可靠
    sel.setBaseAndExtent(anchorPos.node, anchorPos.offset, focusPos.node, focusPos.offset);
    return true;
  } catch {
    const range = document.createRange();
    try {
      const start = Math.min(anchor, focus);
      const end = Math.max(anchor, focus);
      const startPos = findPosition(start);
      const endPos = findPosition(end);
      if (!startPos || !endPos) return false;
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  }
}

/** IME 组合结束后延迟一帧再读 DOM，等浏览器完成上屏 */
export function schedulePostCompositionSync(sync: () => void): void {
  requestAnimationFrame(() => {
    sync();
  });
}
