import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { BlockNode, TableColAlign } from '../../ast/types';
import type { DocumentStore } from '../../document/DocumentStore';
import EditableTextBlock from './EditableTextBlock';
import { InlineRenderer } from './InlineRenderer';
import { applyCodeEdit, applyTableResize, applyTableAlign } from '../../commands/formatCommands';
import { Minus, Plus, ChevronDown, AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react';
import { deleteBlock, clearBlockSelection } from '../../utils/blockSelection';
import '../../utils/markdownHighlight';
import { highlightCode, highlightLangClass } from '../../utils/markdownHighlight';
import { codeLanguageOptions } from '../../constants/codeLanguages';
import EditableTableCell from './EditableTableCell';
import ImageBlockView from './ImageBlockView';
import { parseImageParagraph } from '../../utils/imageBlock';

mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

const CODE_FONT =
  'block min-h-[2em] whitespace-pre font-mono text-[13px] leading-relaxed';

function CodeBlockView({ block, store, editable }: { block: Extract<BlockNode, { type: 'code' }>; store: DocumentStore; editable: boolean }) {
  const codeRef = useRef<HTMLElement>(null);
  const langClass = highlightLangClass(block.lang);
  const highlighted = highlightCode(block.code, block.lang);
  const langOptions = codeLanguageOptions(block.lang);
  const isEmpty = !block.code;

  // 可编辑层仅同步纯文本，高亮由底层只读层承担
  useLayoutEffect(() => {
    const el = codeRef.current;
    if (!el || document.activeElement === el) return;
    const plain = block.code;
    if (el.textContent !== plain) {
      el.textContent = plain;
    }
  }, [block.code]);

  const syncCode = (raw: string) => {
    // 去掉用于维持光标的零宽字符
    applyCodeEdit(store, block.id, raw.replace(/[\u200b\ufeff]/g, ''));
  };

  const handleFocus = () => {
    const el = codeRef.current;
    if (!el || block.code) return;
    // 空代码块：确保有文本节点，否则 WebKit 不显示光标
    if (!el.textContent) {
      el.textContent = '\u200b';
    }
    requestAnimationFrame(() => {
      const range = document.createRange();
      const sel = window.getSelection();
      if (!sel || !el.firstChild) return;
      range.setStart(el.firstChild, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    });
  };

  const handleCodeFocus = () => {
    // 进入编辑时清除表格/图片的整块选中，代码块本身不做选中态
    clearBlockSelection(store);
    handleFocus();
  };

  return (
    <div
      data-block-id={block.id}
      className="wysiwyg-code-block my-2 overflow-hidden rounded-md border border-brand-border/70 bg-brand-sidebar/80 dark:border-neutral-700 dark:bg-neutral-900/90"
    >
      {editable && (
        <div
          className="not-prose flex items-center gap-2 border-b border-brand-border/50 bg-brand-sidebar px-3 py-1.5 text-[11px] dark:border-neutral-700 dark:bg-neutral-900"
          contentEditable={false}
        >
          <span>代码</span>
          <div className="relative inline-flex items-center">
            <select
              value={block.lang}
              onChange={(e) => applyCodeEdit(store, block.id, block.code, e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              className="appearance-none cursor-pointer rounded-sm border border-brand-border/50 bg-brand-cream py-0.5 pl-2 pr-6 text-[11px] text-gray-800 shadow-none transition-colors hover:border-brand-border focus:border-brand-rust/60 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {langOptions.map((l) => (
                <option key={l.id || 'plain'} value={l.id}>{l.label}</option>
              ))}
            </select>
            <ChevronDown
              size={11}
              className="pointer-events-none absolute right-1.5 text-gray-400"
              aria-hidden
            />
          </div>
          <button
            type="button"
            title="删除代码块"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => deleteBlock(store, block.id)}
            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
      {editable ? (
        <pre className="!my-0 overflow-x-auto bg-neutral-100/90 p-3 dark:bg-neutral-950/60">
          <div className="relative">
            {/* 有内容时才显示高亮底层；空白时透明字体会把光标藏起来 */}
            {!isEmpty && (
              <code
                aria-hidden
                className={`hljs language-${langClass} pointer-events-none absolute inset-0 ${CODE_FONT}`}
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            )}
            <code
              ref={codeRef as React.RefObject<HTMLElement>}
              contentEditable
              suppressContentEditableWarning
              draggable={false}
              spellCheck={false}
              className={`hljs language-${langClass} relative z-[1] ${CODE_FONT} outline-none ${
                isEmpty
                  ? 'text-gray-800 caret-gray-900 dark:text-neutral-200 dark:caret-neutral-100'
                  : 'text-transparent caret-gray-900 dark:caret-neutral-100'
              }`}
              style={isEmpty ? undefined : { WebkitTextFillColor: 'transparent' }}
              onFocus={handleCodeFocus}
              onInput={(e) => syncCode(e.currentTarget.textContent || '')}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
              }}
            />
          </div>
        </pre>
      ) : (
        <pre className="!my-0 overflow-x-auto bg-neutral-100/90 p-3 dark:bg-neutral-950/60">
          <code
            className={`hljs language-${langClass} ${CODE_FONT}`}
            dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }}
          />
        </pre>
      )}
    </div>
  );
}

