import React, { useState, useEffect, useRef } from 'react';
import Toolbar from './Toolbar';
import Preview from './Preview';
import { FileText, AlignLeft, BarChart2, CheckCheck, Save } from 'lucide-react';
import { loadSavedEditorMode, saveEditorMode } from '../utils/sessionStorage';
import { stripMarkdownInline } from '../utils/markdownText';

interface EditorProps {
  initialMarkdown: string;
  onSaveMarkdown: (newMarkdown: string) => void;
  currentFileId: string;
  items: any;
}

export default function Editor({
  initialMarkdown,
  onSaveMarkdown,
  currentFileId,
  items,
}: EditorProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  // 记住上次使用的编辑模式
  const [editorMode, setEditorMode] = useState<'split' | 'wysiwyg' | 'source'>(() => loadSavedEditorMode());
  
  // Undo / Redo Stacks
  const [history, setHistory] = useState<string[]>([initialMarkdown]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state if file changes
  useEffect(() => {
    setMarkdown(initialMarkdown);
    setHistory([initialMarkdown]);
    setHistoryIndex(0);
  }, [initialMarkdown, currentFileId]);

  // 编辑模式变更时写入本地存储
  useEffect(() => {
    saveEditorMode(editorMode);
  }, [editorMode]);

  // Handle value change, update history with simple debouncing/milestone limits
  const handleContentChange = (newVal: string) => {
    setMarkdown(newVal);
    onSaveMarkdown(newVal);

    // Update undo history
    const baseHistory = history.slice(0, historyIndex + 1);
    // Only push if the change is significant or the last text is different
    if (baseHistory[baseHistory.length - 1] !== newVal) {
      const newHistory = [...baseHistory, newVal];
      // Keep stack size reasonable
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      const text = history[prevIdx];
      setMarkdown(text);
      onSaveMarkdown(text);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      const text = history[nextIdx];
      setMarkdown(text);
      onSaveMarkdown(text);
    }
  };

  // Keyboard hotkeys
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab support
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const space = '  '; // 2 spaces tab
      const updated = markdown.substring(0, start) + space + markdown.substring(end);
      handleContentChange(updated);
      
      // Reset cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + space.length;
        }
      }, 0);
    }

    // Ctrl+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSaveMarkdown(markdown);
    }

    // Ctrl+Z Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      handleUndo();
    }

    // Ctrl+Y Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      handleRedo();
    }
  };

  // Vditor toolbar insertion math with smart toggle reversibility
  const handleInsertMarkdown = (prefix: string, suffix: string, defaultText: string) => {
    const textarea = textareaRef.current;
    const insertionText = prefix + defaultText + suffix;

    // 即时渲染模式无 textarea 光标，按当前块或文档末尾插入 Markdown
    if (editorMode === 'wysiwyg') {
      const segments = markdown.split(/\n\n+/);
      const activeEl = document.activeElement;
      const previewBlocks = document.querySelectorAll('#md-preview-container .markdown-body[contenteditable]');
      let insertAfterIndex = segments.length - 1;

      if (activeEl?.getAttribute('contenteditable') === 'true') {
        const focusedIdx = Array.from(previewBlocks).indexOf(activeEl as Element);
        if (focusedIdx >= 0) insertAfterIndex = focusedIdx;
      }

      const before = segments.slice(0, insertAfterIndex + 1).join('\n\n');
      const after = segments.slice(insertAfterIndex + 1).join('\n\n');
      const blockToInsert = insertionText.trim();
      const updated = after
        ? `${before}\n\n${blockToInsert}\n\n${after}`
        : before
          ? `${before}\n\n${blockToInsert}`
          : blockToInsert;
      handleContentChange(updated);
      return;
    }

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);

    let insertion = '';
    let startOffset = 0;
    let endOffset = 0;

    // Check if the selection itself is fully wrapped with prefix and suffix (e.g. **bold**)
    if (prefix && suffix && selectedText.startsWith(prefix) && selectedText.endsWith(suffix) && selectedText.length >= prefix.length + suffix.length) {
      // Toggle off: strip the wrappers from the selection
      insertion = selectedText.substring(prefix.length, selectedText.length - suffix.length);
      startOffset = 0;
      endOffset = insertion.length;
      
      const updated = markdown.substring(0, start) + insertion + markdown.substring(end);
      handleContentChange(updated);
      textarea.focus();
      setTimeout(() => {
        textarea.selectionStart = start + startOffset;
        textarea.selectionEnd = start + endOffset;
      }, 0);
      return;
    }

    // Check if the characters immediately surrounding the selection match the prefix/suffix
    const hasSurroundingWrappers = 
      prefix && suffix && 
      start >= prefix.length && 
      end + suffix.length <= markdown.length &&
      markdown.substring(start - prefix.length, start) === prefix &&
      markdown.substring(end, end + suffix.length) === suffix;

    if (hasSurroundingWrappers) {
      // Toggle off: strip surrounding wrappers
      const updated = markdown.substring(0, start - prefix.length) + selectedText + markdown.substring(end + suffix.length);
      handleContentChange(updated);
      textarea.focus();
      setTimeout(() => {
        textarea.selectionStart = start - prefix.length;
        textarea.selectionEnd = end - prefix.length;
      }, 0);
      return;
    }

    // Check header toggle off (H1, H2, Blockquote etc.)
    const isHeadingOrQuoteLine = prefix.endsWith(' ') && !suffix;
    if (isHeadingOrQuoteLine) {
      // Find the start of the current line
      const textBefore = markdown.substring(0, start);
      const lineStartIdx = textBefore.lastIndexOf('\n') + 1;
      const currentLine = markdown.substring(lineStartIdx, start);
      
      if (currentLine.startsWith(prefix)) {
        // Toggle off heading/quote: remove the prefix at start of the line
        const updated = markdown.substring(0, lineStartIdx) + currentLine.substring(prefix.length) + markdown.substring(start);
        handleContentChange(updated);
        textarea.focus();
        setTimeout(() => {
          textarea.selectionStart = start - prefix.length;
          textarea.selectionEnd = end - prefix.length;
        }, 0);
        return;
      }
    }

    // Default: Insert/Apply wrappers
    insertion = prefix + (selectedText || defaultText) + suffix;
    startOffset = prefix.length;
    endOffset = prefix.length + (selectedText || defaultText).length;

    const updated = markdown.substring(0, start) + insertion + markdown.substring(end);
    handleContentChange(updated);

    // Recalculate selection range and refocus
    textarea.focus();
    setTimeout(() => {
      textarea.selectionStart = start + startOffset;
      textarea.selectionEnd = start + endOffset;
    }, 0);
  };

  // Word & Metrics Stats
  const charCount = markdown.length;
  const wordCount = markdown.trim() === '' ? 0 : markdown.trim().split(/\s+/).length;
  const paragraphCount = markdown.split(/\n\n+/).filter(Boolean).length;

  // Extract outline (ToC)
  const extractOutline = () => {
    const lines = markdown.split('\n');
    const list: { level: number; text: string; lineNo: number }[] = [];
    
    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        list.push({
          level: match[1].length,
          // 大纲仅展示纯文本，去掉 **、*、` 等行内格式
          text: stripMarkdownInline(match[2]),
          lineNo: idx,
        });
      }
    });
    return list;
  };

  const outline = extractOutline();

  // Scroll to header line in editor or preview
  const handleOutlineClick = (lineNo: number) => {
    const outlineIndex = outline.findIndex((item) => item.lineNo === lineNo);
    if (outlineIndex < 0) return;

    // 即时渲染模式：按大纲顺序滚动到预览区对应标题
    if (editorMode === 'wysiwyg') {
      const headings = document.querySelectorAll(
        '#md-preview-container h1, #md-preview-container h2, #md-preview-container h3, #md-preview-container h4, #md-preview-container h5, #md-preview-container h6'
      );
      const target = headings[outlineIndex];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const lines = markdown.split('\n');
    let offset = 0;
    for (let i = 0; i < lineNo; i++) {
      offset += lines[i].length + 1; // include newline
    }

    textarea.focus();
    textarea.setSelectionRange(offset, offset + lines[lineNo].length);
    
    // Smooth scroll to caret area
    const lineHeight = 20; // approximate
    textarea.scrollTop = lineNo * lineHeight - 100;
  };

  // Calculate layout widths based on selected mode
  const showEditor = editorMode === 'split' || editorMode === 'source';
  const showPreview = editorMode === 'split' || editorMode === 'wysiwyg';

  return (
    <div id="editor-wrapper" className="flex h-full flex-col bg-brand-cream transition-colors duration-150">
      {/* Dynamic Vditor Style Toolbar */}
      <Toolbar 
        onInsertMarkdown={handleInsertMarkdown}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        editorMode={editorMode}
        onChangeEditorMode={setMarkdown ? setEditorMode : () => {}}
      />

      {/* Main Coding Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* 目录大纲：所有编辑模式均可用 */}
        {outline.length > 0 && (
          <div id="editor-outline-panel" className="hidden lg:flex w-48 shrink-0 flex-col border-r border-brand-border dark:border-neutral-800 bg-brand-sidebar/40 dark:bg-black/15 p-3 select-none">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-rust mb-3 pl-1">
              <AlignLeft size={13} />
              目录大纲
            </h4>
            <div className="flex-1 overflow-y-auto space-y-1">
              {outline.map((item, idx) => (
                <button
                  id={`outline-item-${idx}`}
                  key={idx}
                  onClick={() => handleOutlineClick(item.lineNo)}
                  style={{ paddingLeft: `${(item.level - 1) * 10 + 8}px` }}
                  className="editor-outline-link text-left text-xs text-gray-600 dark:text-neutral-300 rounded hover:text-brand-rust dark:hover:text-brand-rust block w-full truncate py-1.5 hover:bg-brand-sidebar/50"
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Writing block */}
        {showEditor && (
          <div className="flex h-full flex-1 flex-col relative bg-brand-cream">
            <textarea
              ref={textareaRef}
              id="editor-textarea"
              value={markdown}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-full w-full resize-none border-0 bg-brand-cream p-6 font-mono text-[13px] leading-relaxed text-gray-800 focus:outline-hidden focus:ring-0 dark:text-neutral-100 selection:bg-brand-rust/20 dark:selection:bg-brand-rust/45 dark:selection:text-white"
              placeholder="# 在此书写 Markdown..."
            />
            
            {/* Tiny Floating Save state status code */}
            <div className="absolute bottom-3 right-4 flex items-center gap-1 rounded bg-[#1a1a1a]/80 px-2.5 py-1 text-[10px] text-white backdrop-blur-xs select-none shadow-xs border border-brand-border/20">
              <CheckCheck size={11} className="text-brand-rust font-bold" />
              <span>暂存同步</span>
            </div>
          </div>
        )}

        {/* Split line separator */}
        {editorMode === 'split' && (
          <div className="w-[1px] bg-brand-border dark:bg-neutral-800" />
        )}

        {/* Real-time Rendered HTML Preview */}
        {showPreview && (
          <div id="preview-viewport" className="h-full flex-1 overflow-y-auto bg-brand-cream/40 dark:bg-neutral-900/15">
            <Preview 
              markdown={markdown}
              onChangeMarkdown={handleContentChange}
              isReadMode={editorMode === 'wysiwyg'} // can only double-click edit inside continuous preview (WYSIWYG layout)
              currentFileId={currentFileId}
              items={items}
            />
          </div>
        )}
      </div>

      {/* Editor footer metadata details */}
      <div id="editor-footer" className="flex items-center justify-between border-t border-brand-border bg-brand-cream/90 px-4 py-2.5 text-xs text-gray-400 dark:border-neutral-800/80 dark:bg-neutral-950/20 select-none">
        <div className="flex items-center gap-1.5 truncate">
          <FileText size={12} className="text-gray-450" />
          <span className="font-semibold font-mono text-gray-700 dark:text-neutral-400">{currentFileId}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0 font-mono text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <BarChart2 size={12} />
            字符数: <b>{charCount}</b> | 词数: <b>{wordCount}</b> | 段落: <b>{paragraphCount}</b>
          </span>
          <span className="hidden sm:inline-block">UTF-8</span>
          <span className="hidden md:inline-block text-brand-rust bg-brand-rust/10 dark:bg-brand-rust/20 px-2 py-0.5 rounded-sm font-semibold">
            {editorMode === 'wysiwyg' ? '即时渲染' : editorMode === 'split' ? '双栏编辑' : '极简源码'}
          </span>
        </div>
      </div>
    </div>
  );
}
