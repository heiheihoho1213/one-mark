import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, FileText, Settings, Laptop, Moon, Sun, Monitor, 
  HelpCircle, Sparkles, PencilLine, Eye, RefreshCw, X, Check,
  ChevronRight, ArrowLeft, ArrowRight, Download, Terminal, Circle
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Preview from './components/Preview';
import Titlebar from './components/Titlebar';
import DeleteConfirmDialog, { DeleteTarget } from './components/DeleteConfirmDialog';
import CloseWorkspaceDialog from './components/CloseWorkspaceDialog';
import { 
  WorkspaceItem, WorkspaceFile, WorkspaceFolder, 
  UserMode, isMarkdownFileName,
} from './types';
import { 
  scanNativeDirectory, loadNativeFileContent, saveNativeFileContent,
  openMarkdownFileFromPath, scanTauriDirectory, loadTauriFileContent,
  moveWorkspaceItemToTrash,
} from './utils/fileSystem';
import {
  loadSavedTheme, saveTheme, saveWorkspaceSession, loadWorkspaceSession,
  clearWorkspaceSession,
} from './utils/sessionStorage';

// Tauri 插件抛出的错误可能是字符串而非 Error 对象，统一提取可读信息
function errMsg(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof (err as any).message === 'string') return (err as any).message;
  return String(err);
}

