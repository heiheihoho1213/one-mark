import React, { useState } from 'react';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, Heading4, Quote,
  List, ListOrdered, Code, Terminal, Link, Image, Table,
  Undo2, Redo2,
} from 'lucide-react';
import type { DocumentStore } from '../document/DocumentStore';
import { syncDomSelectionToStore } from '../utils/selectionSync';
import {
  executeFormatCommand,
  queryActiveFormats,
  getSelectedPlainText,
} from '../commands/formatCommands';
import InsertLinkDialog from './InsertLinkDialog';
import InsertImageDialog from './InsertImageDialog';

interface ToolbarProps {
  store: DocumentStore;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export default function Toolbar({
  store,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: ToolbarProps) {
  const activeStyles = queryActiveFormats(store);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [linkDefaultText, setLinkDefaultText] = useState('');

  const tools = [
    {
      icon: Bold,
      label: '粗体',
      action: () => executeFormatCommand(store, { type: 'toggleBold' }),
      active: activeStyles.bold,
    },
    {
      icon: Italic,
      label: '斜体',
      action: () => executeFormatCommand(store, { type: 'toggleItalic' }),
      active: activeStyles.italic,
    },
    {
      icon: Strikethrough,
      label: '删除线',
      action: () => executeFormatCommand(store, { type: 'toggleStrike' }),
      active: activeStyles.strikethrough,
    },
    { divider: true },
    {
      icon: Heading1,
      label: 'H1',
      action: () => executeFormatCommand(store, { type: 'setHeading', level: 1 }),
      active: activeStyles.h1,
    },
    {
      icon: Heading2,
      label: 'H2',
      action: () => executeFormatCommand(store, { type: 'setHeading', level: 2 }),
      active: activeStyles.h2,
    },
    {
      icon: Heading3,
      label: 'H3',
      action: () => executeFormatCommand(store, { type: 'setHeading', level: 3 }),
      active: activeStyles.h3,
    },
    {
      icon: Heading4,
      label: 'H4',
      action: () => executeFormatCommand(store, { type: 'setHeading', level: 4 }),
      active: activeStyles.h4,
    },
    {
      icon: Quote,
      label: '引用',
      action: () => executeFormatCommand(store, { type: 'toggleBlockquote' }),
      active: activeStyles.blockquote,
    },
    { divider: true },
    {
      icon: List,
      label: '无序列表',
      action: () => executeFormatCommand(store, { type: 'toggleUl' }),
      active: activeStyles.ul,
    },
    {
      icon: ListOrdered,
      label: '有序列表',
      action: () => executeFormatCommand(store, { type: 'toggleOl' }),
      active: activeStyles.ol,
    },
    { divider: true },
    {
      icon: Code,
      label: '行内代码',
      action: () => executeFormatCommand(store, { type: 'toggleInlineCode' }),
      active: activeStyles.code,
    },
    {
      icon: Terminal,
      label: '代码块',
      action: () => executeFormatCommand(store, { type: 'insertCodeBlock' }),
      active: false,
    },
    { divider: true },
    {
      icon: Link,
      label: '链接',
      action: () => {
        setLinkDefaultText(getSelectedPlainText(store));
        setLinkOpen(true);
      },
      active: false,
    },
    {
      icon: Image,
      label: '图片',
      action: () => setImageOpen(true),
      active: false,
    },
    {
      icon: Table,
      label: '表格',
      action: () => executeFormatCommand(store, { type: 'insertTable' }),
      active: false,
    },
  ];

  return (
    <>
      <div id="vditor-toolbar" className="flex flex-wrap items-center border-b border-brand-border bg-brand-cream px-4 py-2.5 text-gray-700 dark:text-neutral-300 dark:border-neutral-800/80 select-none">
        <div className="flex flex-wrap items-center gap-1">
          <button
            id="btn-undo"
            onClick={onUndo}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!canUndo}
            className={`rounded p-1.5 ${canUndo ? 'cursor-pointer hover:bg-brand-border/40' : 'cursor-not-allowed opacity-40'}`}
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            id="btn-redo"
            onClick={onRedo}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!canRedo}
            className={`rounded p-1.5 ${canRedo ? 'cursor-pointer hover:bg-brand-border/40' : 'cursor-not-allowed opacity-40'}`}
            title="重做 (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>

          <div className="mx-1 h-4 w-[1px] bg-brand-border dark:bg-neutral-800" />

          {tools.map((tool, idx) => {
            if (tool.divider) {
              return <div key={`div-${idx}`} className="mx-1 h-4 w-[1px] bg-brand-border dark:bg-neutral-800" />;
            }
            const Icon = tool.icon!;
            return (
              <button
                key={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  syncDomSelectionToStore(store);
                  tool.action?.();
                }}
                className={`rounded p-1.5 border cursor-pointer ${
                  tool.active
                    ? 'bg-brand-rust/10 border-brand-rust/30 text-brand-rust'
                    : 'border-transparent hover:bg-brand-border/40'
                }`}
                title={tool.label}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>

      <InsertLinkDialog
        open={linkOpen}
        defaultText={linkDefaultText}
        onCancel={() => setLinkOpen(false)}
        onConfirm={(url, text) => {
          executeFormatCommand(store, { type: 'insertLink', url, text });
          setLinkOpen(false);
        }}
      />

      <InsertImageDialog
        open={imageOpen}
        onCancel={() => setImageOpen(false)}
        onConfirm={(url, alt) => {
          executeFormatCommand(store, { type: 'insertImage', url, alt });
          setImageOpen(false);
        }}
      />
    </>
  );
}
