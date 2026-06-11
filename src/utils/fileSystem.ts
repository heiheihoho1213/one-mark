import { WorkspaceItem, WorkspaceFile, WorkspaceFolder } from '../types';

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
      childIds.push(entryId);

      if (entry.kind === 'directory') {
        const subItems = await scanNativeDirectory(entry, entryId);
        Object.assign(items, subItems);
      } else {
        // File entry (lazy load details)
        const isMarkdown = entry.name.toLowerCase().endsWith('.md') || entry.name.toLowerCase().endsWith('.markdown') || entry.name.toLowerCase().endsWith('.txt');
        const isImage = /\.(png|jpe?g|gif|svg|webp)$/i.test(entry.name);
        
        let mimeType = 'text/plain';
        if (entry.name.toLowerCase().endsWith('.md')) mimeType = 'text/markdown';
        else if (entry.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        else if (entry.name.toLowerCase().endsWith('.jpg') || entry.name.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (entry.name.toLowerCase().endsWith('.svg')) mimeType = 'image/svg+xml';
        else if (entry.name.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
        else if (entry.name.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

        items[entryId] = {
          id: entryId,
          name: entry.name,
          type: 'file',
          content: isMarkdown ? '' : '', // Lazy load content
          mimeType,
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
      const isFile = entry.isFile;
      const entryName = entry.name;
      
      const entryId = `${dirId}/${entryName}`;
      childIds.push(entryId);

      const entryPath = await join(dirPath, entryName);

      if (isDirectory) {
        const subItems = await scanTauriDirectory(entryPath, entryId);
        Object.assign(items, subItems);
      } else if (isFile) {
        const isMarkdown = entryName.toLowerCase().endsWith('.md') || entryName.toLowerCase().endsWith('.markdown') || entryName.toLowerCase().endsWith('.txt');
        
        let mimeType = 'text/plain';
        if (entryName.toLowerCase().endsWith('.md')) mimeType = 'text/markdown';
        else if (entryName.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        else if (entryName.toLowerCase().endsWith('.jpg') || entryName.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (entryName.toLowerCase().endsWith('.svg')) mimeType = 'image/svg+xml';
        else if (entryName.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
        else if (entryName.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

        items[entryId] = {
          id: entryId,
          name: entryName,
          type: 'file',
          content: '',
          mimeType,
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