export default function App() {
  // Theme & Mode states（主题选择持久化到 localStorage）
  const [theme, setTheme] = useState<string>(() => loadSavedTheme());
  const mode = 'write';

  useEffect(() => {
    saveTheme(theme);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'obsidian' || theme === 'cyberpunk') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  
  // Workspace state（启动时为空白，无沙盒数据）
  const [items, setItems] = useState<Record<string, WorkspaceItem>>({});
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [workspaceType, setWorkspaceType] = useState<'native' | 'empty'>('empty');
  const [workspaceName, setWorkspaceName] = useState('');
  const [nativeDirectoryHandle, setNativeDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  // 标记是否已通过「打开文件」事件加载，避免与自动恢复会话冲突
  const openedViaSystemRef = useRef(false);

  const isTauriEnv = () => typeof window !== 'undefined' && (
    (window as any).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI__ !== undefined ||
    navigator.userAgent.toLowerCase().includes('tauri')
  );

  // Message notifications and status triggers
  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'success' | 'info' | 'error' }[]>([]);
  // 待删除项（弹窗二次确认）
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  // 待关闭的工作区文件夹名
  const [closeWorkspaceName, setCloseWorkspaceName] = useState<string | null>(null);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  /** 将工作区目录与当前文档写入本地存储 */
  const persistWorkspaceSession = useCallback((
    workspaceItems: Record<string, WorkspaceItem>,
    fileId: string | null
  ) => {
    const rootFolder = workspaceItems['root'] as WorkspaceFolder | undefined;
    const workspacePath = rootFolder?.tauriPath;
    if (workspacePath && fileId) {
      saveWorkspaceSession(workspacePath, fileId);
    }
  }, []);

  /** 从磁盘绝对路径导入所在文件夹并打开目标 Markdown 文件 */
  const loadWorkspaceFromFilePath = useCallback(async (filePath: string) => {
    try {
      const result = await openMarkdownFileFromPath(filePath);
      setWorkspaceType('native');
      setWorkspaceName(result.workspaceName);
      setItems(result.items);
      setActiveFileId(result.activeFileId);
      persistWorkspaceSession(result.items, result.activeFileId);
      addToast(`已打开：${result.items[result.activeFileId]?.name ?? filePath}`, 'success');
      return true;
    } catch (err) {
      addToast(`打开文件失败: ${errMsg(err)}`, 'error');
      return false;
    }
  }, [addToast, persistWorkspaceSession]);

  // 同步窗口标题到系统原生标题栏（文档名 — OneMark）
  useEffect(() => {
    const activeFileName = activeFileId && items[activeFileId] ? items[activeFileId].name : null;
    const title = activeFileName ? `${activeFileName} — OneMark` : 'OneMark';
    document.title = title;

    const syncTauriTitle = async () => {
      const isTauri = typeof window !== 'undefined' && (
        (window as any).__TAURI_INTERNALS__ !== undefined ||
        (window as any).__TAURI__ !== undefined ||
        navigator.userAgent.toLowerCase().includes('tauri')
      );
      if (!isTauri) return;

      try {
        let win;
        try {
          const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          win = getCurrentWebviewWindow();
        } catch {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          win = getCurrentWindow();
        }
        await win.setTitle(title);
      } catch (e) {
        console.error('Tauri setTitle failed:', e);
      }
    };
    syncTauriTitle();
  }, [activeFileId, items]);

  // 监听系统「打开方式」传入的文件路径
  useEffect(() => {
    if (!isTauriEnv()) return;

    let unlistenOpen: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;

    const setupListeners = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenOpen = await listen<string[]>('open-files', async (event) => {
        openedViaSystemRef.current = true;
        const filePath = event.payload?.find((p) => /\.(md|markdown|txt)$/i.test(p));
        if (filePath) await loadWorkspaceFromFilePath(filePath);
      });

      // Tauri 原生拖放：拖入 .md 后导入所在文件夹并打开
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const win = getCurrentWebviewWindow();
      unlistenDrop = await win.onDragDropEvent(async (event) => {
        if (event.payload.type !== 'drop') return;
        const filePath = event.payload.paths.find((p) => /\.(md|markdown|txt)$/i.test(p));
        if (filePath) await loadWorkspaceFromFilePath(filePath);
      });
    };

    setupListeners();
    return () => {
      unlistenOpen?.();
      unlistenDrop?.();
    };
  }, [loadWorkspaceFromFilePath]);

  // 启动时恢复上次打开的本地目录与文档（桌面端）
  useEffect(() => {
    if (!isTauriEnv()) return;

    const restoreLastSession = async () => {
      // 稍等系统「打开文件」事件，避免重复加载
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (openedViaSystemRef.current) return;

      const { workspacePath, activeFileId: savedFileId } = loadWorkspaceSession();
      if (!workspacePath) return;

      try {
        const { exists } = await import('@tauri-apps/plugin-fs');
        const pathExists = await exists(workspacePath);
        if (!pathExists) return;

        const scannedItems = await scanTauriDirectory(workspacePath, 'root');
        const pathParts = workspacePath.replace(/\\/g, '/').split('/');
        const dirName = pathParts[pathParts.length - 1] || workspacePath;

        setWorkspaceType('native');
        setWorkspaceName(dirName);
        setItems(scannedItems);

        let targetId = savedFileId && scannedItems[savedFileId] ? savedFileId : null;
        if (!targetId) {
          const firstMd = Object.values(scannedItems).find(
            (item) => item.type === 'file' && item.name.toLowerCase().endsWith('.md')
          );
          targetId = firstMd?.id ?? null;
        }

        if (targetId && scannedItems[targetId]?.type === 'file') {
          const file = scannedItems[targetId] as WorkspaceFile;
          const details = await loadTauriFileContent(file);
          const updatedFile = { ...file, content: details.content, dataUrl: details.dataUrl } as WorkspaceFile;
          setItems((prev) => ({ ...prev, [targetId!]: updatedFile }));
          setActiveFileId(targetId);
          persistWorkspaceSession({ ...scannedItems, [targetId]: updatedFile }, targetId);
        } else {
          setActiveFileId(null);
        }
      } catch (err) {
        console.error('恢复上次工作区失败:', err);
      }
    };

    restoreLastSession();
  }, [persistWorkspaceSession]);

  // 切换文档时同步保存当前打开的文件
  useEffect(() => {
    if (workspaceType !== 'native' || !activeFileId) return;
    persistWorkspaceSession(items, activeFileId);
  }, [activeFileId, workspaceType, items, persistWorkspaceSession]);

  /** 从磁盘重新扫描工作区，合并已加载的文件内容 */
  const refreshWorkspace = useCallback(async (preferredActiveId?: string | null) => {
    if (workspaceType !== 'native') return;

    const rootFolder = items['root'] as WorkspaceFolder | undefined;
    if (!rootFolder) return;

    try {
      let scannedItems: Record<string, WorkspaceItem>;

      if (rootFolder.tauriPath) {
        scannedItems = await scanTauriDirectory(rootFolder.tauriPath, 'root');
      } else if (rootFolder.handle) {
        scannedItems = await scanNativeDirectory(rootFolder.handle, 'root');
      } else {
        return;
      }

      // 保留内存中已加载的正文，避免刷新后丢失编辑内容
      const mergedItems = { ...scannedItems };
      Object.entries(items).forEach(([id, oldItem]) => {
        const node = oldItem as WorkspaceItem;
        if (node.type !== 'file') return;
        const oldFile = node as WorkspaceFile;
        const newFile = mergedItems[id] as WorkspaceFile | undefined;
        if (newFile?.type === 'file' && (oldFile.content || oldFile.dataUrl)) {
          mergedItems[id] = { ...newFile, content: oldFile.content, dataUrl: oldFile.dataUrl };
        }
      });

      let nextActiveId = preferredActiveId ?? activeFileId;
      if (nextActiveId && !mergedItems[nextActiveId]) {
        const firstMd = Object.values(mergedItems).find(
          (i) => i.type === 'file' && isMarkdownFileName(i.name)
        );
        nextActiveId = firstMd?.id ?? null;
      }

      if (nextActiveId && mergedItems[nextActiveId]?.type === 'file') {
        const file = mergedItems[nextActiveId] as WorkspaceFile;
        if (!file.content && !file.dataUrl) {
          if (file.tauriPath) {
            const details = await loadTauriFileContent(file);
            mergedItems[nextActiveId] = { ...file, ...details };
          } else if (file.handle) {
            const details = await loadNativeFileContent(file);
            mergedItems[nextActiveId] = { ...file, ...details };
          }
        }
      }

      setItems(mergedItems);
      setActiveFileId(nextActiveId);
      if (nextActiveId) {
        persistWorkspaceSession(mergedItems, nextActiveId);
      }
    } catch (err) {
      addToast(`刷新目录失败: ${errMsg(err)}`, 'error');
    }
  }, [workspaceType, items, activeFileId, addToast, persistWorkspaceSession]);

  // Native folder picking API (File System Access API or Tauri Native Dialog)
  const handleConnectLocalFolder = async () => {
    try {
      // 1. Check if running inside Tauri Desktop
      const isTauri = typeof window !== 'undefined' && (
        (window as any).__TAURI_INTERNALS__ !== undefined ||
        (window as any).__TAURI__ !== undefined ||
        navigator.userAgent.toLowerCase().includes('tauri')
      );
      if (isTauri) {
        try {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const selected = await open({
            directory: true,
            multiple: false,
            title: '选择本地工作空间文件夹'
          });

          if (selected && typeof selected === 'string') {
            setWorkspaceType('native');
            const pathParts = selected.replace(/\\/g, '/').split('/');
            const dirName = pathParts[pathParts.length - 1] || selected;
            setWorkspaceName(dirName);

            const scannedItems = await scanTauriDirectory(selected, 'root');
            setItems(scannedItems);

            const firstMd = Object.values(scannedItems).find(
              (item) => item.type === 'file' && item.name.toLowerCase().endsWith('.md')
            );
            if (firstMd) {
              const details = await loadTauriFileContent(firstMd as WorkspaceFile);
              const updatedFirstMd = {
                ...firstMd,
                content: details.content,
                dataUrl: details.dataUrl,
              } as WorkspaceFile;

              setItems((prev) => ({
                ...prev,
                [updatedFirstMd.id]: updatedFirstMd,
              }));
              setActiveFileId(updatedFirstMd.id);
              persistWorkspaceSession(
                { ...scannedItems, [updatedFirstMd.id]: updatedFirstMd },
                updatedFirstMd.id
              );
            } else {
              setActiveFileId(null);
            }

            addToast(`成功关联本地物理文件夹：${dirName}`, 'success');
          }
        } catch (err: any) {
          addToast(`Tauri 本地目录关联失败: ${errMsg(err)}`, 'error');
        }
        return;
      }

      // 2. Browser local folder picker fallback
      if (!(window as any).showDirectoryPicker) {
        addToast('您的浏览器不支持本地文件夹访问，请使用桌面客户端。', 'error');
        return;
      }

      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      setNativeDirectoryHandle(dirHandle);
      setWorkspaceType('native');
      setWorkspaceName(dirHandle.name);

      // Read folders recursively lazily
      const scannedItems = await scanNativeDirectory(dirHandle, 'root');
      setItems(scannedItems);

      // Find first file .md to open
      const firstMd = Object.values(scannedItems).find(
        (item) => item.type === 'file' && item.name.toLowerCase().endsWith('.md')
      );
      if (firstMd) {
        // Load its contents lazily
        const details = await loadNativeFileContent(firstMd as WorkspaceFile);
        const updatedFirstMd = {
          ...firstMd,
          content: details.content,
          dataUrl: details.dataUrl,
        } as WorkspaceFile;

        setItems((prev) => ({
          ...prev,
          [updatedFirstMd.id]: updatedFirstMd,
        }));
        setActiveFileId(updatedFirstMd.id);
      } else {
        setActiveFileId(null);
      }

      addToast(`成功关联本地物理文件夹：${dirHandle.name}`, 'success');
    } catch (err: any) {
      console.error(err);
      if (err.name !== 'AbortError') {
        addToast(`关联磁盘目录失败: ${errMsg(err)}`, 'error');
      }
    }
  };

  // Handle lazy reading files when clicked on sidebar tree
  const handleSelectFile = async (fileId: string) => {
    const file = items[fileId] as WorkspaceFile;
    if (!file) return;

    if (workspaceType === 'native' && !file.content && !file.dataUrl) {
      if (file.handle) {
        try {
          const details = await loadNativeFileContent(file);
          const updatedFile = {
            ...file,
            content: details.content,
            dataUrl: details.dataUrl,
          } as WorkspaceFile;

          setItems((prev) => ({
            ...prev,
            [fileId]: updatedFile,
          }));
          setActiveFileId(fileId);
        } catch (err: any) {
          addToast(`加载文件失败: ${errMsg(err)}`, 'error');
        }
      } else if (file.tauriPath) {
        try {
          const { loadTauriFileContent } = await import('./utils/fileSystem');
          const details = await loadTauriFileContent(file);
          const updatedFile = {
            ...file,
            content: details.content,
            dataUrl: details.dataUrl,
          } as WorkspaceFile;

          setItems((prev) => ({
            ...prev,
            [fileId]: updatedFile,
          }));
          setActiveFileId(fileId);
        } catch (err: any) {
          addToast(`加载本地文件失败: ${errMsg(err)}`, 'error');
        }
      }
    } else {
      setActiveFileId(fileId);
    }
  };

  // Save active Markdown file changes
  const handleSaveActiveMarkdown = async (newVal: string) => {
    if (!activeFileId || !items[activeFileId]) return;

    const file = items[activeFileId] as WorkspaceFile;
    const updatedFile = { ...file, content: newVal };

    // Update in React State
    const updatedItems = {
      ...items,
      [activeFileId]: updatedFile,
    };
    setItems(updatedItems);

    // Save physical disk if native workspace is linked
    if (workspaceType === 'native') {
      if (file.handle) {
        try {
          await saveNativeFileContent(updatedFile, newVal);
        } catch (err: any) {
          addToast(`本地同步磁盘失败: ${errMsg(err)}`, 'error');
        }
      } else if (file.tauriPath) {
        try {
          const { saveTauriFileContent } = await import('./utils/fileSystem');
          await saveTauriFileContent(updatedFile, newVal);
        } catch (err: any) {
          addToast(`硬盘本地同步失败: ${errMsg(err)}`, 'error');
        }
      }
    }
  };

  // Add a new file or directory
  const handleCreateItem = async (
    parentId: string,
    name: string,
    type: 'file' | 'directory',
    fileContent = '',
    binaryData?: { mimeType: string; dataUrl: string }
  ) => {
    const parentFolder = items[parentId] as WorkspaceFolder;
    if (!parentFolder) return;

    const newId = `${parentId}/${name}`;
    
    // Prevent duplicated items
    if (items[newId]) {
      addToast(`同名文件/文件夹 "${name}" 已存在！`, 'error');
      return;
    }

    let newItem: WorkspaceItem;

    if (type === 'file') {
      newItem = {
        id: newId,
        name,
        type: 'file',
        content: fileContent,
        mimeType: binaryData?.mimeType,
        dataUrl: binaryData?.dataUrl,
        parentId,
      };

      // Native filesystem writes physical files on your harddrive
      if (workspaceType === 'native') {
        if (parentFolder.handle) {
          try {
            // create file handl
            const fileHandle = await parentFolder.handle.getFileHandle(name, { create: true });
            newItem.handle = fileHandle;
            
            if (binaryData?.dataUrl) {
              // write binary to local disk
              const response = await fetch(binaryData.dataUrl);
              const blob = await response.blob();
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
            } else {
              const writable = await fileHandle.createWritable();
              await writable.write(fileContent);
              await writable.close();
            }
          } catch (err: any) {
            addToast(`磁盘物理写入失败: ${errMsg(err)}`, 'error');
            return;
          }
        } else if (parentFolder.tauriPath) {
          try {
            const { join } = await import('@tauri-apps/api/path');
            const newPath = await join(parentFolder.tauriPath, name);
            newItem.tauriPath = newPath;

            if (binaryData?.dataUrl) {
              const response = await fetch(binaryData.dataUrl);
              const arrayBuffer = await response.arrayBuffer();
              const u8Array = new Uint8Array(arrayBuffer);
              const { writeFile } = await import('@tauri-apps/plugin-fs');
              await writeFile(newPath, u8Array);
            } else {
              const { writeTextFile } = await import('@tauri-apps/plugin-fs');
              await writeTextFile(newPath, fileContent);
            }
          } catch (err: any) {
            addToast(`Tauri 本地文件创建失败: ${errMsg(err)}`, 'error');
            return;
          }
        }
      }
    } else {
      newItem = {
        id: newId,
        name,
        type: 'directory',
        children: [],
        parentId,
      };

      if (workspaceType === 'native') {
        if (parentFolder.handle) {
          try {
            const dirHandle = await parentFolder.handle.getDirectoryHandle(name, { create: true });
            newItem.handle = dirHandle;
          } catch (err: any) {
            addToast(`磁盘创建子文件夹失败: ${errMsg(err)}`, 'error');
            return;
          }
        } else if (parentFolder.tauriPath) {
          try {
            const { join } = await import('@tauri-apps/api/path');
            const newPath = await join(parentFolder.tauriPath, name);
            newItem.tauriPath = newPath;
            
            const { mkdir } = await import('@tauri-apps/plugin-fs');
            await mkdir(newPath);
          } catch (err: any) {
            addToast(`Tauri 创建子文件夹失败: ${errMsg(err)}`, 'error');
            return;
          }
        }
      }
    }

    // Insert to parents listing and state
    const nextParentChildren = [...parentFolder.children, newId];
    const nextItems = {
      ...items,
      [parentId]: {
        ...parentFolder,
        children: nextParentChildren,
      },
      [newId]: newItem,
    };

    setItems(nextItems);

    if (type === 'file') {
      setActiveFileId(newId);
    }

    // 操作完成后从磁盘刷新目录树
    if (workspaceType === 'native') {
      await refreshWorkspace(type === 'file' ? newId : activeFileId);
    }
    
    addToast(`已新建 ${type === 'file' ? '文档' : '文件夹'}: "${name}"`, 'success');
  };

  // Recursively deletes child nodes safely
  const deleteNodeHelper = (nodes: Record<string, WorkspaceItem>, targetId: string) => {
    const node = nodes[targetId];
    if (!node) return;

    if (node.type === 'directory') {
      node.children.forEach(childId => {
        deleteNodeHelper(nodes, childId);
      });
    }
    delete nodes[targetId];
  };

  // 打开关闭工作区确认弹窗
  const handleRequestCloseWorkspace = () => {
    const root = items['root'] as WorkspaceFolder | undefined;
    if (!root || workspaceType !== 'native') return;
    setCloseWorkspaceName(root.name || workspaceName || '当前文件夹');
  };

  // 二次确认后关闭文件夹引用（不删除磁盘文件）
  const executeCloseWorkspace = () => {
    setCloseWorkspaceName(null);
    setWorkspaceType('empty');
    setItems({});
    setActiveFileId(null);
    setWorkspaceName('');
    setNativeDirectoryHandle(null);
    clearWorkspaceSession();
    addToast('已关闭文件夹引用', 'info');
  };

  // 打开删除确认弹窗（第一步）
  const handleRequestDelete = (itemId: string) => {
    const item = items[itemId];
    if (!item) return;

    setDeleteTarget({
      id: itemId,
      name: item.name,
      type: item.type === 'directory' ? 'directory' : 'file',
    });
  };

  // 二次确认后执行：移入回收站
  const executeDeleteItem = async (itemId: string) => {
    setDeleteTarget(null);

    const item = items[itemId];
    if (!item) return;

    const parentId = item.parentId || 'root';
    const parentFolder = items[parentId] as WorkspaceFolder;
    if (!parentFolder) return;

    if (workspaceType === 'native') {
      try {
        await moveWorkspaceItemToTrash(item, parentFolder);
      } catch (err: any) {
        addToast(`移入回收站失败: ${errMsg(err)}`, 'error');
        return;
      }
    }

    const nextItems = { ...items };
    deleteNodeHelper(nextItems, itemId);

    nextItems[parentId] = {
      ...parentFolder,
      children: parentFolder.children.filter(id => id !== itemId),
    } as WorkspaceFolder;

    let nextActiveId = activeFileId;
    if (activeFileId === itemId || activeFileId?.startsWith(itemId + '/')) {
      const remainingFiles = Object.values(nextItems).filter(i => (i as any).type === 'file') as WorkspaceFile[];
      nextActiveId = remainingFiles.length > 0 ? remainingFiles[0].id : null;
    }

    setItems(nextItems);
    setActiveFileId(nextActiveId);

    if (workspaceType === 'native') {
      await refreshWorkspace(nextActiveId);
    }

    addToast(`已移入回收站: "${item.name}"`, 'info');
  };

  // Rename a file or directory
  const handleRenameItem = async (itemId: string, newName: string) => {
    const item = items[itemId];
    if (!item) return;

    const parentId = item.parentId || 'root';
    const parentFolder = items[parentId] as WorkspaceFolder;
    if (!parentFolder) return;

    const newId = `${parentId}/${newName}`;
    
    // Prevent name duplicates
    if (items[newId]) {
      addToast(`该目录下已存在同名元素 "${newName}"`, 'error');
      return;
    }

    if (workspaceType === 'native') {
      if (item.tauriPath) {
        try {
          const { join } = await import('@tauri-apps/api/path');
          const { rename } = await import('@tauri-apps/plugin-fs');
          const parentFolderTauriPath = parentFolder.tauriPath || item.tauriPath.substring(0, item.tauriPath.lastIndexOf('/'));
          const newPath = await join(parentFolderTauriPath, newName);
          await rename(item.tauriPath, newPath);
          item.tauriPath = newPath;
        } catch (err: any) {
          addToast(`Tauri 原地重命名失败: ${errMsg(err)}`, 'error');
          return;
        }
      } else {
        addToast('本地物理文件夹暂不支持直接原地重命名，建议在本地资源管理器中重命名后重新加载。', 'error');
        return;
      }
    }

    const nextItems = { ...items };

    // Create renamed item
    let renamedItem: WorkspaceItem;
    if (item.type === 'file') {
      renamedItem = { ...item, id: newId, name: newName };
    } else {
      // Directories need recursive children ID replacements
      renamedItem = { ...item, id: newId, name: newName, children: [] };
      // For directories, renaming sub-item paths is tedious. 
      // Let's do a fast parent link updates & warn simple fallback or do full replace.
    }

    // Simple rename approach for Virtual FS:
    nextItems[newId] = renamedItem;
    delete nextItems[itemId];

    // Remove old parent reference, update with new link
    nextItems[parentId] = {
      ...parentFolder,
      children: parentFolder.children.map(id => id === itemId ? newId : id),
    } as WorkspaceFolder;

    // Loop through everything to fix files parentIds that pointed to old folder path
    if (item.type === 'directory') {
      Object.keys(nextItems).forEach(id => {
        if (id.startsWith(itemId + '/')) {
          const relativePart = id.substring(itemId.length);
          const newSubId = newId + relativePart;
          const originalSubNode = nextItems[id];
          
          nextItems[newSubId] = {
            ...originalSubNode,
            id: newSubId,
            parentId: originalSubNode.parentId.replace(itemId, newId),
          } as WorkspaceItem;
          
          if (originalSubNode.type === 'directory') {
             // fix children listings as well
             (nextItems[newSubId] as WorkspaceFolder).children = originalSubNode.children.map(cId => cId.replace(itemId, newId));
          }

          delete nextItems[id];
        }
      });
      
      // Update the children list for renamed node
      (nextItems[newId] as WorkspaceFolder).children = item.children.map(cId => cId.replace(itemId, newId));
    }

    setItems(nextItems);

    const nextActiveId = activeFileId === itemId ? newId : activeFileId;
    if (activeFileId === itemId) {
      setActiveFileId(newId);
    }

    // 操作完成后从磁盘刷新目录树
    if (workspaceType === 'native') {
      await refreshWorkspace(nextActiveId);
    }

    addToast(`已成功重命名为 "${newName}"`, 'success');
  };

  // 浏览器环境下的 HTML5 拖放（桌面端由 Tauri onDragDropEvent 处理）
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isTauriEnv()) return;

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const firstDropped = droppedFiles[0];
    if (/\.(md|markdown|txt)$/i.test(firstDropped.name)) {
      addToast('浏览器预览模式无法导入文件夹，请使用桌面版拖放或「打开方式」。', 'info');
      return;
    }

    if (workspaceType !== 'native' || !items['root']) {
      addToast('请先选择本地文件夹，再拖入资源文件。', 'info');
      return;
    }

    const isImage = firstDropped.type.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(firstDropped.name);
    const targetFolderId = isImage && items['root/images'] ? 'root/images' : 'root';

    const reader = new FileReader();
    reader.onload = () => {
      handleCreateItem(targetFolderId, firstDropped.name, 'file', '', {
        mimeType: firstDropped.type,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(firstDropped);
  };

  return (
    <div 
      className="h-screen overflow-hidden flex flex-col font-sans transition-colors duration-200 text-sm bg-brand-cream text-gray-800 border border-brand-border/60 shadow-2xl"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Titlebar
        activeFileName={activeFileId && items[activeFileId] ? items[activeFileId].name : null}
        workspaceName={workspaceName}
        workspaceType={workspaceType}
        activeTheme={theme}
        onThemeChange={setTheme}
      />
      
      {/* Toast Notification Popups */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none select-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className="rounded-lg p-3.5 shadow-lg border text-xs font-semibold flex items-center gap-2.5 bg-brand-cream border-brand-border text-gray-800 dark:text-neutral-200"
            >
              <div className={`h-2.5 w-2.5 rounded-full ${
                toast.type === 'success' ? 'bg-brand-rust' : toast.type === 'error' ? 'bg-red-500' : 'bg-amber-600'
              }`} />
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <DeleteConfirmDialog
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={executeDeleteItem}
      />

      <CloseWorkspaceDialog
        folderName={closeWorkspaceName}
        onCancel={() => setCloseWorkspaceName(null)}
        onConfirm={executeCloseWorkspace}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Directory Sidebar */}
        <Sidebar 
          items={items}
          rootId="root"
          activeFileId={activeFileId}
          onSelectFile={handleSelectFile}
          onCreateItem={handleCreateItem}
          onDeleteItem={handleRequestDelete}
          onRenameItem={handleRenameItem}
          workspaceType={workspaceType}
          onPromptNativeFolder={handleConnectLocalFolder}
          onRequestCloseWorkspace={handleRequestCloseWorkspace}
        />

        {/* Working board layout */}
        <div className="flex-1 overflow-hidden">
          {activeFileId && items[activeFileId] && items[activeFileId].type === 'file' ? (
            <Editor 
              initialMarkdown={(items[activeFileId] as WorkspaceFile).content || ''}
              onSaveMarkdown={handleSaveActiveMarkdown}
              currentFileId={activeFileId}
              items={items}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-8 bg-brand-cream select-none">
              <p className="text-sm text-gray-400 text-center leading-relaxed">
                没有文档，可以拖拽任意文档到窗口中打开
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
