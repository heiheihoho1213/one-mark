import React, { useState, useEffect, useCallback } from 'react';
import { 
  Folder, FolderOpen, FileText, Plus, Trash2, Edit2, ChevronDown, ChevronRight, ChevronLeft,
  HardDrive, Link2, HelpCircle, FolderPlus, FolderX, FolderSearch
} from 'lucide-react';
import { WorkspaceItem, WorkspaceFolder, WorkspaceFile, isMarkdownFileName } from '../types';
import { loadSidebarExpanded, saveSidebarExpanded } from '../utils/sessionStorage';
import { revealItemInParentDirectory } from '../utils/revealInFileManager';

interface SidebarProps {
  items: Record<string, WorkspaceItem>;
  rootId: string;
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onCreateItem: (parentId: string, name: string, type: 'file' | 'directory', fileContent?: string, binaryData?: { mimeType: string; dataUrl: string }) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, newName: string) => void;
  workspaceType: 'native' | 'empty';
  onPromptNativeFolder: () => void;
  onRequestCloseWorkspace?: () => void;
  onNotify?: (text: string, type: 'success' | 'info' | 'error') => void;
}

export default function Sidebar({
  items,
  rootId,
  activeFileId,
  onSelectFile,
  onCreateItem,
  onDeleteItem,
  onRenameItem,
  workspaceType,
  onPromptNativeFolder,
  onRequestCloseWorkspace,
  onNotify,
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'root': true,
    'root/images': true,
  });
  // 工作空间头部（切换文件夹等）是否展开
  const [workspaceHeaderExpanded, setWorkspaceHeaderExpanded] = useState(true);
  // 整个侧边栏是否展开（与目录大纲折叠交互一致）
  const [sidebarExpanded, setSidebarExpanded] = useState(() => loadSidebarExpanded());

  useEffect(() => {
    saveSidebarExpanded(sidebarExpanded);
  }, [sidebarExpanded]);
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreateInput, setShowCreateInput] = useState<{ id: string; type: 'file' | 'directory' } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [itemContextMenu, setItemContextMenu] = useState<{
    x: number;
    y: number;
    itemId: string;
  } | null>(null);

  const closeItemContextMenu = useCallback(() => setItemContextMenu(null), []);

  useEffect(() => {
    if (!itemContextMenu) return;
    const onDismiss = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-sidebar-context-menu]')) return;
      closeItemContextMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeItemContextMenu();
    };
    const timer = window.setTimeout(() => {
      window.addEventListener('click', onDismiss);
      window.addEventListener('contextmenu', onDismiss);
      window.addEventListener('scroll', onDismiss, true);
      window.addEventListener('keydown', onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('click', onDismiss);
      window.removeEventListener('contextmenu', onDismiss);
      window.removeEventListener('scroll', onDismiss, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [itemContextMenu, closeItemContextMenu]);

  const handleItemContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setItemContextMenu({ x: e.clientX, y: e.clientY, itemId });
  };

  const handleRevealInParent = async (itemId: string) => {
    closeItemContextMenu();
    const item = items[itemId];
    if (!item) return;

    const result = await revealItemInParentDirectory(item);
    if ('message' in result) {
      onNotify?.(result.message, 'error');
      return;
    }
    onNotify?.('已在系统文件管理器中打开', 'success');
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Triggers creating a file or folder inside the sidebar input layout
  const handleStartCreation = (parentId: string, type: 'file' | 'directory') => {
    // Auto collapse-expand to ensure user can see the parent's input area
    setExpandedFolders(prev => ({ ...prev, [parentId]: true }));
    setShowCreateInput({ id: parentId, type });
    setNewItemName('');
  };

  const handleFinishCreation = (parentId: string) => {
    if (!newItemName.trim() || !showCreateInput) {
      setShowCreateInput(null);
      return;
    }

    let finalName = newItemName.trim();
    if (showCreateInput.type === 'file') {
      // 去掉用户可能输入的后缀，确认时统一补 .md
      const baseName = finalName.replace(/\.[^./\\]+$/, '').trim() || '新文档';
      finalName = `${baseName}.md`;
    }

    onCreateItem(parentId, finalName, showCreateInput.type);
    setShowCreateInput(null);
    setNewItemName('');
  };

  const handleStartRename = (item: WorkspaceItem) => {
    setEditingItemId(item.id);
    // Markdown 文件仅编辑主文件名，后缀固定为 .md
    if (item.type === 'file' && isMarkdownFileName(item.name)) {
      setRenameValue(item.name.replace(/\.(md|markdown)$/i, '').trim());
    } else {
      setRenameValue(item.name);
    }
  };

  const handleFinishRename = (itemId: string) => {
    const item = items[itemId];
    if (!item) {
      setEditingItemId(null);
      return;
    }

    const trimmed = renameValue.trim();
    if (!trimmed) {
      setEditingItemId(null);
      return;
    }

    let finalName = trimmed;
    if (item.type === 'file' && isMarkdownFileName(item.name)) {
      const baseName = trimmed.replace(/\.[^./\\]+$/, '').trim() || '新文档';
      finalName = `${baseName}.md`;
    }

    if (finalName !== item.name) {
      onRenameItem(itemId, finalName);
    }
    setEditingItemId(null);
  };

  // 侧边栏展示所有文件夹，文件仅展示 Markdown
  const getVisibleChildIds = (folderId: string): string[] => {
    const folder = items[folderId] as WorkspaceFolder | undefined;
    if (!folder?.children) return [];

    return folder.children.filter((childId) => {
      const node = items[childId];
      if (!node) return false;
      if (node.type === 'directory') return true;
      return isMarkdownFileName(node.name);
    });
  };

  // Recursively renders folders and files
  const renderTree = (itemId: string): React.JSX.Element | null => {
    const item = items[itemId];
    if (!item) return null;

    const isFolder = item.type === 'directory';
    const isEditing = editingItemId === item.id;
    const isSelected = activeFileId === item.id;

    if (isFolder) {
      const isExpanded = expandedFolders[item.id] || false;
      const folderChildren = getVisibleChildIds(item.id);

      return (
        <div key={item.id} className="select-none text-xs">
          {/* Folder row */}
          <div
            onContextMenu={(e) => handleItemContextMenu(e, item.id)}
            className={`group flex items-center justify-between rounded px-2 py-1.5 transition-colors duration-150 ${
              isSelected ? 'bg-brand-border/60 text-black dark:bg-neutral-800 dark:text-neutral-100 font-semibold' : 'hover:bg-brand-border/20 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300'
            }`}
          >
            <div className="flex flex-1 items-center gap-1.5 min-w-0" onClick={() => toggleFolder(item.id)}>
              <span className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="text-brand-rust font-medium shrink-0">
                {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
              </span>
              
              {isEditing ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleFinishRename(item.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFinishRename(item.id)}
                  className="w-full bg-white px-1 py-0.5 text-xs text-gray-900 border border-brand-rust focus:outline-hidden dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate py-0.5 cursor-pointer font-medium" title={item.name}>
                  {item.name}
                </span>
              )}
            </div>

            {/* Folder action buttons */}
            {!isEditing && (
              <div className="hidden group-hover:flex items-center gap-1 bg-gradient-to-l from-brand-sidebar pl-3 dark:from-neutral-900 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handleStartCreation(item.id, 'file'); }}
                  className="rounded p-0.5 text-gray-450 hover:bg-brand-border/50 hover:text-brand-rust dark:hover:bg-neutral-700"
                  title="新建 Markdown 文件"
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStartCreation(item.id, 'directory'); }}
                  className="rounded p-0.5 text-gray-450 hover:bg-brand-border/50 hover:text-brand-rust dark:hover:bg-neutral-700"
                  title="新建子文件夹"
                >
                  <FolderPlus size={13} />
                </button>
                {/* 根目录：关闭文件夹引用（不删除磁盘文件） */}
                {item.id === rootId && onRequestCloseWorkspace && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRequestCloseWorkspace(); }}
                    className="rounded p-0.5 text-gray-450 hover:bg-brand-border/50 hover:text-gray-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    title="关闭文件夹引用"
                  >
                    <FolderX size={13} />
                  </button>
                )}
                {item.id !== rootId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStartRename(item); }}
                    className="rounded p-0.5 text-gray-445 hover:bg-brand-border/50 hover:text-black dark:hover:bg-neutral-700 dark:hover:text-white"
                    title="重命名文件夹"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Expanded Children list */}
          {isExpanded && (
            <div className="ml-3 pl-3 border-l border-brand-border dark:border-neutral-800 my-0.5 space-y-0.5">
              {/* Show item creation input inside directory if pending */}
              {showCreateInput && showCreateInput.id === item.id && (
                <div className="flex items-center gap-1.5 ml-5 px-2 py-1.5 bg-brand-border/20 rounded">
                  {showCreateInput.type === 'file' ? (
                    <FileText size={14} className="shrink-0 text-brand-rust" />
                  ) : (
                    <Folder size={14} className="shrink-0 text-brand-rust" />
                  )}
                  {showCreateInput.type === 'file' ? (
                    <div className="flex min-w-0 flex-1 items-center gap-0.5">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onBlur={() => handleFinishCreation(item.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFinishCreation(item.id)}
                        placeholder="新文档"
                        className="min-w-0 flex-1 bg-white px-1 py-0.5 text-xs text-gray-800 border border-brand-rust focus:outline-hidden dark:bg-neutral-900 dark:text-neutral-100"
                        autoFocus
                      />
                      <span className="shrink-0 text-xs text-gray-400 dark:text-neutral-500">.md</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onBlur={() => handleFinishCreation(item.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFinishCreation(item.id)}
                      placeholder="新文件夹"
                      className="w-full bg-white px-1 py-0.5 text-xs text-gray-800 border border-brand-rust focus:outline-hidden dark:bg-neutral-900 dark:text-neutral-100"
                      autoFocus
                    />
                  )}
                </div>
              )}

              {folderChildren.map(childId => renderTree(childId))}

              {folderChildren.length === 0 && !showCreateInput && (
                <div className="text-[10px] text-gray-400 italic pl-5 py-1">暂无 Markdown 文件</div>
              )}
            </div>
          )}
        </div>
      );
    } else {
      if (!isMarkdownFileName(item.name)) return null;

      // File row
      return (
        <div
          key={item.id}
          onContextMenu={(e) => handleItemContextMenu(e, item.id)}
          className={`group flex items-center justify-between rounded px-2 py-1.5 transition-colors duration-150 text-xs cursor-pointer ${
            isSelected 
              ? 'bg-[#1a1a1a] text-[#FCFAF8] dark:bg-brand-rust dark:text-white font-semibold shadow-xs' 
              : 'hover:bg-brand-border/20 text-gray-750 dark:hover:bg-neutral-800 dark:text-neutral-300'
          }`}
          onClick={() => onSelectFile(item.id)}
        >
          <div className="flex flex-1 items-center gap-1.5 min-w-0 ml-5">
            <span className={`${isSelected ? 'text-[#FCFAF8]' : 'text-brand-rust'} shrink-0`}>
              <FileText size={14} />
            </span>

            {isEditing ? (
              <div className="flex min-w-0 flex-1 items-center gap-0.5">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleFinishRename(item.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFinishRename(item.id)}
                  className="min-w-0 flex-1 bg-white px-1 py-0.5 text-xs text-gray-900 border border-brand-rust focus:outline-hidden dark:bg-neutral-900 dark:text-neutral-100"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <span
                  className={`shrink-0 text-xs ${
                    isSelected ? 'text-[#FCFAF8]/70' : 'text-gray-400 dark:text-neutral-500'
                  }`}
                >
                  .md
                </span>
              </div>
            ) : (
              <span className="truncate py-0.5" title={item.name}>
                {item.name}
              </span>
            )}
          </div>

          {!isEditing && (
            <div className="hidden group-hover:flex items-center gap-1 shrink-0 bg-transparent pl-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleStartRename(item); }}
                className={`rounded p-0.5 ${isSelected ? 'text-[#FCFAF8]/80 hover:bg-neutral-900 hover:text-white' : 'text-gray-400 hover:bg-brand-border/60 hover:text-[#1a1a1a] dark:hover:bg-neutral-700 dark:hover:text-white'}`}
                title="重命名文件"
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                className={`rounded p-0.5 ${isSelected ? 'text-[#FCFAF8]/80 hover:bg-neutral-900 hover:text-white' : 'text-gray-400 hover:bg-brand-border/60 hover:text-red-500 dark:hover:bg-neutral-700'}`}
                title="删除文件"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      );
    }
  };

  /** 目录 / Markdown 文件右键菜单 */
  const itemContextMenuNode = itemContextMenu ? (
    <div
      data-sidebar-context-menu
      className="fixed z-[200] min-w-[220px] max-w-[280px] overflow-hidden rounded-md border border-brand-border/80 bg-white py-1 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      style={{ left: itemContextMenu.x, top: itemContextMenu.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-gray-700 hover:bg-brand-border/25 dark:text-neutral-200 dark:hover:bg-neutral-800"
        onClick={() => void handleRevealInParent(itemContextMenu.itemId)}
      >
        <FolderSearch size={14} className="mt-0.5 shrink-0 text-brand-rust" />
        <span>在上级目录中打开</span>
      </button>
    </div>
  ) : null;

  /** 收起态：窄条 + 展开按钮（样式与目录大纲一致） */
  if (!sidebarExpanded) {
    return (
      <div
        id="sidebar-container"
        className="flex h-full w-9 shrink-0 flex-col items-center border-r border-brand-border bg-brand-sidebar py-3 dark:border-neutral-800 select-none"
      >
        <button
          type="button"
          onClick={() => setSidebarExpanded(true)}
          className="rounded p-1 text-gray-500 hover:bg-brand-border/30 hover:text-brand-rust dark:text-neutral-400 dark:hover:bg-neutral-800"
          title="展开工作区"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  if (workspaceType === 'empty') {
    return (
      <div id="sidebar-container" className="flex h-full w-64 shrink-0 flex-col border-r border-brand-border bg-brand-sidebar dark:border-neutral-800 select-none">
        <div className="flex items-center justify-between border-b border-brand-border px-3.5 py-2.5 dark:border-neutral-800">
          <span className="flex items-center gap-1.5 text-xs font-bold text-brand-rust">
            <Folder size={13} /> 工作区
          </span>
          <button
            type="button"
            onClick={() => setSidebarExpanded(false)}
            className="rounded p-1 text-gray-500 hover:bg-brand-border/30 hover:text-brand-rust dark:text-neutral-400 dark:hover:bg-neutral-800"
            title="收起工作区"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            没有目录
          </p>
          <button
            id="btn-connect-local"
            onClick={onPromptNativeFolder}
            className="flex items-center justify-center gap-1.5 w-full max-w-[190px] rounded bg-[#1a1a1a] hover:bg-brand-rust py-2.5 text-xs text-[#FCFAF8] font-bold shadow-sm transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Folder size={13} />
            <span>选择本地文件夹</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div id="sidebar-container" className="flex h-full w-64 shrink-0 flex-col border-r border-brand-border bg-brand-sidebar dark:border-neutral-800 select-none">

      {/* 侧边栏顶栏：标题 + 收起按钮 */}
      <div className="flex items-center justify-between border-b border-brand-border px-3.5 py-2.5 dark:border-neutral-800">
        <span className="flex items-center gap-1.5 text-xs font-bold text-brand-rust">
          <Folder size={13} /> 工作区
        </span>
        <button
          type="button"
          onClick={() => setSidebarExpanded(false)}
          className="rounded p-1 text-gray-500 hover:bg-brand-border/30 hover:text-brand-rust dark:text-neutral-400 dark:hover:bg-neutral-800"
          title="收起工作区"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* 工作空间头部：可折叠 */}
      <div className="border-b border-brand-border dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setWorkspaceHeaderExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 p-3.5 pb-2 text-left hover:bg-brand-border/15 dark:hover:bg-neutral-800/40 transition-colors"
          aria-expanded={workspaceHeaderExpanded}
        >
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-neutral-400 flex items-center gap-1 shrink-0">
            {workspaceHeaderExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <HardDrive size={10} />
            工作空间
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-brand-border/40 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300 shrink-0">
            本地文件夹
          </span>
        </button>

        {workspaceHeaderExpanded && (
          <div className="flex flex-col gap-1.5 px-3.5 pb-3.5">
            <button
              id="btn-connect-local"
              onClick={onPromptNativeFolder}
              className="flex items-center justify-center gap-1.5 w-full rounded-md bg-gray-900 hover:bg-brand-rust py-1.5 text-xs text-white font-medium transition-colors duration-150 group dark:bg-neutral-800 dark:hover:bg-brand-rust"
            >
              <Link2 size={13} className="text-gray-300 group-hover:scale-110" />
              <span>切换关联本地文件夹</span>
            </button>

            <div className="text-[10px] text-gray-600 dark:text-neutral-400 bg-brand-border/25 dark:bg-white/5 rounded p-1.5 leading-snug border border-brand-border/30 dark:border-neutral-800">
              📄 新建、修改和删除将<b>同步物理落地</b>到选定的本地目录。
            </div>
          </div>
        )}
      </div>

      {/* 文件树区域：直接渲染目录内容，不显示「根目录」标题栏 */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 custom-tree-root">
        <div className="space-y-0.5">
          {renderTree(rootId)}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="p-3 border-t border-brand-border/60 dark:border-neutral-800 text-[10px] text-gray-500 dark:text-neutral-500 select-none">
        <div className="flex gap-1.5 items-start">
          <HelpCircle size={12} className="shrink-0 mt-0.5 text-slate-400" />
          <p className="leading-normal">
            支持拖放：将 .md 文档拖入窗口，自动载入所在文件夹。
          </p>
        </div>
      </div>
    </div>
    {itemContextMenuNode}
    </>
  );
}
