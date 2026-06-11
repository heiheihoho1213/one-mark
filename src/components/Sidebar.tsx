import React, { useState, useRef } from 'react';
import { 
  Folder, FolderOpen, FileText, Plus, Trash2, Edit2, ChevronDown, ChevronRight, 
  Upload, HardDrive, Binary, Link2, HelpCircle, FileImage, FolderPlus, Download, RefreshCw
} from 'lucide-react';
import { WorkspaceItem, WorkspaceFolder, WorkspaceFile } from '../types';

interface SidebarProps {
  items: Record<string, WorkspaceItem>;
  rootId: string;
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onCreateItem: (parentId: string, name: string, type: 'file' | 'directory', fileContent?: string, binaryData?: { mimeType: string; dataUrl: string }) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, newName: string) => void;
  workspaceType: 'native' | 'virtual';
  onPromptNativeFolder: () => void;
  onResetVirtualWorkspace: () => void;
  onExportVirtualZip: () => void;
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
  onResetVirtualWorkspace,
  onExportVirtualZip,
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'root': true,
    'root/images': true,
  });
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCreateInput, setShowCreateInput] = useState<{ id: string; type: 'file' | 'directory' } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTargetFolderId = useRef<string>('root');

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

  // Asset importer (e.g. uploading images into the workspace directory)
  const handleImportAssetClick = (folderId: string) => {
    importTargetFolderId.current = folderId;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.txt')) {
      reader.onload = () => {
        onCreateItem(importTargetFolderId.current, file.name, 'file', reader.result as string);
      };
      reader.readAsText(file);
    } else {
      // Treat as image asset
      reader.onload = () => {
        onCreateItem(importTargetFolderId.current, file.name, 'file', '', {
          mimeType: file.type,
          dataUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
    
    // reset input
    e.target.value = '';
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
      const folderChildren = item.children || [];

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
                <button
                  onClick={(e) => { e.stopPropagation(); handleImportAssetClick(item.id); }}
                  className="rounded p-0.5 text-gray-450 hover:bg-brand-border/50 hover:text-brand-rust dark:hover:bg-neutral-700"
                  title="本地导入文件/图片"
                >
                  <Upload size={13} />
                </button>
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
                <div className="text-[10px] text-gray-400 italic pl-5 py-1">文件夹为空</div>
              )}
            </div>
          )}
        </div>
      );
    } else {
      // File row
      const isImg = (item as WorkspaceFile).mimeType?.startsWith('image/');
      
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
            <span className={`${isSelected ? 'text-[#FCFAF8]' : isImg ? 'text-brand-rust/80' : 'text-brand-rust'} shrink-0`}>
              {isImg ? <FileImage size={14} /> : <FileText size={14} />}
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

  if (workspaceType !== 'native') {
    return (
      <div id="sidebar-container" className="w-64 h-full flex flex-col border-r border-brand-border bg-brand-sidebar dark:border-neutral-800 select-none">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none">
          <div className="p-4 bg-brand-border/35 rounded-full mb-4 text-brand-rust dark:bg-neutral-800">
            <FolderOpen size={28} className="animate-pulse" />
          </div>
          <h3 className="text-sm font-serif font-black text-gray-800 dark:text-neutral-200 mb-2">未关联本地文件夹</h3>
          <p className="text-[11px] text-gray-400 font-serif max-w-[180px] leading-relaxed mb-6">
            请在此处关联您电脑上的真实目录，即可开启本地 Markdown 的极简编辑和物理同步落盘。
          </p>
          <button
            id="btn-connect-local"
            onClick={onPromptNativeFolder}
            className="flex items-center justify-center gap-1.5 w-full max-w-[190px] rounded bg-[#1a1a1a] hover:bg-brand-rust py-2.5 text-xs text-[#FCFAF8] font-bold shadow-sm transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Folder size={13} />
            <span>点击选择本地文件夹</span>
          </button>
        </div>
        <div className="p-3 border-t border-brand-border dark:border-neutral-850 bg-gray-50/20 text-[10px] text-gray-400 dark:text-neutral-500 select-none">
          <div className="flex gap-1.5 items-start">
            <HelpCircle size={12} className="shrink-0 mt-0.5 text-slate-400" />
            <p className="leading-normal">
              连接本地文件夹后，系统可实现直接本地物理保存、新建或自动重命名。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="sidebar-container" className="w-64 h-full flex flex-col border-r border-brand-border bg-brand-sidebar dark:border-neutral-800 select-none">
      
      {/* File Action input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".md,.markdown,.png,.jpg,.jpeg,.gif,.svg,.webp"
      />

      {/* Directory Selector Header */}
      <div className="p-3.5 border-b border-brand-border dark:border-neutral-800 bg-[#FCFAF8]/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400 dark:text-neutral-500 flex items-center gap-1">
            <HardDrive size={10} />
            工作空间
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[#E8E2DD] text-black dark:bg-neutral-800 dark:text-neutral-200">
            本地文件夹
          </span>
        </div>

        {/* Workspace Operations Buttons */}
        <div className="flex flex-col gap-1.5">
          <button
            id="btn-connect-local"
            onClick={onPromptNativeFolder}
            className="flex items-center justify-center gap-1.5 w-full rounded-md bg-[#1a1a1a] hover:bg-brand-rust py-1.5 text-xs text-white font-medium shadow-xs transition-colors duration-150 group"
          >
            <Link2 size={13} className="text-gray-300 group-hover:scale-110" />
            <span>切换关联本地文件夹</span>
          </button>

          <div className="text-[10px] text-[#4a4a4a] dark:text-neutral-500 bg-brand-border/30 dark:bg-neutral-955 rounded p-1.5 leading-snug">
            📄 新建、修改和删除将<b>同步物理落地</b>到选定的本地目录。
          </div>
        </div>
      </div>

      {/* Title & Static Drag and Drop Dropzone Info */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 custom-tree-root">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#C05621] dark:text-amber-500">
            根目录
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleStartCreation('root', 'file')}
              className="rounded p-0.5 text-[#a1a1a1] hover:bg-brand-border/60 hover:text-[#1a1a1a] dark:hover:bg-neutral-800"
              title="根目录创建 Markdown"
            >
              <Plus size={13} />
            </button>
            <button
              onClick={() => handleStartCreation('root', 'directory')}
              className="rounded p-0.5 text-[#a1a1a1] hover:bg-brand-border/60 hover:text-[#1a1a1a] dark:hover:bg-neutral-800"
              title="根目录创建文件夹"
            >
              <FolderPlus size={13} />
            </button>
          </div>
        </div>

        {/* Recursively Render Files */}
        <div className="space-y-0.5">
          {renderTree(rootId)}
        </div>
      </div>

      {/* Quick guide block in footer */}
      <div className="p-3 border-t border-gray-100 dark:border-neutral-800/60 bg-gray-50/20 text-[10px] text-gray-400 dark:text-neutral-500 select-none">
        <div className="flex gap-1.5 items-start">
          <HelpCircle size={12} className="shrink-0 mt-0.5 text-slate-400" />
          <p className="leading-normal">
            支持拖放入网：可从电脑拖放任意 <b>.md 文档 or 图片资产</b> 直至左侧工作空间树，即可自动复制载入！
          </p>
        </div>
      </div>
    </div>
  );
}
