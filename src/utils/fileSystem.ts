import { WorkspaceItem, WorkspaceFile, WorkspaceFolder, isMarkdownFileName } from '../types';

/**
 * Scan a native directory handle recursively and build a workspace tree.
 * To be performance-friendly, file contents and data URLs are loaded lazily.
 */
export async function scanNativeDirectory(
  dirHandle: FileSystemDirectoryHandle,
  parentId = 'root'
): Promise<Record<string, WorkspaceItem>> {
  const items: Record<string, WorkspaceItem> = {};

  // Initialize the directory item
  const dirId = parentId;
  const childIds: string[] = [];

  items[dirId] = {
    id: dirId,
    name: dirHandle.name,
    type: 'directory',
    children: childIds,
    handle: dirHandle,
    parentId: parentId === 'root' ? '' : parentId.substring(0, parentId.lastIndexOf('/')),
  };

  try {
    for await (const entry of (dirHandle as any).values()) {
      const entryId = `${dirId}/${entry.name}`;

      if (entry.kind === 'directory') {
        childIds.push(entryId);
        const subItems = await scanNativeDirectory(entry, entryId);
        Object.assign(items, subItems);
      } else if (isMarkdownFileName(entry.name)) {
        childIds.push(entryId);
        items[entryId] = {
          id: entryId,
          name: entry.name,
          type: 'file',
          content: '',
          mimeType: 'text/markdown',
          handle: entry,
          parentId: dirId,
        };
      }
    }
  } catch (error) {
    console.error('Error scanning directory:', error);
  }

  return items;
}

/**
 * Ask browser for read/write permission to a file system handle
 */
export async function verifyHandlerPermission(
  fileHandle: any,
  readWrite = true
): Promise<boolean> {
  const options: any = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  
  if (typeof fileHandle.queryPermission === 'function') {
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    return false;
  }
  
  return true;
}

/**
 * Lazily load file content from a native file handle
 */
export async function loadNativeFileContent(
  file: WorkspaceFile
): Promise<{ content: string; dataUrl?: string }> {
  if (!file.handle) {
    return { content: file.content, dataUrl: file.dataUrl };
  }

  // Request/verify permissions
  const isGranted = await verifyHandlerPermission(file.handle, false);
  if (!isGranted) {
    throw new Error(`Permisson to read "${file.name}" denied by user.`);
  }

  const fileData = await file.handle.getFile();
  
  // Decide if binary (image) or text
  const isImage = file.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(file.name);
  
  if (isImage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          content: '',
          dataUrl: reader.result as string,
        });
      };
      reader.onerror = () => reject(new Error('Failed to read image asset'));
      reader.readAsDataURL(fileData);
    });
  } else {
    const text = await fileData.text();
    return { content: text };
  }
}

/**
 * Write markdown text content to native file disk
 */
export async function saveNativeFileContent(
  file: WorkspaceFile,
  content: string
): Promise<boolean> {
  if (!file.handle) return false;

  const isGranted = await verifyHandlerPermission(file.handle, true);
  if (!isGranted) {
    throw new Error(`Permission to write "${file.name}" denied by user.`);
  }

  const writable = await file.handle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
}

/**
 * Format markdown images when references are local
 * In native workspace: resolves local file paths (e.g. `images/pic.png`) to base64 Object URLs or dataUrls
 * In virtual workspace: searches the filesystem state matches for correct images dataUrls
 */
