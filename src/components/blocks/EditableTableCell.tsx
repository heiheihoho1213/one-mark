import React, { useRef, useEffect, useLayoutEffect } from 'react';
import type { InlineContent, TableColAlign } from '../../ast/types';
import { plainTextOf } from '../../ast/inline';
import { attachNoDragGuards, schedulePostCompositionSync } from '../../utils/keyboardInputGuard';
import { clearBlockSelection } from '../../utils/blockSelection';
import type { DocumentStore } from '../../document/DocumentStore';
import {
  applyTableCellEdit,
  handleTableCellEnter,
  type TableCellTarget,
} from '../../commands/formatCommands';

interface EditableTableCellProps {
  blockId: string;
  store: DocumentStore;
  content: InlineContent;
  target: TableCellTarget;
  as?: 'th' | 'td';
  className?: string;
  compact?: boolean;
  align?: TableColAlign;
  bodyRowCount?: number;
}

function alignClasses(align: TableColAlign): string {
  if (align === 'center') return 'justify-center text-center';
  if (align === 'right') return 'justify-end text-right';
  return 'justify-start text-left';
}

/** 可编辑表格单元格：保证空行有最小高度，可点击输入 */
export default function EditableTableCell({
  blockId,
  store,
  content,
  target,
  as: Tag = 'td',
  className = '',
  compact = false,
  align = 'left',
  bodyRowCount = 0,
}: EditableTableCellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const committedPlain = useRef(plainTextOf(content));
  const skipNextInput = useRef(false);
  const isComposing = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isComposing.current) return;
    const plain = plainTextOf(content);
    if (document.activeElement === el) {
      committedPlain.current = plain;
      return;
    }
    committedPlain.current = plain;
    skipNextInput.current = true;
    el.textContent = plain;
  }, [content]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachNoDragGuards(el);
  }, []);

  const handleInput = () => {
    if (isComposing.current || skipNextInput.current) {
      skipNextInput.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    const newPlain = (el.textContent || '').replace(/[\r\n]+/g, '');
    if (newPlain !== el.textContent) {
      el.textContent = newPlain;
    }
    if (newPlain === committedPlain.current) return;
    committedPlain.current = newPlain;
    applyTableCellEdit(store, blockId, target, newPlain);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || isComposing.current) return;
    e.preventDefault();
    handleInput();
    handleTableCellEnter(store, blockId, target, bodyRowCount);
  };

  const cellKey =
    target.kind === 'header' ? `h-${target.col}` : `r${target.row}-c${target.col}`;

  return (
    <Tag
      className={`max-w-0 border border-brand-border/50 p-0 align-middle ${compact ? 'h-8' : ''} ${className}`}
    >
      <div
        className={`flex items-center px-2 ${compact ? 'h-8' : 'min-h-[1.75rem] py-1'} ${alignClasses(align)}`}
      >
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          draggable={false}
          data-block-id={blockId}
          data-table-cell={cellKey}
          className={`w-full min-w-0 cursor-text overflow-x-auto overflow-y-hidden whitespace-nowrap outline-none ${alignClasses(align)}`}
          onFocus={() => clearBlockSelection(store)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={() => {
            isComposing.current = false;
            schedulePostCompositionSync(handleInput);
          }}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain').replace(/[\r\n]+/g, '');
            document.execCommand('insertText', false, text);
          }}
        />
      </div>
    </Tag>
  );
}
