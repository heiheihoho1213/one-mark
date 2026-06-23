/** 检测 Tauri 桌面环境 */
function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as any).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI__ !== undefined
  );
}

/** 另存为新的 Markdown 文件（不覆盖当前工作区文件） */
export async function exportMarkdownAsFile(
  markdown: string,
  suggestedName: string
): Promise<boolean> {
  const defaultName = suggestedName.toLowerCase().endsWith('.md')
    ? suggestedName
    : `${suggestedName.replace(/\.[^.]+$/, '') || 'document'}.md`;

  if (isTauriEnv()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (!path) return false;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, markdown);
    return true;
  }

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: defaultName,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(markdown);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = defaultName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