export function resolveMarkdownImages(
  markdown: string,
  items: Record<string, WorkspaceItem>,
  currentFileId: string
): string {
  // Pattern: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  return markdown.replace(imgRegex, (match, alt, url) => {
    // Check if the URL is web URL (http:// or https://)
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return match;
    }

    // Attempt to match path relativities
    // Current directory is the parent of currentFileId
    const currentFolderId = currentFileId.substring(0, currentFileId.lastIndexOf('/')) || 'root';
    
    // Normalize relative paths like `./images/pic.png` or `images/pic.png`
    let targetId = url.replace(/^\.\//, '');
    
    // Calculate final ID
    let finalId = `${currentFolderId}/${targetId}`;
    if (!items[finalId]) {
      // Direct lookup by file name as fallback (e.g. just `nature.png` regardless of folder)
      const matches = Object.values(items).filter(
        (item) => item.type === 'file' && item.name === targetId.split('/').pop()
      ) as WorkspaceFile[];
      
      if (matches.length > 0 && matches[0].dataUrl) {
         return `![${alt}](${matches[0].dataUrl})`;
      }
    }

    const matchedItem = items[finalId] as WorkspaceFile;
    if (matchedItem && matchedItem.dataUrl) {
      return `![${alt}](${matchedItem.dataUrl})`;
    }

    return match;
  });
}

/**
 * Scan a local OS directory using Tauri's fs plugin.
 */
export async function scanTauriDirectory(
  dirPath: string,
  parentId = 'root'
): Promise<Record<string, WorkspaceItem>> {
  const items: Record<string, WorkspaceItem> = {};
  const dirId = parentId;
  const childIds: string[] = [];

  const pathParts = dirPath.replace(/\\/g, '/').split('/');
  const dirName = pathParts[pathParts.length - 1] || dirPath;

  items[dirId] = {
    id: dirId,
    name: dirName,
    type: 'directory',
    children: childIds,
    tauriPath: dirPath,
    parentId: parentId === 'root' ? '' : parentId.substring(0, parentId.lastIndexOf('/')),
  };

  try {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    const entries = await readDir(dirPath);

    for (const entry of entries) {
      const isDirectory = entry.isDirectory;
      const entryName = entry.name;
      const entryId = `${dirId}/${entryName}`;
      const entryPath = await join(dirPath, entryName);

      if (isDirectory) {
        childIds.push(entryId);
        const subItems = await scanTauriDirectory(entryPath, entryId);
        Object.assign(items, subItems);
      } else if (entry.isFile && isMarkdownFileName(entryName)) {
        childIds.push(entryId);
        items[entryId] = {
          id: entryId,
          name: entryName,
          type: 'file',
          content: '',
          mimeType: 'text/markdown',
          tauriPath: entryPath,
          parentId: dirId,
        };
      }
    }
  } catch (error) {
    console.error('Error scanning Tauri directory:', error);
  }

  return items;
}

/**
 * Lazily load file content from OS disk using Tauri fs.
 */
export async function loadTauriFileContent(
  file: WorkspaceFile
): Promise<{ content: string; dataUrl?: string }> {
  if (!file.tauriPath) {
    return { content: file.content, dataUrl: file.dataUrl };
  }

  const isImage = file.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(file.name);

  if (isImage) {
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const rawBytes = await readFile(file.tauriPath);
      let binary = '';
      const len = rawBytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(rawBytes[i]);
      }
      const base64String = window.btoa(binary);
      const mime = file.mimeType || 'image/png';
      return {
        content: '',
        dataUrl: `data:${mime};base64,${base64String}`,
      };
    } catch (e) {
      console.error('Tauri load image file failed:', e);
      throw e;
    }
  } else {
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const text = await readTextFile(file.tauriPath);
      return { content: text };
    } catch (e) {
      console.error('Tauri load text file failed:', e);
      throw e;
    }
  }
}

/**
 * Write markdown text content to OS disk using Tauri fs.
 */
export async function saveTauriFileContent(
  file: WorkspaceFile,
  content: string
): Promise<boolean> {
  if (!file.tauriPath) return false;
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(file.tauriPath, content);
    return true;
  } catch (e) {
    console.error('Tauri save file failed:', e);
    throw e;
  }
}

