import type { InlineContent } from '../ast/types';
import { plainTextOf } from '../ast/inline';

const IMAGE_ONLY_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

/** 判断段落是否仅为一张图片 */
export function parseImageParagraph(content: InlineContent): { alt: string; url: string } | null {
  const plain = plainTextOf(content).trim();
  const match = plain.match(IMAGE_ONLY_RE);
  if (!match) return null;
  return { alt: match[1], url: match[2] };
}

/** 构造图片段落的行内内容 */
export function buildImageParagraph(alt: string, url: string): InlineContent {
  return [{ text: `![${alt}](${url})`, marks: {} }];
}