function MermaidBlockView({ block, store, editable }: { block: Extract<BlockNode, { type: 'mermaid' }>; store: DocumentStore; editable: boolean }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!chartRef.current || !block.code.trim()) {
        if (chartRef.current) chartRef.current.innerHTML = '';
        return;
      }
      try {
        const id = `mmd-${block.id}-${Date.now()}`;
        const { svg } = await mermaid.render(id, block.code);
        if (!cancelled && chartRef.current) {
          chartRef.current.innerHTML = svg;
          setErr('');
        }
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [block.code, block.id]);

  return (
    <div className="my-3">
      {editable && (
        <textarea
          value={block.code}
          onChange={(e) => applyCodeEdit(store, block.id, e.target.value)}
          className="mb-2 w-full resize-y rounded border border-brand-border/50 bg-white/50 p-2 font-mono text-xs dark:bg-neutral-900"
          rows={4}
          placeholder="flowchart TD&#10;  A --> B"
        />
      )}
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div ref={chartRef} className="mermaid-chart overflow-x-auto rounded border border-brand-border/30 bg-white/50 p-3 dark:bg-neutral-900/50" />
    </div>
  );
}

function tableAlignClasses(align: TableColAlign): string {
  if (align === 'center') return 'justify-center text-center';
  if (align === 'right') return 'justify-end text-right';
  return 'justify-start text-left';
}

/** 若各列对齐一致则返回该值，否则为 null（如从 MD 导入的混合对齐） */
function tableUniformAlign(colAligns: TableColAlign[]): TableColAlign | null {
  if (colAligns.length === 0) return 'left';
  const first = colAligns[0];
  return colAligns.every((a) => a === first) ? first : null;
}

