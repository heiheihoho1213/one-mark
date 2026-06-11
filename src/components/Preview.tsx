import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { Edit3, Check, X, FileText } from 'lucide-react';

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

function htmlToTableMarkdown(html: string): string {
  if (typeof window === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return cleanInlineHtml(html);
  
  const markdownRows: string[] = [];
  
  const theadRows = table.querySelectorAll('thead tr');
  theadRows.forEach((row) => {
    const cols = Array.from(row.querySelectorAll('th, td')).map((col) => cleanInlineHtml((col as HTMLElement).innerHTML));
    markdownRows.push(`| ${cols.join(' | ')} |`);
    
    const separators = cols.map(() => '---');
    markdownRows.push(`| ${separators.join(' | ')} |`);
  });
  
  const tbodyRows = table.querySelectorAll('tbody tr');
  tbodyRows.forEach((row) => {
    const cols = Array.from(row.querySelectorAll('th, td')).map((col) => cleanInlineHtml((col as HTMLElement).innerHTML));
    markdownRows.push(`| ${cols.join(' | ')} |`);
  });
  
  return markdownRows.join('\n');
}

function convertHtmlBlockToMarkdown(block: BlockItem, html: string): string {
  switch (block.type) {
    case 'heading': {
      const match = block.raw.match(/^(#{1,6})\s*/);
      const hashes = match ? match[1] : '###';
      return `${hashes} ${cleanInlineHtml(html)}`;
    }
    case 'list': {
      const isOrdered = block.raw.trim().startsWith('1.') || /^\d+\./.test(block.raw.trim());
      return htmlToListMarkdown(html, isOrdered);
    }
    case 'code': {
      const match = block.raw.match(/^```([a-zA-Z0-9-]*)/);
      const lang = match ? match[1] : '';
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const textContent = doc.documentElement.textContent || '';
      
      const cleanCode = textContent.replace(/^\n+/, '').replace(/\s+$/, '');
      return `\`\`\`${lang}\n${cleanCode}\n\`\`\``;
    }
    case 'table': {
      return htmlToTableMarkdown(html);
    }
    case 'paragraph':
    default: {
      return cleanInlineHtml(html);
    }
  }
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
  const handleSaveBlockContent = (block: BlockItem, htmlContent: string) => {
    if (!onChangeMarkdown) return;
    
    const newBlockRaw = convertHtmlBlockToMarkdown(block, htmlContent);
    
    // Safety check - if block is completely empty and was a paragraph, we could leave it
    if (newBlockRaw === block.raw) return;

    const updatedBlocks = blocks.map((b) => {
      if (b.id === block.id) {
        return { ...b, raw: newBlockRaw };
      }
      return b;
    });

    const newMarkdown = updatedBlocks.map((b) => b.raw).join('\n\n');
    onChangeMarkdown(newMarkdown);
  };

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
    <div id="md-preview-container" className="prose max-w-none px-6 py-6 text-sm leading-relaxed text-gray-800 dark:text-neutral-200 dark:prose-invert">
      {isReadMode ? (
        <div className="space-y-4">
          <div className="mb-4 rounded bg-brand-border/20 px-3.5 py-2.5 text-xs text-gray-800 dark:text-neutral-200 flex items-center gap-2 select-none border border-brand-border/60">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-rust animate-pulse"></span>
            <span>当前处于<b>即时渲染模式</b>：支持<b>直接原地打字修改</b>，修改后点击空白处即可物理自动落地。</span>
          </div>

          {blocks.map((block) => {
            return (
              <div
                key={block.id}
                className="group relative rounded transition-all duration-150"
              >
                <div 
                  className="markdown-body select-text p-2 rounded border border-transparent outline-none focus:outline-none transition-all duration-150 relative hover:bg-brand-sidebar/20 hover:border-brand-border/40 focus:border-brand-rust/35 focus:bg-brand-cream/90 focus:shadow-xs focus:hover:bg-brand-cream/90 focus:hover:border-brand-rust/35"
                  contentEditable={onChangeMarkdown ? true : false}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    handleSaveBlockContent(block, e.currentTarget.innerHTML);
                  }}
                  onKeyDown={(e) => {
                    // Save on Ctrl/Cmd + Enter
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  dangerouslySetInnerHTML={renderBlockHtml(block.raw)} 
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* Full continuous markdown preview (For Split views) */
        <div 
          className="markdown-body select-text" 
          dangerouslySetInnerHTML={renderBlockHtml(markdown)} 
        />
      )}
    </div>
  );
}
