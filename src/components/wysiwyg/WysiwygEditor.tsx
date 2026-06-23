import React, { useSyncExternalStore } from 'react';
import type { DocumentStore } from '../../document/DocumentStore';
import BlockRenderer from '../blocks/BlockRenderer';
import { FileText } from 'lucide-react';
import { clearBlockSelection } from '../../utils/blockSelection';

interface WysiwygEditorProps {
  store: DocumentStore;
  editable: boolean;
}

/** 即时渲染编辑器：基于 AST 块组件，不经过 HTML 回写 */
export default function WysiwygEditor({ store, editable }: WysiwygEditorProps) {
  const state = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState()
  );

  if (!state.markdown.trim() && state.ast.blocks.length <= 1 && !state.ast.blocks[0]?.type) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-gray-400">
        <FileText size={48} className="mb-3 opacity-60" />
        <p className="text-sm">暂无内容，请开始创作</p>
      </div>
    );
  }

  return (
    <div
      id="md-preview-container"
      className="prose max-w-none px-6 py-3 text-sm leading-relaxed text-gray-800 dark:text-neutral-200 dark:prose-invert"
      onMouseDown={(e) => {
        // 点击非结构块区域时清除整块选中
        if (!(e.target as HTMLElement).closest('.wysiwyg-structural-block')) {
          clearBlockSelection(store);
        }
      }}
    >
      {state.ast.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} store={store} editable={editable} />
      ))}
    </div>
  );
}
