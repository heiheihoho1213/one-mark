import type { WorkspaceItem, WorkspaceFile } from '../types';

/** 将 Markdown 图片路径解析为可展示的 src（http/data/工作区资源） */
export function resolveImageUrl(
  url: string,
  items: Record<string, WorkspaceItem>,
  currentFileId: string
): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  const currentFolderId = currentFileId.substring(0, currentFileId.lastIndexOf('/')) || 'root';
  const targetId = url.replace(/^\.\//, '');
  const finalId = `${currentFolderId}/${targetId}`;

  const direct = items[finalId] as WorkspaceFile | undefined;
  if (direct?.dataUrl) return direct.dataUrl;

  const baseName = targetId.split('/').pop();
  const match = Object.values(items).find(
    (item) => item.type === 'file' && item.name === baseName && (item as WorkspaceFile).dataUrl
  ) as WorkspaceFile | undefined;
  if (match?.dataUrl) return match.dataUrl;

  return url;
}
