import type { WorkspaceItem } from '../types';

/** 检测 Tauri 桌面环境 */
function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as any).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI__ !== undefined
  );
}

type RevealResult = { ok: true } | { ok: false; message: string };

/**
 * 在系统文件管理器中打开文件/目录的上级位置并选中该项
 * macOS：Finder -R；Windows：资源管理器 /select
 */
export async function revealItemInParentDirectory(item: WorkspaceItem): Promise<RevealResult> {
  if (!isTauriEnv()) {
    return { ok: false, message: '仅桌面客户端支持在 Finder / 资源管理器中打开' };
  }

  const path = item.tauriPath;
  if (!path) {
    const label = item.type === 'directory' ? '文件夹' : '文件';
    return { ok: false, message: `当前${label}没有对应的本地路径` };
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('reveal_in_file_manager', { path });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
