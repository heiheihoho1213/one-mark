import React, { useState } from 'react';
import { 
  Folder, FolderOpen, FileText, Plus, Trash2, Edit2, ChevronDown, ChevronRight, 
  HardDrive, Link2, HelpCircle, FolderPlus, FolderX
} from 'lucide-react';
import { WorkspaceItem, WorkspaceFolder, WorkspaceFile, isMarkdownFileName } from '../types';

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
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'root': true,
    'root/images': true,
  });
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreateInput, setShowCreateInput] = useState<{ id: string; type: 'file' | 'directory' } | null>(null);
  const [newItemName, setNewItemName] = useState('');

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
    if (showCreateInput.type === 'file' && !finalName.toLowerCase().endsWith('.md') && !finalName.toLowerCase().endsWith('.png') && !finalName.toLowerCase().endsWith('.jpg')) {
      finalName += '.md'; // Default to Markdown output file extension
    }

    onCreateItem(parentId, finalName, showCreateInput.type);
    setShowCreateInput(null);
    setNewItemName('');
  };

  const handleStartRename = (item: WorkspaceItem) => {
    setEditingItemId(item.id);
    setRenameValue(item.name);
  };

  const handleFinishRename = (itemId: string) => {
    if (renameValue.trim() && renameValue !== items[itemId].name) {
      onRenameItem(itemId, renameValue.trim());
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
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartRename(item); }}
                      className="rounded p-0.5 text-gray-445 hover:bg-brand-border/50 hover:text-black dark:hover:bg-neutral-700 dark:hover:text-white"
                      title="重命名"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                      className="rounded p-0.5 text-gray-445 hover:bg-brand-border/50 hover:text-red-600 dark:hover:bg-neutral-700"
                      title="删除整个文件夹"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Expanded Children list */}
          {isExpanded && (
            <div className="ml-3 pl-3 border-l border-brand-border dark:border-neutral-800 my-0.5 space-y-0.5">
              {/* Show item creation input inside directory if pending */}
              {showCreateInput && showCreateInput.id === item.id && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-border/20 rounded">
                  {showCreateInput.type === 'file' ? <FileText size={13} className="text-brand-rust" /> : <Folder size={13} className="text-brand-rust" />}
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onBlur={() => handleFinishCreation(item.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFinishCreation(item.id)}
                    placeholder={showCreateInput.type === 'file' ? '新文档.md' : '新文件夹'}
                    className="w-full bg-white px-1 py-0.5 text-xs text-gray-800 border border-brand-rust focus:outline-hidden dark:bg-neutral-900 dark:text-neutral-100"
                    autoFocus
                  />
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
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleFinishRename(item.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleFinishRename(item.id)}
                className="w-full bg-white px-1 py-0.5 text-xs text-gray-900 border border-brand-rust focus:outline-hidden dark:bg-neutral-900 dark:text-neutral-100"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
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

  if (workspaceType === 'empty') {
    return (
      <div id="sidebar-container" className="w-64 h-full flex flex-col border-r border-brand-border bg-brand-sidebar dark:border-neutral-800 select-none">
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
    <div id="sidebar-container" className="w-64 h-full flex flex-col border-r border-brand-border bg-brand-sidebar dark:border-neutral-800 select-none">

      {/* 工作空间头部：暗色模式跟随侧边栏变量，避免硬编码浅色底 */}
      <div className="p-3.5 border-b border-brand-border dark:border-neutral-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-neutral-400 flex items-center gap-1">
            <HardDrive size={10} />
            工作空间
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-brand-border/40 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
            本地文件夹
          </span>
        </div>

        {/* Workspace Operations Buttons */}
        <div className="flex flex-col gap-1.5">
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
  );
}