/** 读取 Tauri 文本文件并返回 mtime，供外部变更感知 */
export async function readTauriFileWithMtime(
  file: WorkspaceFile
): Promise<{ content: string; mtime: number } | null> {
  if (!file.tauriPath) return null;
  try {
    const { readTextFile, stat } = await import('@tauri-apps/plugin-fs');
    const [content, meta] = await Promise.all([
      readTextFile(file.tauriPath),
      stat(file.tauriPath),
    ]);
    const mtime =
      meta.mtime instanceof Date
        ? meta.mtime.getTime()
        : typeof meta.mtime === 'number'
          ? meta.mtime
          : Date.now();
    return { content, mtime };
  } catch {
    return null;
  }
}

/** macOS 文件名可能为 NFD，统一为 NFC 便于比较 */
function normalizeUnicode(value: string): string {
  return value.normalize('NFC');
}

/** 判断是否为可通过「打开方式」关联的文本/Markdown 文件 */
export function isOpenableTextPath(filePath: string): boolean {
  return /\.(md|markdown|txt)$/i.test(filePath);
}

/**
 * 从系统传入的绝对路径打开 Markdown 文件：
 * 扫描所在目录为本地工作区，并激活目标文件。
 */
export async function openMarkdownFileFromPath(
  filePath: string
): Promise<{
  items: Record<string, WorkspaceItem>;
  workspaceName: string;
  activeFileId: string;
}> {
  if (!isOpenableTextPath(filePath)) {
    throw new Error('不支持的文件类型');
  }

  const { dirname, basename, normalize } = await import('@tauri-apps/api/path');
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');

  const normalizedPath = normalizeUnicode(await normalize(filePath));
  const dirPath = normalizeUnicode(await dirname(normalizedPath));
  const fileName = normalizeUnicode(await basename(normalizedPath));
  const workspaceName = normalizeUnicode((await basename(dirPath)) || dirPath);

  const fileExists = await exists(normalizedPath);
  if (!fileExists) {
    throw new Error('文件不存在或无权访问');
  }

  let scannedItems = await scanTauriDirectory(dirPath, 'root');
  const fileId = `root/${fileName}`;

  let fileEntry = Object.values(scannedItems).find((item): item is WorkspaceFile => {
    if (item.type !== 'file' || !item.tauriPath) return false;
    const entryName = normalizeUnicode(item.name);
    const entryPath = normalizeUnicode(item.tauriPath);
    return entryName.toLowerCase() === fileName.toLowerCase()
      || entryPath === normalizedPath;
  });

  if (!fileEntry) {
    // 目录扫描未命中时（如 Unicode 规范化差异），直接按路径读取并补入树
    const content = await readTextFile(normalizedPath);
    const root = scannedItems['root'] as WorkspaceFolder | undefined;
    if (!root) {
      scannedItems['root'] = {
        id: 'root',
        name: workspaceName,
        type: 'directory',
        children: [fileId],
        tauriPath: dirPath,
        parentId: '',
      };
    } else if (!root.children.includes(fileId)) {
      root.children.push(fileId);
    }

    fileEntry = {
      id: fileId,
      name: fileName,
      type: 'file',
      content,
      mimeType: fileName.toLowerCase().endsWith('.md') ? 'text/markdown' : 'text/plain',
      tauriPath: normalizedPath,
      parentId: 'root',
    };
    scannedItems[fileId] = fileEntry;
  } else {
    const details = await loadTauriFileContent(fileEntry);
    fileEntry = {
      ...fileEntry,
      content: details.content,
      dataUrl: details.dataUrl,
    };
    scannedItems[fileEntry.id] = fileEntry;
  }

  return {
    items: scannedItems,
    workspaceName,
    activeFileId: fileEntry.id,
  };
}

/**
 * 将工作区文件或文件夹移入系统回收站（桌面端）
 */
export async function moveWorkspaceItemToTrash(
  item: WorkspaceItem,
  parentFolder: WorkspaceFolder
): Promise<void> {
  if (item.tauriPath) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('move_to_trash', { path: item.tauriPath });
    return;
  }

  if (parentFolder.handle) {
    throw new Error('浏览器模式不支持回收站，请使用桌面客户端');
  }

  throw new Error('无法定位文件路径');
}