function TableBlockView({ block, store, editable }: { block: Extract<BlockNode, { type: 'table' }>; store: DocumentStore; editable: boolean }) {
  const cols = block.headers.length;
  const rows = block.rows.length;
  const compact = rows <= 1;
  const colAligns: TableColAlign[] = block.colAligns ?? block.headers.map(() => 'left');
  const uniformAlign = tableUniformAlign(colAligns);

  return (
    <div data-block-id={block.id} className="wysiwyg-table-block not-prose my-2">
      {editable && (
        <div className="not-prose mb-1.5 flex flex-wrap items-center gap-3 rounded border border-brand-border/40 px-2 py-1 text-xs" contentEditable={false}>
          <span className="font-semibold text-brand-rust">表格</span>
          <button type="button" onClick={() => applyTableResize(store, block.id, cols - 1, rows)} disabled={cols <= 1}><Minus size={12} /></button>
          <span>{cols} 列</span>
          <button type="button" onClick={() => applyTableResize(store, block.id, cols + 1, rows)}><Plus size={12} /></button>
          <button type="button" onClick={() => applyTableResize(store, block.id, cols, rows - 1)} disabled={rows <= 0}><Minus size={12} /></button>
          <span>{rows} 行</span>
          <button type="button" onClick={() => applyTableResize(store, block.id, cols, rows + 1)}><Plus size={12} /></button>
          <span className="mx-1 h-4 w-px bg-brand-border/60" />
          <span className="text-gray-500" title="GFM 表格对齐由分隔行定义，作用于整表各列">对齐</span>
          <button
            type="button"
            title="左对齐（|:---|）"
            onClick={() => applyTableAlign(store, block.id, 'left')}
            className={`rounded p-1 ${uniformAlign === 'left' ? 'bg-brand-rust/15 text-brand-rust' : 'hover:bg-brand-border/30'}`}
          >
            <AlignLeft size={12} />
          </button>
          <button
            type="button"
            title="居中（|:---:|）"
            onClick={() => applyTableAlign(store, block.id, 'center')}
            className={`rounded p-1 ${uniformAlign === 'center' ? 'bg-brand-rust/15 text-brand-rust' : 'hover:bg-brand-border/30'}`}
          >
            <AlignCenter size={12} />
          </button>
          <button
            type="button"
            title="右对齐（|---:|）"
            onClick={() => applyTableAlign(store, block.id, 'right')}
            className={`rounded p-1 ${uniformAlign === 'right' ? 'bg-brand-rust/15 text-brand-rust' : 'hover:bg-brand-border/30'}`}
          >
            <AlignRight size={12} />
          </button>
          <button
            type="button"
            title="删除表格"
            onClick={() => deleteBlock(store, block.id)}
            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            {block.headers.map((h, i) =>
              editable ? (
                <EditableTableCell
                  key={i}
                  blockId={block.id}
                  store={store}
                  content={h}
                  target={{ kind: 'header', col: i }}
                  as="th"
                  compact={compact}
                  align={colAligns[i] ?? 'left'}
                  bodyRowCount={rows}
                  className="font-semibold"
                />
              ) : (
                <th
                  key={i}
                  className={`max-w-0 border border-brand-border/50 p-0 align-middle ${compact ? 'h-8' : ''}`}
                >
                  <div className={`flex items-center px-2 ${compact ? 'h-8' : 'min-h-[1.75rem] py-1'} ${tableAlignClasses(colAligns[i] ?? 'left')}`}>
                    <div className={`w-full min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap ${tableAlignClasses(colAligns[i] ?? 'left')}`}>
                      <InlineRenderer content={h} />
                    </div>
                  </div>
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {block.headers.map((_, ci) =>
                editable ? (
                  <EditableTableCell
                    key={ci}
                    blockId={block.id}
                    store={store}
                    content={row[ci] ?? [{ text: '', marks: {} }]}
                    target={{ kind: 'body', row: ri, col: ci }}
                    compact={compact}
                    align={colAligns[ci] ?? 'left'}
                    bodyRowCount={rows}
                  />
                ) : (
                  <td
                    key={ci}
                    className={`max-w-0 border border-brand-border/50 p-0 align-middle ${compact ? 'h-8' : ''}`}
                  >
                    <div className={`flex items-center px-2 ${compact ? 'h-8' : 'min-h-[1.75rem] py-1'} ${tableAlignClasses(colAligns[ci] ?? 'left')}`}>
                      <div className={`w-full min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap ${tableAlignClasses(colAligns[ci] ?? 'left')}`}>
                        <InlineRenderer content={row[ci] ?? [{ text: '', marks: {} }]} />
                      </div>
                    </div>
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BlockRenderer({
  block,
  store,
  editable,
}: {
  block: BlockNode;
  store: DocumentStore;
  editable: boolean;
}) {
  switch (block.type) {
    case 'paragraph': {
      if (parseImageParagraph(block.content)) {
        return (
          <ImageBlockView
            blockId={block.id}
            content={block.content}
            store={store}
            editable={editable}
          />
        );
      }
      return editable ? (
        <EditableTextBlock blockId={block.id} content={block.content} store={store} className="my-1" as="p" />
      ) : (
        <p className="my-1"><InlineRenderer content={block.content} /></p>
      );
    }
    case 'heading':
      return editable ? (
        <EditableTextBlock
          blockId={block.id}
          content={block.content}
          store={store}
          className={`font-bold my-2 ${block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : block.level === 3 ? 'text-lg' : 'text-base'}`}
          as={`h${block.level}` as 'h1'}
        />
      ) : (
        <div className={`font-bold my-2 ${block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : block.level === 3 ? 'text-lg' : 'text-base'}`}>
          <InlineRenderer content={block.content} />
        </div>
      );
    case 'blockquote':
      return editable ? (
        <EditableTextBlock blockId={block.id} content={block.content} store={store} className="border-l-4 border-brand-rust/40 pl-3 italic my-2" as="blockquote" />
      ) : (
        <blockquote className="border-l-4 border-brand-rust/40 pl-3 italic my-2"><InlineRenderer content={block.content} /></blockquote>
      );
    case 'code':
      return <CodeBlockView block={block} store={store} editable={editable} />;
    case 'mermaid':
      return <MermaidBlockView block={block} store={store} editable={editable} />;
    case 'table':
      return <TableBlockView block={block} store={store} editable={editable} />;
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag className="my-2 pl-5">
          {block.items.map((item, i) => (
            <li key={i}><InlineRenderer content={item.content} /></li>
          ))}
        </ListTag>
      );
    }
    case 'thematicBreak':
      return <hr className="my-4 border-brand-border" />;
    default:
      return null;
  }
}
