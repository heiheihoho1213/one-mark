import React, { useState, useEffect } from 'react';
import { 
  Bold, Italic, Strikethrough, Heading1, Heading2, Quote, 
  List, ListOrdered, Code, Terminal, Link, Image, Table, 
  Eye, EyeOff, LayoutGrid, Sparkles, Undo2, Redo2, HelpCircle
} from 'lucide-react';

interface ToolbarProps {
  onInsertMarkdown: (prefix: string, suffix: string, defaultText: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  editorMode: 'split' | 'wysiwyg' | 'source';
  onChangeEditorMode: (mode: 'split' | 'wysiwyg' | 'source') => void;
}

export default function Toolbar({
  onInsertMarkdown,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  editorMode,
  onChangeEditorMode,
}: ToolbarProps) {
  const [activeStyles, setActiveStyles] = useState<{
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    h1: boolean;
    h2: boolean;
    blockquote: boolean;
    ul: boolean;
    ol: boolean;
    code: boolean;
  }>({
    bold: false,
    italic: false,
    strikethrough: false,
    h1: false,
    h2: false,
    blockquote: false,
    ul: false,
    ol: false,
    code: false,
  });

  useEffect(() => {
    const handleSelectionChange = () => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
        try {
          const isBold = document.queryCommandState('bold');
          const isItalic = document.queryCommandState('italic');
          const isStrikethrough = document.queryCommandState('strikethrough') || document.queryCommandState('strikeThrough');
          
          const blockType = document.queryCommandValue('formatBlock') || '';
          const lowercaseBlock = blockType.toLowerCase();
          const isH1 = lowercaseBlock === 'h1' || lowercaseBlock === 'heading 1';
          const isH2 = lowercaseBlock === 'h2' || lowercaseBlock === 'heading 2';
          const isBlockquote = lowercaseBlock === 'blockquote';
          
          const isUl = document.queryCommandState('insertUnorderedList');
          const isOl = document.queryCommandState('insertOrderedList');

          // Check if cursor is inside <code> tag (inline code)
          const selection = window.getSelection();
          let isCode = false;
          if (selection && selection.rangeCount > 0) {
            const container = selection.getRangeAt(0).commonAncestorContainer;
            const parent = container.nodeType === 3 ? container.parentElement : container as HTMLElement;
            if (parent && (parent.closest('code') || parent.closest('pre'))) {
              isCode = true;
            }
          }

          setActiveStyles({
            bold: isBold,
            italic: isItalic,
            strikethrough: isStrikethrough,
            h1: isH1,
            h2: isH2,
            blockquote: isBlockquote,
            ul: isUl,
            ol: isOl,
            code: isCode,
          });
        } catch (e) {
          // ignore
        }
      } else if (activeElement && activeElement.tagName.toLowerCase() === 'textarea') {
        const textarea = activeElement as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        
        const hasWrapper = (wrapper: string) => {
          if (start === end) {
            const before = val.substring(Math.max(0, start - wrapper.length), start);
            const after = val.substring(end, Math.min(val.length, end + wrapper.length));
            return before === wrapper && after === wrapper;
          }
          const selected = val.substring(start, end);
          return selected.startsWith(wrapper) && selected.endsWith(wrapper);
        };

        const currentLine = val.substring(0, start).split('\n').pop() || '';

        setActiveStyles({
          bold: hasWrapper('**') || hasWrapper('__'),
          italic: (hasWrapper('*') && !hasWrapper('**')) || (hasWrapper('_') && !hasWrapper('__')),
          strikethrough: hasWrapper('~~'),
          h1: currentLine.startsWith('# '),
          h2: currentLine.startsWith('## '),
          blockquote: currentLine.startsWith('> '),
          ul: currentLine.startsWith('- ') || currentLine.startsWith('* '),
          ol: /^\d+\.\s+/.test(currentLine),
          code: hasWrapper('`'),
        });
      } else {
        setActiveStyles({
          bold: false,
          italic: false,
          strikethrough: false,
          h1: false,
          h2: false,
          blockquote: false,
          ul: false,
          ol: false,
          code: false,
        });
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleWYSIWYGFormat = (
    command: string,
    value: string = '',
    prefix: string = '',
    suffix: string = '',
    defaultText: string = ''
  ) => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
      if (command === 'inline-code') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const text = range.toString() || defaultText;
          
          const parentElement = range.commonAncestorContainer.parentElement;
          if (parentElement && parentElement.tagName.toLowerCase() === 'code') {
            const textNode = document.createTextNode(parentElement.textContent || '');
            parentElement.replaceWith(textNode);
          } else {
            const codeElement = document.createElement('code');
            codeElement.textContent = text;
            range.deleteContents();
            range.insertNode(codeElement);
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNode(codeElement);
            selection.addRange(newRange);
          }
        }
      } else if (command === 'code-block') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const text = range.toString() || '// 在此编写代码';
          const preElement = document.createElement('pre');
          const codeElement = document.createElement('code');
          codeElement.textContent = text;
          preElement.appendChild(codeElement);
          range.deleteContents();
          range.insertNode(preElement);
        }
      } else if (command === 'table') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const tableHtml = `
            <table>
              <thead>
                <tr><th>表头1</th><th>表头2</th><th>表头3</th></tr>
              </thead>
              <tbody>
                <tr><td>内容1</td><td>内容2</td><td>内容3</td></tr>
              </tbody>
            </table>
          `;
          const temp = document.createElement('div');
          temp.innerHTML = tableHtml.trim();
          const tableElement = temp.firstChild;
          if (tableElement) {
            range.deleteContents();
            range.insertNode(tableElement);
          }
        }
      } else if (command === 'formatBlock' && value === '<blockquote>') {
        const blockType = document.queryCommandValue('formatBlock') || '';
        if (blockType.toLowerCase() === 'blockquote') {
          document.execCommand('formatBlock', false, '<p>');
        } else {
          document.execCommand('formatBlock', false, '<blockquote>');
        }
      } else if (command === 'formatBlock' && value === '<h1>') {
        const blockType = document.queryCommandValue('formatBlock') || '';
        const lower = blockType.toLowerCase();
        if (lower === 'h1' || lower === 'heading 1') {
          document.execCommand('formatBlock', false, '<p>');
        } else {
          document.execCommand('formatBlock', false, '<h1>');
        }
      } else if (command === 'formatBlock' && value === '<h2>') {
        const blockType = document.queryCommandValue('formatBlock') || '';
        const lower = blockType.toLowerCase();
        if (lower === 'h2' || lower === 'heading 2') {
          document.execCommand('formatBlock', false, '<p>');
        } else {
          document.execCommand('formatBlock', false, '<h2>');
        }
      } else if (command === 'link') {
        const url = prompt('请输入链接地址 (URL):', 'https://');
        if (url) {
          document.execCommand('createLink', false, url);
        }
      } else if (command === 'image') {
        const url = prompt('请输入图片路径或网址:', 'images/photo.png');
        if (url) {
          document.execCommand('insertImage', false, url);
        }
      } else {
        document.execCommand(command, false, value);
      }
      
      // Update local styles UI immediately
      const event = new Event('selectionchange');
      document.dispatchEvent(event);
      
      // Force content change triggering via an input dispatch so parent component state captures WYSIWYG revisions
      const inputEvent = new Event('input', { bubbles: true });
      activeElement.dispatchEvent(inputEvent);
    } else {
      onInsertMarkdown(prefix, suffix, defaultText);
    }
  };

  const tools = [
    {
      icon: Bold,
      label: '粗体 (Bold)',
      action: () => handleWYSIWYGFormat('bold', '', '**', '**', '粗体文字'),
      active: activeStyles.bold,
    },
    {
      icon: Italic,
      label: '斜体 (Italic)',
      action: () => handleWYSIWYGFormat('italic', '', '*', '*', '斜体文字'),
      active: activeStyles.italic,
    },
    {
      icon: Strikethrough,
      label: '删除线 (Strike)',
      action: () => handleWYSIWYGFormat('strikeThrough', '', '~~', '~~', '删除线文字'),
      active: activeStyles.strikethrough,
    },
    {
      divider: true,
    },
    {
      icon: Heading1,
      label: '一级标题 (H1)',
      action: () => handleWYSIWYGFormat('formatBlock', '<h1>', '# ', '', '一级标题'),
      active: activeStyles.h1,
    },
    {
      icon: Heading2,
      label: '二级标题 (H2)',
      action: () => handleWYSIWYGFormat('formatBlock', '<h2>', '## ', '', '二级标题'),
      active: activeStyles.h2,
    },
    {
      icon: Quote,
      label: '引用 (Quote)',
      action: () => handleWYSIWYGFormat('formatBlock', '<blockquote>', '> ', '', '引用文本'),
      active: activeStyles.blockquote,
    },
    {
      divider: true,
    },
    {
      icon: List,
      label: '无序列表 (List)',
      action: () => handleWYSIWYGFormat('insertUnorderedList', '', '- ', '', '列表项'),
      active: activeStyles.ul,
    },
    {
      icon: ListOrdered,
      label: '有序列表 (Ordered List)',
      action: () => handleWYSIWYGFormat('insertOrderedList', '', '1. ', '', '排序列表'),
      active: activeStyles.ol,
    },
    {
      divider: true,
    },
    {
      icon: Code,
      label: '行内代码 (Code)',
      action: () => handleWYSIWYGFormat('inline-code', '', '`', '`', 'code'),
      active: activeStyles.code,
    },
    {
      icon: Terminal,
      label: '代码块 (Code Block)',
      action: () => handleWYSIWYGFormat('code-block', '', '```javascript\n', '\n```', '// 在此编写代码'),
      active: activeStyles.code,
    },
    {
      divider: true,
    },
    {
      icon: Link,
      label: '添加链接 (Link)',
      action: () => handleWYSIWYGFormat('link', '', '[', '](https://example.com)', '链接描述'),
      active: false,
    },
    {
      icon: Image,
      label: '本地/网络图片 (Image)',
      action: () => handleWYSIWYGFormat('image', '', '![', '](images/photo.png)', '图片描述'),
      active: false,
    },
    {
      icon: Table,
      label: '插入表格 (Table)',
      action: () => handleWYSIWYGFormat(
        'table',
        '',
        '\n| 表头1 | 表头2 | 表头3 |\n| :--- | :---: | :---: |\n| 内容1 | 内容2 | 内容3 |\n',
        '',
        ''
      ),
      active: false,
    },
  ];

  return (
    <div id="vditor-toolbar" className="flex flex-wrap items-center justify-between border-b border-brand-border bg-brand-cream px-4 py-2.5 text-gray-700 dark:text-neutral-300 dark:border-neutral-800/80 select-none">
      {/* Undo/Redo & Markdown helpers */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          id="btn-undo"
          onClick={onUndo}
          onMouseDown={(e) => e.preventDefault()}
          disabled={!canUndo}
          className={`rounded p-1.5 transition-colors duration-150 ${
            canUndo 
              ? 'text-gray-600 hover:bg-brand-border/40 dark:text-neutral-300 dark:hover:bg-neutral-805 cursor-pointer' 
              : 'text-gray-300 dark:text-neutral-700 cursor-not-allowed'
          }`}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          id="btn-redo"
          onClick={onRedo}
          onMouseDown={(e) => e.preventDefault()}
          disabled={!canRedo}
          className={`rounded p-1.5 transition-colors duration-150 ${
            canRedo 
              ? 'text-gray-600 hover:bg-brand-border/40 dark:text-neutral-300 dark:hover:bg-neutral-805 cursor-pointer' 
              : 'text-gray-300 dark:text-neutral-700 cursor-not-allowed'
          }`}
          title="重做 (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>

        <div className="mx-1 h-4 w-[1px] bg-brand-border dark:bg-neutral-800" />

        {tools.map((tool, idx) => {
          if (tool.divider) {
            return <div key={`div-${idx}`} className="mx-1 h-4 w-[1px] bg-brand-border dark:bg-neutral-800" />;
          }

          const IconComponent = tool.icon!;
          const isActive = !!tool.active;
          return (
            <button
              id={`tool-${idx}`}
              key={idx}
              onClick={tool.action}
              onMouseDown={(e) => {
                // Prevent loss of browser selection caret inside editable elements
                e.preventDefault();
              }}
              className={`rounded p-1.5 transition-all duration-150 border cursor-pointer ${
                isActive
                  ? 'bg-brand-rust/10 border-brand-rust/30 text-brand-rust font-bold dark:bg-brand-rust/20 dark:text-amber-300 dark:border-brand-rust/40'
                  : 'border-transparent text-gray-600 hover:bg-brand-border/40 hover:text-brand-rust dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
              }`}
              title={tool.label}
            >
              <IconComponent size={16} className={isActive ? 'scale-105 stroke-[2.5px]' : ''} />
            </button>
          );
        })}
      </div>

      {/* Editor Layout Switchers (Split, WYSIWYG, Source) */}
      <div className="flex items-center gap-1 rounded bg-brand-sidebar p-0.5 dark:bg-black/20 border border-brand-border/60">
        <button
          id="mode-wysiwyg"
          onClick={() => onChangeEditorMode('wysiwyg')}
          className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
            editorMode === 'wysiwyg'
              ? 'bg-[#1a1a1a] text-white shadow-xs dark:bg-brand-rust dark:text-white'
              : 'text-[#4a4a4a] hover:text-brand-rust dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
          title="即时渲染 (边写边看 WYSIWYG)"
        >
          <Sparkles size={13} />
          <span>即时渲染</span>
        </button>
        
        <button
          id="mode-split"
          onClick={() => onChangeEditorMode('split')}
          className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
            editorMode === 'split'
              ? 'bg-[#1a1a1a] text-white shadow-xs dark:bg-brand-rust dark:text-white'
              : 'text-[#4a4a4a] hover:text-brand-rust dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
          title="分栏预览 (Split Viewer)"
        >
          <LayoutGrid size={13} />
          <span>双栏源码</span>
        </button>

        <button
          id="mode-source"
          onClick={() => onChangeEditorMode('source')}
          className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
            editorMode === 'source'
              ? 'bg-[#1a1a1a] text-white shadow-xs dark:bg-brand-rust dark:text-white'
              : 'text-[#4a4a4a] hover:text-brand-rust dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
          title="纯源码编辑 (Pure Code)"
        >
          <EyeOff size={13} />
          <span>极简源码</span>
        </button>
      </div>
    </div>
  );
}
