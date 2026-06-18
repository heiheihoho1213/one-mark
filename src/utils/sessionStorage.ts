/** 本地会话持久化键名 */
const KEYS = {
  workspacePath: 'onemark_workspace_path',
  activeFileId: 'onemark_active_file_id',
  theme: 'markdown_theme',
  editorMode: 'onemark_editor_mode',
} as const;

export type EditorMode = 'split' | 'wysiwyg' | 'source';

/** 读取上次保存的主题 */
export function loadSavedTheme(): string {
  return localStorage.getItem(KEYS.theme) || 'classic';
}

/** 保存主题选择 */
export function saveTheme(theme: string): void {
  localStorage.setItem(KEYS.theme, theme);
}

/** 读取上次编辑器模式 */
export function loadSavedEditorMode(): EditorMode {
  const saved = localStorage.getItem(KEYS.editorMode);
  if (saved === 'split' || saved === 'wysiwyg' || saved === 'source') return saved;
  return 'wysiwyg';
}

/** 保存编辑器模式 */
export function saveEditorMode(mode: EditorMode): void {
  localStorage.setItem(KEYS.editorMode, mode);
}

/** 保存工作区目录与当前文档 */
export function saveWorkspaceSession(workspacePath: string, activeFileId: string): void {
  localStorage.setItem(KEYS.workspacePath, workspacePath);
  localStorage.setItem(KEYS.activeFileId, activeFileId);
}

/** 仅更新当前打开的文档 */
export function saveActiveFileId(activeFileId: string): void {
  localStorage.setItem(KEYS.activeFileId, activeFileId);
}

/** 读取上次工作区路径与文档 ID */
export function loadWorkspaceSession(): { workspacePath: string | null; activeFileId: string | null } {
  return {
    workspacePath: localStorage.getItem(KEYS.workspacePath),
    activeFileId: localStorage.getItem(KEYS.activeFileId),
  };
}

/** 清除工作区会话（断开目录时可选调用） */
export function clearWorkspaceSession(): void {
  localStorage.removeItem(KEYS.workspacePath);
  localStorage.removeItem(KEYS.activeFileId);
}
