import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, FileText, ChevronDown, Check } from 'lucide-react';

interface TitlebarProps {
  onMinimize: () => void;
  onMaximize: () => void;
  onFullscreen: () => void; // macOS 专用：绿色按钮触发全屏切换
  onClose: () => void;
  activeFileName: string | null;
  workspaceName: string;
  workspaceType: 'native' | 'virtual';
  activeTheme?: string;
  onThemeChange?: (theme: string) => void;
}

const THEMES = [
  { id: 'classic', label: '经典杏白', colorBg: '#FCFAF8', colorAccent: '#C05621' },
  { id: 'obsidian', label: '曜石双眸', colorBg: '#09090B', colorAccent: '#EA580C' },
  { id: 'forest', label: '松针凉意', colorBg: '#F4F7F5', colorAccent: '#2D6A4F' },
  { id: 'glacier', label: '极地冰川', colorBg: '#F0F4F8', colorAccent: '#1D4ED8' },
  { id: 'cyberpunk', label: '幻影赛博', colorBg: '#0B0612', colorAccent: '#C026D3' },
];

export default function Titlebar({
  onMinimize,
  onMaximize,
  onFullscreen,
  onClose,
  activeFileName,
  workspaceName,
  workspaceType,
  activeTheme = 'classic',
  onThemeChange,
}: TitlebarProps) {
  const [osType, setOsType] = useState<'macos' | 'windows'>('windows');
  const [isMacLightsHovered, setIsMacLightsHovered] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const currentThemeObj = THEMES.find(t => t.id === activeTheme) || THEMES[0];

  // Auto-detect OS type on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('mac') || ua.includes('osx') || navigator.platform.toLowerCase().includes('mac')) {
        setOsType('macos');
      } else {
        setOsType('windows');
      }
    }

    let unlistenFn: (() => void) | undefined;

    // Read initial maximized state if Tauri is available
    const checkMaximized = async () => {
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
          if (win) {
            setIsMaximized(await win.isMaximized());
            
            // Listen to window resize events to update maximized state icon
            if (typeof win.onResized === 'function') {
              const unlisten = await win.onResized(async () => {
                 setIsMaximized(await win.isMaximized());
              });
              unlistenFn = unlisten;
            } else if (typeof win.listen === 'function') {
              const unlisten = await win.listen('tauri://resize', async () => {
                 setIsMaximized(await win.isMaximized());
              });
              unlistenFn = unlisten;
            }
          }
        } catch (e) {
          console.error('Tauri resize listening setup failed:', e);
        }
      }
    };
    checkMaximized();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Close theme dropdown when clicked outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#theme-selector-container')) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Windows 最大化/还原：不做乐观更新，由 onResized 事件驱动状态同步，避免双击时闪烁
  const handleToggleMaximize = () => {
    onMaximize();
  };

  const lastClickTimeRef = React.useRef(0);

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // 拦截双击：双击间隔 < 300ms 时跳过 startDragging，让 onDoubleClick 正常触发
    const now = Date.now();
    const isDoubleClick = now - lastClickTimeRef.current < 300;
    lastClickTimeRef.current = now;
    if (isDoubleClick) return;

    // 按钮、链接、输入框、标记了 data-no-drag 的区域不触发拖拽
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('[data-no-drag]') ||
      target.closest('#theme-selector-container')
    ) {
      return;
    }

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
        await win.startDragging();
      } catch (err) {
        console.error('Tauri startDragging failed:', err);
      }
    }
  };

  const handleThemeSelect = (themeId: string) => {
    if (onThemeChange) {
      onThemeChange(themeId);
    }
    setShowThemeMenu(false);
  };

  const renderThemeDropdown = () => {
    return (
      <div id="theme-selector-container" className="relative z-50 flex items-center" data-no-drag>
        <button
          onClick={() => setShowThemeMenu(!showThemeMenu)}
          className="flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-brand-border/80 hover:bg-black/5 active:bg-black/10 text-gray-700 dark:text-neutral-300 transition-colors duration-150 text-[10px] font-semibold focus:outline-none cursor-pointer"
          title="切换编辑器皮肤主题"
        >
          <div 
            className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
            style={{ backgroundColor: currentThemeObj.colorAccent }}
          />
          <span className="max-w-[70px] truncate">{currentThemeObj.label}</span>
          <ChevronDown size={11} className="text-gray-400" />
        </button>

        {showThemeMenu && (
          <div 
            className="absolute right-0 top-[28px] w-40 bg-brand-cream border border-brand-border rounded-lg shadow-xl py-1 z-50 flex flex-col font-sans"
            data-no-drag
          >
            <div className="px-2.5 py-1 text-[10px] text-gray-400 font-semibold border-b border-brand-border/60 mb-1">
              精选编辑器皮肤
            </div>
            {THEMES.map((t) => {
              const isSelected = t.id === activeTheme;
              return (
                <button
                  key={t.id}
                  onClick={() => handleThemeSelect(t.id)}
                  className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left text-[11px] transition-colors focus:outline-none cursor-pointer ${
                    isSelected 
                      ? 'bg-brand-rust/15 text-brand-rust font-bold' 
                      : 'text-gray-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Visual Preview circles */}
                    <div className="flex items-center -space-x-1 shrink-0">
                      <div 
                        className="w-2.5 h-2.5 rounded-full border border-black/5" 
                        style={{ backgroundColor: t.colorBg }}
                      />
                      <div 
                        className="w-2.5 h-2.5 rounded-full border border-black/5" 
                        style={{ backgroundColor: t.colorAccent }}
                      />
                    </div>
                    <span>{t.label}</span>
                  </div>
                  {isSelected && (
                    <div className="w-3.5 h-3.5 bg-brand-rust rounded-full flex items-center justify-center text-white scale-75 font-semibold text-[8px]">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      id="tauri-custom-titlebar"
      data-tauri-drag-region
      className="h-[40px] shrink-0 bg-brand-sidebar border-b border-brand-border/60 flex items-center justify-between select-none px-4 relative font-sans text-xs text-gray-600 font-medium z-50 cursor-default"
      onDoubleClick={handleToggleMaximize}
      onMouseDown={handleMouseDown}
    >
      {/* ---------------- macOS Style Left Buttons ---------------- */}
      {osType === 'macos' ? (
        <div 
          className="flex items-center gap-2 w-[72px]"
          onMouseEnter={() => setIsMacLightsHovered(true)}
          onMouseLeave={() => setIsMacLightsHovered(false)}
        >
          {/* 关闭按钮 - 红色 */}
          <button
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] flex items-center justify-center focus:outline-none transition-colors"
            title="关闭"
          >
            {isMacLightsHovered && (
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M2.4 1.6L6.4 6.4M6.4 1.6L2.4 6.4" stroke="#4C0002" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {/* 最小化按钮 - 黄色 */}
          <button
            onClick={onMinimize}
            className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] flex items-center justify-center focus:outline-none transition-colors"
            title="最小化"
          >
            {isMacLightsHovered && (
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M2 4H6" stroke="#5C3E00" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {/* 全屏/还原按钮 - 绿色（macOS 绿色 = 全屏，非最大化） */}
          <button
            onClick={onFullscreen}
            className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB2F] flex items-center justify-center focus:outline-none transition-colors"
            title="全屏"
          >
            {isMacLightsHovered && (
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M1.5 4.5V6.5H3.5M6.5 3.5V1.5H4.5" stroke="#004C06" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
          </button>
        </div>
      ) : (
        /* Windows Style Left Title */
        <div className="flex items-center gap-2 text-gray-700 font-semibold pointer-events-none" data-tauri-drag-region>
          <FileText size={14} className="text-brand-rust pointer-events-auto" />
          <span className="truncate max-w-[200px] font-medium text-xs text-gray-800 dark:text-neutral-200 pointer-events-auto">
            {workspaceName}
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-brand-border/40 text-brand-rust scale-90 font-bold pointer-events-auto">
            {workspaceType === 'native' ? '本地' : '隔离沙盒'}
          </span>
        </div>
      )}

      {/* ---------------- Centered Document / State Info ---------------- */}
      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 max-w-[45%] text-center" 
        data-tauri-drag-region
      >
        <span className="text-gray-800 dark:text-neutral-200 font-semibold truncate text-[12px] font-sans">
          {activeFileName ? `${activeFileName} — OneMark` : 'OneMark'}
        </span>
      </div>

      {/* ---------------- Right controls ---------------- */}
      {osType === 'macos' ? (
        /* macOS Style Right Section: Balanced spacer or workspace indicator */
        <div className="flex items-center gap-2.5 text-[10px]" data-tauri-drag-region>
          {renderThemeDropdown()}
          <span className="px-2 py-0.5 rounded-full bg-brand-border/40 text-brand-rust font-bold">
            {workspaceType === 'native' ? '本地目录' : '沙盒内存'}
          </span>
        </div>
      ) : (
        /* Windows Style Right Control Buttons */
        <div className="flex items-center h-full -mr-4 gap-2.5 z-50">
          {renderThemeDropdown()}
          
          <div className="flex items-center h-full">
            {/* Minimize */}
            <button
              onClick={onMinimize}
              className="w-11 h-full flex items-center justify-center hover:bg-black/5 active:bg-black/10 text-gray-600 dark:text-neutral-300 transition-colors focus:outline-none"
              title="最小化"
            >
              <Minus size={13} strokeWidth={2.5} />
            </button>
            
            {/* Maximize / Restore */}
            <button
              onClick={handleToggleMaximize}
              className="w-11 h-full flex items-center justify-center hover:bg-black/5 active:bg-black/10 text-gray-600 dark:text-neutral-300 transition-colors focus:outline-none"
              title={isMaximized ? '还原' : '最大化'}
            >
              {isMaximized ? (
                <Copy size={11} strokeWidth={2.5} className="rotate-180" />
              ) : (
                <Square size={11} strokeWidth={2.5} />
              )}
            </button>
            
            {/* Close */}
            <button
              onClick={onClose}
              className="w-11 h-full flex items-center justify-center hover:bg-red-500 hover:text-white active:bg-red-600 text-gray-600 dark:text-neutral-300 transition-colors focus:outline-none"
              title="关闭"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
