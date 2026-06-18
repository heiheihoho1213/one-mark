import React, { useEffect, useCallback } from 'react';
import { marked } from 'marked';
import '../utils/markdownHighlight';
import { FileText, Minus, Plus, ChevronDown } from 'lucide-react';

interface PreviewProps {
  markdown: string;
  onChangeMarkdown?: (newMarkdown: string) => void;
  isReadMode: boolean; // if true, double click triggers blocks inline edit
  currentFileId: string;
  items: any; // for relative image resolutions
}

interface BlockItem {
  id: number;
  raw: string;
  type: 'heading' | 'code' | 'list' | 'table' | 'paragraph';
}

// ---------------- Helper Functions to Translate HTML Back to Clean Markdown ----------------

function cleanInlineHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const serializeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      
      // Get serialized children markdown
      let childrenMarkdown = '';
      node.childNodes.forEach((child) => {
        childrenMarkdown += serializeNode(child);
      });
      
      const fontWeight = element.style.fontWeight || '';
      const fontStyle = element.style.fontStyle || '';
      const textDecoration = element.style.textDecoration || '';
      
      const isBold = tagName === 'strong' || tagName === 'b' || fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800';
      const isItalic = tagName === 'em' || tagName === 'i' || fontStyle === 'italic';
      const isStrike = tagName === 'del' || tagName === 's' || tagName === 'strike' || textDecoration.includes('line-through');
      const isCode = tagName === 'code';
      
      let result = childrenMarkdown;
      if (isBold && result.trim() !== '') {
        const leadingSpace = result.match(/^\s*/)?.[0] || '';
        const trailingSpace = result.match(/\s*$/)?.[0] || '';
        result = `${leadingSpace}**${result.trim()}**${trailingSpace}`;
      }
      if (isItalic && result.trim() !== '') {
        const leadingSpace = result.match(/^\s*/)?.[0] || '';
        const trailingSpace = result.match(/\s*$/)?.[0] || '';
        result = `${leadingSpace}*${result.trim()}*${trailingSpace}`;
      }
      if (isStrike && result.trim() !== '') {
        const leadingSpace = result.match(/^\s*/)?.[0] || '';
        const trailingSpace = result.match(/\s*$/)?.[0] || '';
        result = `${leadingSpace}~~${result.trim()}~~${trailingSpace}`;
      }
      if (isCode && result.trim() !== '') {
        const leadingSpace = result.match(/^\s*/)?.[0] || '';
        const trailingSpace = result.match(/\s*$/)?.[0] || '';
        result = `${leadingSpace}\`${result.trim()}\`${trailingSpace}`;
      }
      
      if (tagName === 'a') {
        const href = element.getAttribute('href') || '#';
        return `[${childrenMarkdown}](${href})`;
      }
      if (tagName === 'img') {
        const alt = element.getAttribute('alt') || '';
        const src = element.getAttribute('src') || '';
        return `![${alt}](${src})`;
      }
      if (tagName === 'br') {
        return '\n';
      }
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(tagName)) {
        return result + '\n';
      }
      
      return result;
    }
    
    return '';
  };
  
  let markdown = '';
  doc.body.childNodes.forEach((child) => {
    markdown += serializeNode(child);
  });
  
  return markdown.trim();
}

