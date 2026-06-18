import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, FileText, ChevronDown } from 'lucide-react';

/** 检测是否在 Tauri 桌面环境中运行 */
function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && (
    (window as any).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI__ !== undefined ||
    navigator.userAgent.toLowerCase().includes('tauri')
  );
}

/** 检测是否为 macOS 平台 */
function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('mac') || ua.includes('osx') || navigator.platform.toLowerCase().includes('mac');
}

/** 检测是否为 Windows 平台 */
function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('windows') || navigator.platform.toLowerCase().includes('win');
}

/** 标题栏展示模式 */
export type TitlebarMode = 'macos-overlay' | 'windows-frameless' | 'web';

export function detectTitlebarMode(): TitlebarMode {
  if (!isTauriEnv()) return 'web';
  if (isMacOS()) return 'macos-overlay';
  if (isWindows()) return 'windows-frameless';
  return 'web';
}

/** 获取 Tauri 当前窗口实例 */
async function getTauriWindow() {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    return getCurrentWebviewWindow();
  } catch {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow();
  }
}

interface TitlebarControlsProps {
  workspaceType: 'native' | 'empty';
  activeTheme?: string;
  onThemeChange?: (theme: string) => void;
  compact?: boolean;
}

const THEMES = [
  { id: 'classic', label: '经典杏白', colorBg: '#FCFAF8', colorAccent: '#C05621' },
  { id: 'pure', label: '纯净纯白', colorBg: '#FFFFFF', colorAccent: '#1A1A1A' },
  { id: 'obsidian', label: '曜石双眸', colorBg: '#09090B', colorAccent: '#EA580C' },
  { id: 'forest', label: '松针凉意', colorBg: '#F4F7F5', colorAccent: '#2D6A4F' },
  { id: 'glacier', label: '极地冰川', colorBg: '#F0F4F8', colorAccent: '#1D4ED8' },
  { id: 'cyberpunk', label: '幻影赛博', colorBg: '#0B0612', colorAccent: '#C026D3' },
];

/** 主题切换 + 工作区标识 */
export function TitlebarControls({
  workspaceType,
  activeTheme = 'classic',
  onThemeChange,
  compact = false,
}: TitlebarControlsProps) {
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const currentThemeObj = THEMES.find(t => t.id === activeTheme) || THEMES[0];

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

  const handleThemeSelect = (themeId: string) => {
    onThemeChange?.(themeId);
    setShowThemeMenu(false);
  };

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-2.5'}`} data-no-drag>
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
                    <div className="flex items-center -space-x-1 shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full border border-black/5" style={{ backgroundColor: t.colorBg }} />
                      <div className="w-2.5 h-2.5 rounded-full border border-black/5" style={{ backgroundColor: t.colorAccent }} />
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

      <span className="px-2 py-0.5 rounded-full bg-brand-border/40 text-brand-rust font-bold text-[10px]">
        {workspaceType === 'native' ? '本地目录' : '未打开'}
      </span>
    </div>
  );
}

