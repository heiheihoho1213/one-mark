import React, { useMemo, useState, useSyncExternalStore, useRef, useEffect } from 'react';
import type { InlineContent } from '../../ast/types';
import type { DocumentStore } from '../../document/DocumentStore';
import { useWorkspace } from '../wysiwyg/WorkspaceContext';
import { resolveImageUrl } from '../../utils/imageResolve';
import { parseImageParagraph } from '../../utils/imageBlock';
import { isEditableTextBlock } from '../../utils/blockEdit';
import {
  selectBlock,
  deleteBlock,
  handleStructuralBlockKeyDown,
  focusOrInsertParagraphAfter,
} from '../../utils/blockSelection';
import { useBlockSelected } from '../../hooks/useBlockSelected';
import { applyImageParagraphEdit } from '../../commands/formatCommands';
import InsertImageDialog from '../InsertImageDialog';
import { Pencil, Trash2 } from 'lucide-react';

interface ImageBlockViewProps {
  blockId: string;
  content: InlineContent;
  store: DocumentStore;
  editable: boolean;
}

/** 独立图片段落：支持选中、删除、回车下方续写 */
export default function ImageBlockView({ blockId, content, store, editable }: ImageBlockViewProps) {
  const { items, currentFileId } = useWorkspace();
  const parsed = parseImageParagraph(content);
  const [editOpen, setEditOpen] = useState(false);
  const figureRef = useRef<HTMLElement>(null);

  const selected = useBlockSelected(blockId, store);

  // 下方已有文字段落时不再显示续写占位区，避免视觉上的「删不掉空行」
  const hasTextBelow = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => {
      const ast = store.getState().ast;
      const idx = ast.blocks.findIndex((b) => b.id === blockId);
      const next = ast.blocks[idx + 1];
      return !!(next && isEditableTextBlock(next));
    },
    () => {
      const ast = store.getState().ast;
      const idx = ast.blocks.findIndex((b) => b.id === blockId);
      const next = ast.blocks[idx + 1];
      return !!(next && isEditableTextBlock(next));
    }
  );

  const img = useMemo(() => parsed ?? { alt: '', url: '' }, [parsed]);
  const src = useMemo(
    () => resolveImageUrl(img.url, items, currentFileId),
    [img.url, items, currentFileId]
  );

  useEffect(() => {
    if (selected && editable) {
      figureRef.current?.focus({ preventScroll: true });
    }
  }, [selected, editable]);

  if (!parsed) return null;

  const handleSelect = (e: React.MouseEvent) => {
    if (!editable) return;
    if ((e.target as HTMLElement).closest('button')) return;
    selectBlock(store, blockId);
  };

  return (
    <figure
      ref={figureRef}
      data-block-id={blockId}
      tabIndex={editable ? 0 : undefined}
      contentEditable={false}
      onMouseDown={handleSelect}
      onKeyDown={(e) => editable && selected && handleStructuralBlockKeyDown(store, blockId, e)}
      className={`wysiwyg-image-block wysiwyg-structural-block my-2 rounded-lg outline-none transition-shadow ${
        selected
          ? 'ring-2 ring-brand-rust/70 ring-offset-2 ring-offset-brand-cream dark:ring-offset-neutral-900'
          : 'hover:ring-1 hover:ring-brand-border/60'
      }`}
    >
      <div className="overflow-hidden rounded-md border border-brand-border/50 bg-brand-sidebar/30 dark:border-neutral-700 dark:bg-neutral-900/40">
        <img
          src={src}
          alt={img.alt}
          draggable={false}
          className="mx-auto block max-h-[480px] max-w-full object-contain pointer-events-none"
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = '0.35';
          }}
        />
      </div>

      {(editable || img.alt) && (
        <figcaption className="mt-1 flex items-center justify-between gap-2 px-1 text-xs text-gray-500 dark:text-neutral-400">
          <span className="truncate">{img.alt || '图片'}</span>
          {editable && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-brand-border/30"
                title="编辑图片"
              >
                <Pencil size={12} />
                编辑
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => deleteBlock(store, blockId)}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                title="删除图片"
              >
                <Trash2 size={12} />
                删除
              </button>
            </div>
          )}
        </figcaption>
      )}

      {editable && selected && (
        <p className="mt-0.5 px-1 text-[10px] text-gray-400 dark:text-neutral-500">
          已选中 · Enter 在下方输入 · Delete 删除
        </p>
      )}

      {/* 仅当下方没有文字段时才显示续写入口 */}
      {editable && !selected && !hasTextBelow && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => focusOrInsertParagraphAfter(store, blockId)}
          className="mt-1 w-full cursor-text rounded px-1 py-0.5 text-left text-[10px] text-gray-300 hover:bg-brand-border/10 hover:text-gray-400 dark:text-neutral-600"
        >
          点击或选中图片后按 Enter 在下方输入
        </button>
      )}

      <InsertImageDialog
        open={editOpen}
        defaultUrl={img.url}
        defaultAlt={img.alt}
        onCancel={() => setEditOpen(false)}
        onConfirm={(url, alt) => {
          applyImageParagraphEdit(store, blockId, alt, url);
          setEditOpen(false);
        }}
      />
    </figure>
  );
}