function htmlToListMarkdown(html: string, isOrdered = false, depth = 0): string {
  if (typeof window === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const items: string[] = [];
  
  const listElement = doc.querySelector(isOrdered ? 'ol' : 'ul');
  if (!listElement) {
    return cleanInlineHtml(html);
  }

  const childNodes = Array.from(listElement.childNodes);
  let index = 1;
  
  childNodes.forEach((node) => {
    if (node.nodeName.toLowerCase() === 'li') {
      const element = node as HTMLElement;
      
      const subUl = element.querySelector('ul');
      const subOl = element.querySelector('ol');
      
      let subMarkdown = '';
      if (subUl) {
        subMarkdown = '\n' + htmlToListMarkdown(subUl.outerHTML, false, depth + 1);
        subUl.remove();
      } else if (subOl) {
        subMarkdown = '\n' + htmlToListMarkdown(subOl.outerHTML, true, depth + 1);
        subOl.remove();
      }
      
      const itemText = cleanInlineHtml(element.innerHTML);
      const indent = '  '.repeat(depth);
      const prefix = isOrdered ? `${index}. ` : '- ';
      items.push(`${indent}${prefix}${itemText}${subMarkdown}`);
      index++;
    }
  });
  
  return items.join('\n');
}

/** 表格单元格内容：去除用户插入的换行，保存为单行 Markdown */
function cleanTableCellHtml(html: string): string {
  return cleanInlineHtml(html).replace(/\s+/g, ' ').trim();
}

interface TableData {
  headers: string[];
  body: string[][];
}

/** 从 Markdown 表格块解析行列数据 */
function parseMarkdownTable(raw: string): TableData | null {
  const lines = raw.trim().split('\n').filter((line) => line.trim().startsWith('|'));
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line.split('|').slice(1, -1).map((cell) => cell.trim());

  const headers = parseRow(lines[0]);
  if (headers.length === 0) return null;

  let bodyStart = 1;
  if (lines[1] && /^\|?\s*[-:]+/.test(lines[1].replace(/\s/g, ''))) {
    bodyStart = 2;
  }

  const body = lines.slice(bodyStart).map(parseRow);
  return { headers, body };
}

/** 将表格数据写回 Markdown */
function tableDataToMarkdown({ headers, body }: TableData): string {
  const separator = headers.map(() => '---');
  const headerLine = `| ${headers.join(' | ')} |`;
  const sepLine = `| ${separator.join(' | ')} |`;
  const bodyLines = body.map((row) => {
    const cells = headers.map((_, i) => row[i] ?? '');
    return `| ${cells.join(' | ')} |`;
  });
  return [headerLine, sepLine, ...bodyLines].join('\n');
}

/** 按目标列数、数据行数调整表格（保留已有单元格内容） */
function resizeTableData(data: TableData, cols: number, bodyRows: number): TableData {
  const safeCols = Math.max(1, cols);
  const safeRows = Math.max(0, bodyRows);
  const headers = Array.from({ length: safeCols }, (_, i) => data.headers[i] ?? '');
  const body = Array.from({ length: safeRows }, (_, r) =>
    Array.from({ length: safeCols }, (_, c) => data.body[r]?.[c] ?? '')
  );
  return { headers, body };
}

interface CodeBlockData {
  lang: string;
  code: string;
}

/** 常用代码高亮语言（id 对应 highlight.js 语言名） */
const CODE_LANGUAGES: { id: string; label: string }[] = [
  { id: '', label: '纯文本' },
  { id: 'go', label: 'Go' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'rust', label: 'Rust' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'bash', label: 'Bash' },
  { id: 'shell', label: 'Shell' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'xml', label: 'XML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'swift', label: 'Swift' },
  { id: 'dockerfile', label: 'Dockerfile' },
];

/** 从 Markdown 代码块解析语言与正文 */
function parseMarkdownCode(raw: string): CodeBlockData | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return null;

  const firstLineEnd = trimmed.indexOf('\n');
  if (firstLineEnd === -1) {
    const lang = trimmed.slice(3).replace(/`+$/, '').trim();
    return { lang, code: '' };
  }

  const lang = trimmed.slice(3, firstLineEnd).trim();
  let body = trimmed.slice(firstLineEnd + 1);
  const closeIdx = body.lastIndexOf('```');
  if (closeIdx !== -1) {
    body = body.slice(0, closeIdx);
  }

  return { lang, code: body.replace(/\n$/, '') };
}

/** 将代码块数据写回 Markdown */
function codeBlockToMarkdown({ lang, code }: CodeBlockData): string {
  if (!code) return `\`\`\`${lang}\n\`\`\``;
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

function htmlToTableMarkdown(html: string): string {
  if (typeof window === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return cleanInlineHtml(html);
  
  const markdownRows: string[] = [];
  
  const theadRows = table.querySelectorAll('thead tr');
  theadRows.forEach((row) => {
    const cols = Array.from(row.querySelectorAll('th, td')).map((col) => cleanTableCellHtml((col as HTMLElement).innerHTML));
    markdownRows.push(`| ${cols.join(' | ')} |`);

    const separators = cols.map(() => '---');
    markdownRows.push(`| ${separators.join(' | ')} |`);
  });

  const tbodyRows = table.querySelectorAll('tbody tr');
  tbodyRows.forEach((row) => {
    const cols = Array.from(row.querySelectorAll('th, td')).map((col) => cleanTableCellHtml((col as HTMLElement).innerHTML));
    markdownRows.push(`| ${cols.join(' | ')} |`);
  });
  
  return markdownRows.join('\n');
}

function convertHtmlBlockToMarkdown(block: BlockItem, html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 优先从实际 HTML 结构推断块类型（WYSIWYG 工具栏会改标签）
  const heading = doc.body.querySelector('h1,h2,h3,h4,h5,h6');
  if (heading) {
    const level = parseInt(heading.tagName.substring(1), 10);
    const hashes = '#'.repeat(level);
    return `${hashes} ${cleanInlineHtml(heading.innerHTML).trim()}`;
  }

  const blockquote = doc.body.querySelector('blockquote');
  if (blockquote) {
    return `> ${cleanInlineHtml(blockquote.innerHTML).trim()}`;
  }

  const table = doc.body.querySelector('table');
  if (table || block.type === 'table') {
    return htmlToTableMarkdown(html);
  }

  const listEl = doc.body.querySelector('ul,ol');
  if (listEl || block.type === 'list') {
    return htmlToListMarkdown(html, listEl?.tagName.toLowerCase() === 'ol' || block.raw.trim().startsWith('1.'));
  }

  const pre = doc.body.querySelector('pre');
  if (pre || block.type === 'code') {
    const match = block.raw.match(/^```([a-zA-Z0-9+#.-]*)/);
    const lang = match ? match[1] : '';
    // 从高亮后的 pre 取纯文本，忽略 hljs 的 span 标签
    const cleanCode = (pre?.textContent || doc.body.textContent || '')
      .replace(/^\n+/, '')
      .replace(/\s+$/, '');
    return codeBlockToMarkdown({ lang, code: cleanCode });
  }

  // 标题被切换为普通段落时，输出纯文本
  return cleanInlineHtml(html).trim();
}

/** 判断选区是否在表格单元格内 */
function getTableCellFromSelection(): HTMLTableCellElement | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  let node: Node | null = selection.anchorNode;
  if (node?.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  if (!(node instanceof HTMLElement)) return null;

  return node.closest('td, th');
}

/** 工具栏防抢焦点：不拦截 select / button 的默认点击 */
function handleToolbarMouseDown(e: React.MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest('select, button, option, input, label, a')) return;
  e.preventDefault();
}

/** 表格顶部：调整列数与数据行数 */
function TableSizeToolbar({
  tableData,
  onResize,
}: {
  tableData: TableData;
  onResize: (cols: number, bodyRows: number) => void;
}) {
  const cols = tableData.headers.length;
  const bodyRows = tableData.body.length;

  const apply = (nextCols: number, nextBodyRows: number) => {
    onResize(Math.max(1, nextCols), Math.max(0, nextBodyRows));
  };

  return (
    <div
      className="not-prose relative z-10 mb-1.5 flex flex-wrap items-center gap-3 rounded-sm border border-brand-border/40 bg-brand-sidebar/30 px-2 py-1 text-xs text-gray-600 dark:text-neutral-300"
      contentEditable={false}
      onMouseDown={handleToolbarMouseDown}
    >
      <span className="font-semibold text-brand-rust">表格</span>

      <div className="flex items-center gap-1">
        <span>列</span>
        <button
          type="button"
          onClick={() => apply(cols - 1, bodyRows)}
          disabled={cols <= 1}
          className="rounded p-0.5 hover:bg-brand-border/50 disabled:opacity-30"
          title="减少列"
        >
          <Minus size={12} />
        </button>
        <span className="min-w-[1.25rem] text-center font-mono font-semibold">{cols}</span>
        <button
          type="button"
          onClick={() => apply(cols + 1, bodyRows)}
          className="rounded p-0.5 hover:bg-brand-border/50"
          title="增加列"
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <span>行</span>
        <button
          type="button"
          onClick={() => apply(cols, bodyRows - 1)}
          disabled={bodyRows <= 0}
          className="rounded p-0.5 hover:bg-brand-border/50 disabled:opacity-30"
          title="减少数据行"
        >
          <Minus size={12} />
        </button>
        <span className="min-w-[1.25rem] text-center font-mono font-semibold">{bodyRows}</span>
        <button
          type="button"
          onClick={() => apply(cols, bodyRows + 1)}
          className="rounded p-0.5 hover:bg-brand-border/50"
          title="增加数据行"
        >
          <Plus size={12} />
        </button>
      </div>

      <span className="text-[10px] text-gray-400">不含表头 · 禁止手动换行，长文本自动折行显示</span>
    </div>
  );
}

/** 代码块顶部：选择高亮语言 */
function CodeLangToolbar({
  lang,
  onChange,
}: {
  lang: string;
  onChange: (lang: string) => void;
}) {
  const options = [...CODE_LANGUAGES];
  // 文档里已有但不在预设列表中的语言，也展示出来
  if (lang && !options.some((item) => item.id === lang)) {
    options.splice(1, 0, { id: lang, label: lang });
  }

  return (
    <div
      className="not-prose relative z-10 mb-1 flex flex-wrap items-center gap-2 border-b border-brand-border/40 pb-1.5 text-[11px] text-gray-500 dark:text-neutral-400"
      contentEditable={false}
      onMouseDown={handleToolbarMouseDown}
    >
      <span className="font-medium text-gray-700 dark:text-neutral-300">代码</span>
      <span className="text-brand-border/80">|</span>

      <label className="flex items-center gap-1.5">
        <span>语言</span>
        <div className="relative inline-flex items-center">
          <select
            value={lang}
            onChange={(e) => onChange(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            className="appearance-none cursor-pointer rounded-sm border border-brand-border/50 bg-white/80 py-0.5 pl-2 pr-6 font-mono text-[11px] text-gray-800 shadow-none transition-colors hover:border-brand-border focus:border-brand-rust focus:outline-none dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100"
          >
            {options.map((item) => (
              <option key={item.id || 'plaintext'} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={11}
            className="pointer-events-none absolute right-1.5 text-gray-400"
            aria-hidden
          />
        </div>
      </label>

      <span className="text-[10px] text-gray-400">
        {lang ? `按 ${lang} 语法高亮` : '未指定语言，将自动检测'}
      </span>
    </div>
  );
}

// ---------------- Main Preview Component ----------------

export default function Preview({
  markdown,
  onChangeMarkdown,
  isReadMode,
  currentFileId,
  items,
}: PreviewProps) {
  // Parse markdown into discrete blocks for fine-grained in-place editing
  const getBlocks = (text: string): BlockItem[] => {
    if (!text) return [];
    
    const segments = text.split(/\n\n+/);
    return segments.map((raw, idx) => {
      let type: BlockItem['type'] = 'paragraph';
      const trimmed = raw.trim();
      
      if (trimmed.startsWith('#')) {
        type = 'heading';
      } else if (trimmed.startsWith('```')) {
        type = 'code';
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        type = 'list';
      } else if (trimmed.startsWith('|')) {
        type = 'table';
      }
      
      return { id: idx, raw, type };
    });
  };

  const blocks = getBlocks(markdown);

  // Parse modified block HTML inner content back into standard State markdown
  const handleSaveBlockContent = useCallback((block: BlockItem, htmlContent: string) => {
    if (!onChangeMarkdown) return;

    const newBlockRaw = convertHtmlBlockToMarkdown(block, htmlContent);
    if (newBlockRaw === block.raw) return;

    const updatedBlocks = blocks.map((b) => {
      if (b.id === block.id) {
        return { ...b, raw: newBlockRaw };
      }
      return b;
    });

    const newMarkdown = updatedBlocks.map((b) => b.raw).join('\n\n');
    onChangeMarkdown(newMarkdown);
  }, [blocks, onChangeMarkdown]);

  /** 调整表格行列并写回 Markdown */
  const handleResizeTable = useCallback((block: BlockItem, cols: number, bodyRows: number) => {
    if (!onChangeMarkdown) return;
    const parsed = parseMarkdownTable(block.raw);
    if (!parsed) return;

    const resized = resizeTableData(parsed, cols, bodyRows);
    const newRaw = tableDataToMarkdown(resized);
    if (newRaw === block.raw) return;

    const updatedBlocks = blocks.map((b) =>
      b.id === block.id ? { ...b, raw: newRaw } : b
    );
    onChangeMarkdown(updatedBlocks.map((b) => b.raw).join('\n\n'));
  }, [blocks, onChangeMarkdown]);

  /** 修改代码块语言并写回 Markdown */
  const handleChangeCodeLang = useCallback((block: BlockItem, lang: string) => {
    if (!onChangeMarkdown) return;
    const parsed = parseMarkdownCode(block.raw);
    if (!parsed) return;

    const newRaw = codeBlockToMarkdown({ lang, code: parsed.code });
    if (newRaw === block.raw) return;

    const updatedBlocks = blocks.map((b) =>
      b.id === block.id ? { ...b, raw: newRaw } : b
    );
    onChangeMarkdown(updatedBlocks.map((b) => b.raw).join('\n\n'));
  }, [blocks, onChangeMarkdown]);

  /** 表格块内禁止回车换行 */
  const handleEditableKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    inTable: boolean
  ) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
      return;
    }

    // 表格内禁止 Enter / Shift+Enter 换行
    if (inTable && e.key === 'Enter') {
      const cell = getTableCellFromSelection();
      if (cell && e.currentTarget.contains(cell)) {
        e.preventDefault();
      }
    }
  };

  /** 粘贴到表格时去掉换行 */
  const handleEditablePaste = (
    e: React.ClipboardEvent<HTMLDivElement>,
    inTable: boolean
  ) => {
    if (!inTable) return;
    const cell = getTableCellFromSelection();
    if (!cell || !e.currentTarget.contains(cell)) return;

    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ');
    document.execCommand('insertText', false, text);
  };

  // 监听工具栏格式变更，即时同步当前块到 Markdown 源码
  useEffect(() => {
    const onSyncBlock = (event: Event) => {
      const { blockId, html } = (event as CustomEvent<{ blockId: number; html: string }>).detail;
      const block = blocks.find((b) => b.id === blockId);
      if (block) handleSaveBlockContent(block, html);
    };
    window.addEventListener('one-mark-sync-block', onSyncBlock);
    return () => window.removeEventListener('one-mark-sync-block', onSyncBlock);
  }, [blocks, handleSaveBlockContent]);

  // Helper to compile markdown block to HTML & resolve static images
  const renderBlockHtml = (rawText: string): { __html: string } => {
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const resolvedText = rawText.replace(imgRegex, (match, alt, url) => {
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return match;
      }
      
      const currentFolderId = currentFileId.substring(0, currentFileId.lastIndexOf('/')) || 'root';
      const cleanUrl = url.replace(/^\.\//, '');
      const finalId = `${currentFolderId}/${cleanUrl}`;
      const asset = items[finalId];
      
      if (asset && asset.dataUrl) {
        return `![${alt}](${asset.dataUrl})`;
      }

      const baseName = cleanUrl.split('/').pop();
      const matchAsset = Object.values(items).find(
        (item: any) => item.type === 'file' && item.name === baseName && item.dataUrl
      ) as any;
      if (matchAsset) {
        return `![${alt}](${matchAsset.dataUrl})`;
      }

      return match;
    });

    try {
      const options = {
        gfm: true,
        breaks: true,
      };
      
      let parsedHtml = marked.parse(resolvedText, options) as string;
      // Convert <del> tags to <s> so that browser's contenteditable execCommand('strikeThrough') can natively toggle them
      parsedHtml = parsedHtml.replace(/<del>/g, '<s>').replace(/<\/del>/g, '</s>');
      return { __html: parsedHtml };
    } catch (err) {
      return { __html: `<p class="text-red-500">解析错误</p>` };
    }
  };

  if (!markdown || markdown.trim() === '') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-gray-400 dark:text-neutral-500">
        <FileText size={48} className="mb-3 opacity-60" />
        <p className="text-sm">暂无内容，请导入或选择一个文档开始创作</p>
      </div>
    );
  }

  return (
    <div id="md-preview-container" className="prose max-w-none px-6 py-3 text-sm leading-relaxed text-gray-800 dark:text-neutral-200 dark:prose-invert">
      {onChangeMarkdown ? (
        <div>
          {blocks.map((block) => {
            const isTable = block.type === 'table';
            const isCode = block.type === 'code';
            const tableData = isTable ? parseMarkdownTable(block.raw) : null;
            const codeData = isCode ? parseMarkdownCode(block.raw) : null;
            const canEditBlock = isReadMode && !!onChangeMarkdown;

            const editable = (
              <div
                data-block-id={block.id}
                className="markdown-body select-text outline-none focus:outline-none"
                contentEditable={canEditBlock}
                suppressContentEditableWarning={true}
                onBlur={(e) => {
                  if (canEditBlock) handleSaveBlockContent(block, e.currentTarget.innerHTML);
                }}
                onKeyDown={(e) => handleEditableKeyDown(e, isTable)}
                onPaste={(e) => handleEditablePaste(e, isTable)}
                dangerouslySetInnerHTML={renderBlockHtml(block.raw)}
              />
            );

            return (
              <div
                key={block.id}
                className={
                  isTable ? 'wysiwyg-table-block' : isCode ? 'wysiwyg-code-block' : undefined
                }
              >
                {isTable && tableData && (
                  <TableSizeToolbar
                    tableData={tableData}
                    onResize={(cols, bodyRows) => handleResizeTable(block, cols, bodyRows)}
                  />
                )}
                {isCode && codeData && (
                  <CodeLangToolbar
                    lang={codeData.lang}
                    onChange={(nextLang) => handleChangeCodeLang(block, nextLang)}
                  />
                )}
                {editable}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="markdown-body select-text"
          dangerouslySetInnerHTML={renderBlockHtml(markdown)}
        />
      )}
    </div>
  );
}
