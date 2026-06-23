import React from 'react';
import { detectTitlebarMode } from './Titlebar';

type ResizeDirection =
  | 'East'
  | 'West'
  | 'North'
  | 'South'
  | 'NorthEast'
  | 'NorthWest'
  | 'SouthEast'
  | 'SouthWest';

/** 窗口边缘拖拽缩放区域（解决无边框/拖拽区抢占边缘命中） */
const RESIZE_ZONES: { dir: ResizeDirection; className: string }[] = [
  { dir: 'North', className: 'top-0 left-2 right-2 h-1.5 cursor-n-resize' },
  { dir: 'South', className: 'bottom-0 left-2 right-2 h-1.5 cursor-s-resize' },
  { dir: 'West', className: 'left-0 top-2 bottom-2 w-1.5 cursor-w-resize' },
  { dir: 'East', className: 'right-0 top-2 bottom-2 w-1.5 cursor-e-resize' },
  { dir: 'NorthWest', className: 'top-0 left-0 h-2 w-2 cursor-nw-resize' },
  { dir: 'NorthEast', className: 'top-0 right-0 h-2 w-2 cursor-ne-resize' },
  { dir: 'SouthWest', className: 'bottom-0 left-0 h-2 w-2 cursor-sw-resize' },
  { dir: 'SouthEast', className: 'bottom-0 right-0 h-2 w-2 cursor-se-resize' },
];

function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as any).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI__ !== undefined ||
    navigator.userAgent.toLowerCase().includes('tauri')
  );
}

/** 桌面端窗口四边/四角缩放热区（仅无边框 Windows；macOS 原生装饰无需此层） */
export default function WindowResizeHandles() {
  if (!isTauriEnv()) return null;
  // macOS 使用系统装饰时全屏命中层会抢占 WebView 点击，导致界面「假死」
  if (detectTitlebarMode() !== 'windows-frameless') return null;

  const handleResizeMouseDown = async (
    direction: ResizeDirection,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const win = getCurrentWebviewWindow();
      const maximized = await win.isMaximized();
      if (maximized) return;
      await win.startResizeDragging(direction);
    } catch (err) {
      console.error('startResizeDragging failed:', err);
    }
  };

  // 各边独立 fixed 定位，避免全屏包裹层在部分 WebView 中拦截点击
  return (
    <>
      {RESIZE_ZONES.map(({ dir, className }) => (
        <div
          key={dir}
          aria-hidden
          className={`fixed z-[200] ${className}`}
          onMouseDown={(event) => handleResizeMouseDown(dir, event)}
        />
      ))}
    </>
  );
}