/** Windows 无边框模式：右侧系统风格窗口控制按钮（调用 Tauri 原生 API） */
function WindowsCaptionButtons() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const syncMaximized = async () => {
      if (!isTauriEnv()) return;
      try {
        const win = await getTauriWindow();
        setIsMaximized(await win.isMaximized());

        if (typeof win.onResized === 'function') {
          const unlisten = await win.onResized(async () => {
            setIsMaximized(await win.isMaximized());
          });
          unlistenFn = unlisten;
        }
      } catch (e) {
        console.error('Windows caption state sync failed:', e);
      }
    };
    syncMaximized();

    return () => unlistenFn?.();
  }, []);

  const handleMinimize = async () => {
    try {
      const win = await getTauriWindow();
      await win.minimize();
    } catch (e) {
      console.error('minimize failed:', e);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const win = await getTauriWindow();
      // toggleMaximize 优先；旧版 API 回退到 maximize/unmaximize
      if (typeof win.toggleMaximize === 'function') {
        await win.toggleMaximize();
      } else {
        const maximized = await win.isMaximized();
        if (maximized) await win.unmaximize();
        else await win.maximize();
      }
    } catch (e) {
      console.error('toggleMaximize failed:', e);
    }
  };

  const handleClose = async () => {
    try {
      const win = await getTauriWindow();
      await win.close();
    } catch (e) {
      console.error('close failed:', e);
    }
  };

  return (
    <div className="flex items-center h-full shrink-0" data-no-drag>
      <button
        onClick={handleMinimize}
        className="w-[46px] h-full flex items-center justify-center hover:bg-black/5 active:bg-black/10 text-gray-600 dark:text-neutral-300 transition-colors focus:outline-none"
        title="最小化"
      >
        <Minus size={13} strokeWidth={2.5} />
      </button>
      <button
        onClick={handleToggleMaximize}
        className="w-[46px] h-full flex items-center justify-center hover:bg-black/5 active:bg-black/10 text-gray-600 dark:text-neutral-300 transition-colors focus:outline-none"
        title={isMaximized ? '还原' : '最大化'}
      >
        {isMaximized ? (
          <Copy size={11} strokeWidth={2.5} className="rotate-180" />
        ) : (
          <Square size={11} strokeWidth={2.5} />
        )}
      </button>
      <button
        onClick={handleClose}
        className="w-[46px] h-full flex items-center justify-center hover:bg-red-500 hover:text-white active:bg-red-600 text-gray-600 dark:text-neutral-300 transition-colors focus:outline-none"
        title="关闭"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

interface TitlebarProps {
  activeFileName: string | null;
  workspaceName: string;
  workspaceType: 'native' | 'empty';
  activeTheme?: string;
  onThemeChange?: (theme: string) => void;
}

/**
 * macOS：Overlay 叠加层，保留系统红绿灯，右侧放主题/工作区控件。
 * Windows：无边框单栏标题栏，左侧工作区信息 + 中间文档名 + 右侧控件与窗口按钮。
 * 浏览器预览：简易顶栏，不含窗口按钮。
 */
export default function Titlebar({
  activeFileName,
  workspaceName,
  workspaceType,
  activeTheme = 'classic',
  onThemeChange,
}: TitlebarProps) {
  const [mode, setMode] = useState<TitlebarMode>(() => detectTitlebarMode());

  useEffect(() => {
    setMode(detectTitlebarMode());
  }, []);

  const isMacOverlay = mode === 'macos-overlay';
  const isWindowsFrameless = mode === 'windows-frameless';
  const displayTitle = activeFileName ? `${activeFileName} — OneMark` : 'OneMark';

  const lastClickTimeRef = React.useRef(0);

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const now = Date.now();
    const isDoubleClick = now - lastClickTimeRef.current < 300;
    lastClickTimeRef.current = now;

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

    if (!isTauriEnv()) return;

    // Windows 双击标题栏区域切换最大化
    if (isDoubleClick && isWindowsFrameless) {
      try {
        const win = await getTauriWindow();
        if (typeof win.toggleMaximize === 'function') {
          await win.toggleMaximize();
        } else {
          const maximized = await win.isMaximized();
          if (maximized) await win.unmaximize();
          else await win.maximize();
        }
      } catch (err) {
        console.error('toggleMaximize failed:', err);
      }
      return;
    }

    if (isDoubleClick) return;

    try {
      const win = await getTauriWindow();
      await win.startDragging();
    } catch (err) {
      console.error('Tauri startDragging failed:', err);
    }
  };

  // macOS Overlay：薄层叠加在系统标题栏上
  if (isMacOverlay) {
    return (
      <div
        id="tauri-titlebar-overlay"
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
        className="h-[28px] shrink-0 bg-transparent flex items-center justify-end select-none relative font-sans z-50 pr-3"
      >
        <div className="absolute inset-0" data-tauri-drag-region />
        <div className="relative z-10" data-no-drag>
          <TitlebarControls
            workspaceType={workspaceType}
            activeTheme={activeTheme}
            onThemeChange={onThemeChange}
          />
        </div>
      </div>
    );
  }

  // Windows 无边框 / 浏览器预览：完整标题栏
  return (
    <div
      id="tauri-titlebar-overlay"
      data-tauri-drag-region={isWindowsFrameless ? true : undefined}
      onMouseDown={isWindowsFrameless ? handleMouseDown : undefined}
      className={`shrink-0 bg-brand-sidebar border-b border-brand-border/60 flex items-center justify-between select-none relative font-sans text-xs text-gray-600 font-medium z-50 ${
        isWindowsFrameless ? 'h-[32px] pr-0' : 'h-[36px] px-4 justify-end'
      }`}
    >
      {isWindowsFrameless && (
        <>
          {/* 左侧：工作区名称 */}
          <div className="flex items-center gap-2 pl-3 text-gray-700 font-semibold pointer-events-none shrink-0" data-tauri-drag-region>
            <FileText size={14} className="text-brand-rust" />
            <span className="truncate max-w-[160px] font-medium text-xs text-gray-800 dark:text-neutral-200">
              {workspaceName}
            </span>
          </div>

          {/* 中间：当前文档名 */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center max-w-[40%] text-center"
            data-tauri-drag-region
          >
            <span className="text-gray-800 dark:text-neutral-200 font-semibold truncate text-[12px]">
              {displayTitle}
            </span>
          </div>

          {/* 右侧：主题/工作区 + 窗口控制按钮 */}
          <div className="flex items-center h-full gap-2.5 shrink-0" data-no-drag>
            <TitlebarControls
              workspaceType={workspaceType}
              activeTheme={activeTheme}
              onThemeChange={onThemeChange}
            />
            <WindowsCaptionButtons />
          </div>
        </>
      )}

      {/* 浏览器开发预览 */}
      {!isWindowsFrameless && (
        <TitlebarControls
          workspaceType={workspaceType}
          activeTheme={activeTheme}
          onThemeChange={onThemeChange}
        />
      )}
    </div>
  );
}
