import React, { useRef, useEffect, useLayoutEffect } from 'react';
import type { InlineContent } from '../../ast/types';
import { plainTextOf } from '../../ast/inline';
import { attachNoDragGuards, getTextOffsets, schedulePostCompositionSync, setTextOffsets } from '../../utils/keyboardInputGuard';
import { restoreBlockSelection } from '../../utils/selectionSync';
import type { DocumentStore } from '../../document/DocumentStore';
import { applyInlineContentEdit } from '../../commands/formatCommands';
import { domToInlineContent, inlineContentToHtml } from '../../utils/inlineDom';
import { deleteEmptyParagraph } from '../../utils/blockSelection';

/** 统一读取 contenteditable 纯文本（去掉末尾换行差异） */
function normalizePlain(text: string): string {
  return text.replace(/\n$/, '');
}

interface EditableTextBlockProps {
  blockId: string;
  content: InlineContent;
  store: DocumentStore;
  className?: string;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'blockquote';
}

/** 可键盘编辑的文本块：禁止鼠标拖拽改字，可选区后走工具栏 */
function EditableTextBlock({
  blockId,
  content,
  store,
  className = '',
  as = 'p',
}: EditableTextBlockProps) {
  const ref = useRef<HTMLElement>(null);
  const committedPlain = useRef(plainTextOf(content));
  const isComposing = useRef(false);
  const skipNextInput = useRef(false);
  const suppressSelectionReport = useRef(false);
  /** 本次输入后待恢复的光标（防止 React 重渲染把光标打回段首） */
  const pendingCaretRef = useRef<{ anchor: number; focus: number } | null>(null);

  /** 将 store 选区写回 DOM，工具栏改样式后保持文字高亮 */
  const restoreDomSelection = (el: HTMLElement) => {
    const pending = store.peekPendingRestoreSelection(blockId);
    const sel = pending ?? store.getState().selection;
    if (!sel || sel.blockId !== blockId || sel.anchor === sel.focus) return;

    suppressSelectionReport.current = true;
    restoreBlockSelection(el, sel);
    store.clearPendingRestoreSelection();
    suppressSelectionReport.current = false;
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isComposing.current) return;

    const plain = plainTextOf(content);
    const nextHtml = inlineContentToHtml(content);
    const isFocused = document.activeElement === el;

    if (isFocused) {
      // 键盘输入触发的 store 更新：优先恢复光标，必要时补全被 React 清空的 DOM
      if (pendingCaretRef.current) {
        const caret = pendingCaretRef.current;
        pendingCaretRef.current = null;
        if (normalizePlain(el.innerText) !== plain) {
          skipNextInput.current = true;
          el.innerHTML = nextHtml;
        }
        setTextOffsets(el, caret.anchor, caret.focus);
        committedPlain.current = plain;
        return;
      }

      const pending = store.peekPendingRestoreSelection(blockId);
      if (pending) {
        skipNextInput.current = true;
        el.innerHTML = nextHtml;
        suppressSelectionReport.current = true;
        restoreBlockSelection(el, pending);
        store.clearPendingRestoreSelection();
        suppressSelectionReport.current = false;
        committedPlain.current = plain;
        return;
      }

      const domPlain = normalizePlain(el.innerText);
      if (domPlain !== plain) {
        const caret = getTextOffsets(el);
        skipNextInput.current = true;
        el.innerHTML = nextHtml;
        if (caret) {
          const pos = Math.min(caret.focus, plain.length);
          setTextOffsets(el, pos, pos);
        }
        committedPlain.current = plain;
        return;
      }

      committedPlain.current = domPlain;
      return;
    }

    committedPlain.current = plain;
    skipNextInput.current = true;
    el.innerHTML = nextHtml;
    restoreDomSelection(el);
  }, [content, blockId, store]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachNoDragGuards(el);
  }, []);

  const reportSelection = () => {
    if (suppressSelectionReport.current) return;
    const el = ref.current;
    if (!el) return;
    const offsets = getTextOffsets(el);
    if (!offsets) return;

    const existing = store.getState().selection;
    const domCollapsed = offsets.anchor === offsets.focus;
    const storeExpanded =
      existing?.blockId === blockId && existing.anchor !== existing.focus;
    if (domCollapsed && storeExpanded) return;

    store.setSelection({ blockId, anchor: offsets.anchor, focus: offsets.focus, blockSelected: false });
  };

  const syncToStore = () => {
    const el = ref.current;
    if (!el) return;
    const newContent = domToInlineContent(el);
    const newPlain = plainTextOf(newContent);
    if (newPlain === committedPlain.current && JSON.stringify(newContent) === JSON.stringify(content)) return;
    pendingCaretRef.current = getTextOffsets(el);
    committedPlain.current = newPlain;
    applyInlineContentEdit(store, blockId, newContent);
  };

  const handleInput = () => {
    if (isComposing.current || skipNextInput.current) {
      skipNextInput.current = false;
      return;
    }
    syncToStore();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Backspace' || isComposing.current) return;
    const el = ref.current;
    if (!el) return;
    const offsets = getTextOffsets(el);
    if (!offsets || offsets.anchor !== 0 || offsets.focus !== 0) return;
    if (normalizePlain(el.innerText).length > 0) return;
    if (deleteEmptyParagraph(store, blockId)) {
      e.preventDefault();
    }
  };

  const Tag = as;

  return (
    <Tag
      ref={ref as React.RefObject<HTMLParagraphElement>}
      data-block-id={blockId}
      contentEditable
      suppressContentEditableWarning
      draggable={false}
      className={`outline-none ${className} ${plainTextOf(content) ? 'min-h-[1.75rem]' : ''}`}
      onSelect={reportSelection}
      onKeyUp={reportSelection}
      onMouseUp={reportSelection}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={() => {
        isComposing.current = false;
        schedulePostCompositionSync(syncToStore);
      }}
      onInput={handleInput}
      onPaste={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    />
  );
}

function arePropsEqual(a: EditableTextBlockProps, b: EditableTextBlockProps): boolean {
  return (
    a.blockId === b.blockId &&
    a.as === b.as &&
    a.className === b.className &&
    a.store === b.store &&
    JSON.stringify(a.content) === JSON.stringify(b.content)
  );
}

export default React.memo(EditableTextBlock, arePropsEqual);
