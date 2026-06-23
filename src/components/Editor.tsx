import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import Toolbar from './Toolbar';
import WysiwygEditor from './wysiwyg/WysiwygEditor';
import { DocumentProvider } from './wysiwyg/DocumentContext';
import { WorkspaceProvider } from './wysiwyg/WorkspaceContext';
import { DocumentStore } from '../document/DocumentStore';
import { PersistenceScheduler } from '../document/PersistenceScheduler';
import { FileSyncWatcher } from '../document/FileSyncWatcher';
import FileConflictDialog from './FileConflictDialog';
import { FileText, AlignLeft, BarChart2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { exportMarkdownAsFile } from '../utils/exportMarkdown';
import { loadOutlineExpanded, saveOutlineExpanded } from '../utils/sessionStorage';
import { stripMarkdownInline } from '../utils/markdownText';
import type { WorkspaceItem } from '../types';

interface EditorProps {
  initialMarkdown: string;
  onSaveMarkdown: (newMarkdown: string) => void;
  currentFileId: string;
  items: Record<string, WorkspaceItem>;
  readFileFromDisk?: () => Promise<{ content: string; mtime: number } | null>;
  onExportSuccess?: () => void;
  onExportError?: (message: string) => void;
}

export default function Editor({
  initialMarkdown,
  onSaveMarkdown,
  currentFileId,
  readFileFromDisk,
  items,
  onExportSuccess,
  onExportError,
}: EditorProps) {
  const [outlineExpanded, setOutlineExpanded] = useState(() => loadOutlineExpanded());
  const [conflictOpen, setConflictOpen] = useState(false);
  const [diskContent, setDiskContent] = useState('');

  const [store] = useState(() => new DocumentStore(initialMarkdown));
  const schedulerRef = useRef<PersistenceScheduler | null>(null);
  const watcherRef = useRef<FileSyncWatcher | null>(null);
  const onSaveRef = useRef(onSaveMarkdown);
  onSaveRef.current = onSaveMarkdown;

  const docState = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState()
  );

  useEffect(() => {
    const scheduler = new PersistenceScheduler((md) => onSaveRef.current(md), 400);
    schedulerRef.current = scheduler;
    store.attachScheduler(scheduler);

    if (readFileFromDisk) {
      const watcher = new FileSyncWatcher(readFileFromDisk, (content) => {
        setDiskContent(content);
        setConflictOpen(true);
      });
      watcherRef.current = watcher;
      watcher.start();
    }

    return () => {
      void scheduler.flushNow(store.getState().markdown);
      scheduler.dispose();
      watcherRef.current?.dispose();
      store.dispose();
    };
  }, [currentFileId, readFileFromDisk, store]);

  const markdown = docState.markdown;

  useEffect(() => {
    saveOutlineExpanded(outlineExpanded);
  }, [outlineExpanded]);

  const handleUndo = () => store.undo();
  const handleRedo = () => store.redo();

  // 全局快捷键（仅实时渲染模式）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void schedulerRef.current?.flushNow(store.getState().markdown);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const outline = (() => {
    const lines = markdown.split('\n');
    const list: { level: number; text: string; lineNo: number }[] = [];
    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,4})\s+(.+)$/);
      if (match) list.push({ level: match[1].length, text: stripMarkdownInline(match[2]), lineNo: idx });
    });
    return list;
  })();

  const handleOutlineClick = (lineNo: number) => {
    const outlineIndex = outline.findIndex((item) => item.lineNo === lineNo);
    if (outlineIndex < 0) return;
    const blocks = document.querySelectorAll('#md-preview-container [data-block-id]');
    blocks[outlineIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExportAs = async () => {
    const name = currentFileId.split('/').pop() || 'document.md';
    try {
      const ok = await exportMarkdownAsFile(markdown, name);
      if (ok) onExportSuccess?.();
    } catch (err) {
      onExportError?.(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <DocumentProvider store={store}>
      <WorkspaceProvider currentFileId={currentFileId} items={items}>
      <div id="editor-wrapper" className="flex h-full flex-col bg-brand-cream">
        <Toolbar
          store={store}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={docState.canUndo}
          canRedo={docState.canRedo}
        />

        <div className="flex flex-1 overflow-hidden">
          {outline.length > 0 && (
            outlineExpanded ? (
              <div className="hidden lg:flex w-48 shrink-0 flex-col border-r border-brand-border bg-brand-sidebar/40 p-3 dark:border-neutral-800 dark:bg-black/15">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-rust">
                    <AlignLeft size={13} /> 目录大纲
                  </h4>
                  <button
                    type="button"
                    onClick={() => setOutlineExpanded(false)}
                    className="rounded p-1 text-gray-500 hover:bg-brand-border/30 hover:text-brand-rust dark:text-neutral-400 dark:hover:bg-neutral-800"
                    title="收起目录大纲"
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {outline.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleOutlineClick(item.lineNo)}
                      style={{ paddingLeft: `${(item.level - 1) * 10 + 8}px` }}
                      className="block w-full truncate py-1.5 text-left text-xs hover:text-brand-rust"
                    >
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex w-9 shrink-0 flex-col items-center border-r border-brand-border py-3 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setOutlineExpanded(true)}
                  className="rounded p-1 text-gray-500 hover:bg-brand-border/30 hover:text-brand-rust dark:text-neutral-400 dark:hover:bg-neutral-800"
                  title="展开目录大纲"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )
          )}

          <div id="preview-viewport" className="h-full flex-1 overflow-y-auto bg-brand-cream/40 dark:bg-neutral-900/15">
            <WysiwygEditor store={store} editable />
          </div>
        </div>

        <div id="editor-footer" className="flex items-center justify-between border-t border-brand-border px-4 py-2.5 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 truncate">
            <FileText size={12} />
            <span className="font-mono text-gray-700 dark:text-neutral-400">{currentFileId}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => void handleExportAs()}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-gray-500 transition-colors hover:bg-brand-border/30 hover:text-brand-rust dark:text-neutral-400 dark:hover:bg-neutral-800"
              title="另存为新的 Markdown 文件"
            >
              <Download size={12} />
              另存为
            </button>
            <span className="inline-flex items-center gap-1">
              <BarChart2 size={12} />
              字符: {markdown.length}
            </span>
          </div>
        </div>

        <FileConflictDialog
          open={conflictOpen}
          fileName={currentFileId.split('/').pop() || '文档'}
          onKeepLocal={() => {
            setConflictOpen(false);
            void schedulerRef.current?.flushNow(markdown);
          }}
          onUseDisk={() => {
            setConflictOpen(false);
            store.replaceFromDisk(diskContent);
          }}
          onCancel={() => setConflictOpen(false)}
        />
      </div>
      </WorkspaceProvider>
    </DocumentProvider>
  );
}
