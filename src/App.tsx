import React, { useState, useEffect, useCallback } from 'react';
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
import { 
  WorkspaceItem, WorkspaceFile, WorkspaceFolder, 
  DEFAULT_INITIAL_DATA, UserMode 
} from './types';
import { 
  scanNativeDirectory, loadNativeFileContent, saveNativeFileContent 
} from './utils/fileSystem';

// Tauri 插件抛出的错误可能是字符串而非 Error 对象，统一提取可读信息
function errMsg(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof (err as any).message === 'string') return (err as any).message;
  return String(err);
}

export default function App() {
  // Theme & Mode states (custom theme support)
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('markdown_theme') || 'classic';
  });
  const mode = 'write';

  useEffect(() => {
    localStorage.setItem('markdown_theme', theme);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'obsidian' || theme === 'cyberpunk') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  
  // Workspace state
  const [items, setItems] = useState<Record<string, WorkspaceItem>>({});
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [workspaceType, setWorkspaceType] = useState<'native' | 'virtual'>('virtual');
  const [workspaceName, setWorkspaceName] = useState('沙盒虚拟工作空间');
  const [nativeDirectoryHandle, setNativeDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Message notifications and status triggers
  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'success' | 'info' | 'error' }[]>([]);

  const addToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // 1. Initial workspace loader
  useEffect(() => {
    const saved = localStorage.getItem('markdown_workspace_items_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setItems(parsed);
        // Find first file markdown to activate by default
        const mdFile = Object.values(parsed).find(item => (item as any).type === 'file' && (item as any).name.endsWith('.md')) as WorkspaceFile;
        if (mdFile) {
          setActiveFileId(mdFile.id);
        }
      } catch (e) {
        setItems(DEFAULT_INITIAL_DATA);
        setActiveFileId('root/readme.md');
      }
    } else {
      setItems(DEFAULT_INITIAL_DATA);
      setActiveFileId('root/readme.md');
    }
  }, []);

  // Save virtual workspace state to Local Storage
  const persistVirtualWorkspace = (updatedItems: Record<string, WorkspaceItem>) => {
    if (workspaceType === 'virtual') {
      localStorage.setItem('markdown_workspace_items_v2', JSON.stringify(updatedItems));
    }
  };

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
            const { scanTauriDirectory, loadTauriFileContent } = await import('./utils/fileSystem');
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
        addToast('您的浏览器不支持 Direct Disk Access API，已为您自动进入安全隔离的沙盒虚拟工作空间。', 'error');
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
    persistVirtualWorkspace(updatedItems);

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
    persistVirtualWorkspace(nextItems);

    if (type === 'file') {
      setActiveFileId(newId);
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

  // Delete an item from tree
  const handleDeleteItem = async (itemId: string) => {
    const item = items[itemId];
    if (!item) return;

    const parentId = item.parentId || 'root';
    const parentFolder = items[parentId] as WorkspaceFolder;
    if (!parentFolder) return;

    // confirm deletes
    if (!confirm(`确定要永久删除 ${item.type === 'file' ? '文件' : '文件夹'} "${item.name}" 吗？此操作无法撤销。`)) {
      return;
    }

    if (workspaceType === 'native') {
      try {
        if (parentFolder.handle) {
          await parentFolder.handle.removeEntry(item.name, { recursive: true });
        } else if (item.tauriPath) {
          const { remove } = await import('@tauri-apps/plugin-fs');
          await remove(item.tauriPath, { recursive: true });
        }
      } catch (err: any) {
        addToast(`本地磁盘物理删除失败: ${errMsg(err)}`, 'error');
        return;
      }
    }

    const nextItems = { ...items };
    // Remove node recursive
    deleteNodeHelper(nextItems, itemId);

    // Remove from parents
    nextItems[parentId] = {
      ...parentFolder,
      children: parentFolder.children.filter(id => id !== itemId),
    } as WorkspaceFolder;

    setItems(nextItems);
    persistVirtualWorkspace(nextItems);

    // If active file is deleted, resolve default active tab
    if (activeFileId === itemId || activeFileId?.startsWith(itemId + '/')) {
      const remainingFiles = Object.values(nextItems).filter(i => (i as any).type === 'file') as WorkspaceFile[];
      if (remainingFiles.length > 0) {
        setActiveFileId(remainingFiles[0].id);
      } else {
        setActiveFileId(null);
      }
    }

    addToast(`已成功删除: "${item.name}"`, 'info');
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
    persistVirtualWorkspace(nextItems);

    if (activeFileId === itemId) {
      setActiveFileId(newId);
    }

    addToast(`已成功重命名为 "${newName}"`, 'success');
  };

  // Reset virtual workspace back to initial sandbox tutorial state
  const handleResetVirtualWorkspace = () => {
    if (confirm('确定要清除所有沙盒内容并恢复到初始默认教程文档吗？此操作会抹除您在虚拟隔离区中的改动。')) {
      localStorage.removeItem('markdown_workspace_items_v2');
      setItems(DEFAULT_INITIAL_DATA);
      setActiveFileId('root/readme.md');
      setWorkspaceType('virtual');
      setWorkspaceName('沙盒虚拟工作空间');
      addToast('已将沙盒虚拟工作空间恢复至初始演示配置！', 'info');
    }
  };

  // Client-side ZIP/Collection download fallback representation
  // Since we are pure-client side, we compiles files into a single master JSON export
  // containing all documents content and raw image elements which can be re-imported!
  const handleExportVirtualCollection = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `markdown-workspace-backup.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      addToast('工作空间备份包 JSON 导出成功，您可以随时将其保存或重载！', 'success');
    } catch (e) {
      addToast('打包导出文档失败', 'error');
    }
  };

  // Drag-and-drop file listener for workspace loading
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    // Detect target folder. Auto place inside images if dropping an image
    const firstDropped = droppedFiles[0];
    const isImage = firstDropped.type.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(firstDropped.name);
    const targetFolderId = isImage && items['root/images'] ? 'root/images' : 'root';

    const reader = new FileReader();
    if (firstDropped.name.toLowerCase().endsWith('.md') || firstDropped.name.toLowerCase().endsWith('.txt')) {
      reader.onload = () => {
        handleCreateItem(targetFolderId, firstDropped.name, 'file', reader.result as string);
      };
      reader.readAsText(firstDropped);
    } else {
      reader.onload = () => {
        handleCreateItem(targetFolderId, firstDropped.name, 'file', '', {
          mimeType: firstDropped.type,
          dataUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(firstDropped);
    }
  };

  // Tauri window control actions helper
  const handleTauriWindowAction = async (action: 'close' | 'minimize' | 'maximize' | 'fullscreen') => {
    const isTauri = typeof window !== 'undefined' && (
      (window as any).__TAURI_INTERNALS__ !== undefined ||
      (window as any).__TAURI__ !== undefined ||
      navigator.userAgent.toLowerCase().includes('tauri')
    );
    if (isTauri) {
      try {
        let win;
        try {
          const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          win = getCurrentWebviewWindow();
        } catch {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          win = getCurrentWindow();
        }

        if (action === 'close') {
          await win.close();
        } else if (action === 'minimize') {
          await win.minimize();
        } else if (action === 'maximize') {
          // Windows 行为：maximize/unmaximize 切换
          const maximized = await win.isMaximized();
          if (maximized) {
            await win.unmaximize();
          } else {
            await win.maximize();
          }
        } else if (action === 'fullscreen') {
          // macOS 行为：全屏/退出全屏 切换
          const fullscreen = await win.isFullscreen();
          await win.setFullscreen(!fullscreen);
        }
      } catch (e) {
        console.error('Tauri window action failed:', e);
      }
    } else {
      addToast(`在 Web 网页浏览器中，已模拟的桌面客户端原生 ${action === 'close' ? '关闭' : action === 'minimize' ? '最小化' : '自适应最大化'} 动作！`, 'info');
    }
  };

  return (
    <div 
      className="h-screen overflow-hidden flex flex-col font-sans transition-colors duration-200 text-sm bg-brand-cream text-gray-800 border border-brand-border/60 shadow-2xl"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Titlebar
        onMinimize={() => handleTauriWindowAction('minimize')}
        onMaximize={() => handleTauriWindowAction('maximize')}
        onFullscreen={() => handleTauriWindowAction('fullscreen')}
        onClose={() => handleTauriWindowAction('close')}
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

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Directory Sidebar */}
        <Sidebar 
          items={items}
          rootId="root"
          activeFileId={activeFileId}
          onSelectFile={handleSelectFile}
          onCreateItem={handleCreateItem}
          onDeleteItem={handleDeleteItem}
          onRenameItem={handleRenameItem}
          workspaceType={workspaceType}
          onPromptNativeFolder={handleConnectLocalFolder}
          onResetVirtualWorkspace={handleResetVirtualWorkspace}
          onExportVirtualZip={handleExportVirtualCollection}
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
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-brand-cream select-none">
              <FileText size={56} className="text-brand-rust mb-4 animate-pulse" />
              <h3 className="text-lg font-serif font-black text-gray-800 dark:text-neutral-100 mb-1">未选中或没有打开任何文档</h3>
              <p className="text-xs font-serif text-gray-400 max-w-xs mb-6">
                请在左侧树目录双击选择一篇 Markdown 进行编写，或在关联成功后新建文档。
              </p>
              {workspaceType !== 'native' && (
                <button
                  onClick={handleConnectLocalFolder}
                  className="rounded bg-[#1a1a1a] hover:bg-brand-rust text-white font-semibold text-xs px-5 py-2.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer animate-bounce"
                >
                  关联项目磁盘文件夹
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
