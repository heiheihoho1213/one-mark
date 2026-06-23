/** 本地会话持久化键名 */
const KEYS = {
  workspacePath: 'onemark_workspace_path',
  activeFileId: 'onemark_active_file_id',
  theme: 'markdown_theme',
  editorMode: 'onemark_editor_mode',
  outlineExpanded: 'onemark_outline_expanded',
  sidebarExpanded: 'onemark_sidebar_expanded',
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

/** 读取上次编辑器模式（已固定为实时渲染） */
export function loadSavedEditorMode(): EditorMode {
  return 'wysiwyg';
}

/** 保存编辑器模式 */
export function saveEditorMode(mode: EditorMode): void {
  localStorage.setItem(KEYS.editorMode, mode);
}

/** 读取目录大纲是否展开（默认展开） */
export function loadOutlineExpanded(): boolean {
  return localStorage.getItem(KEYS.outlineExpanded) !== '0';
}

/** 保存目录大纲展开状态 */
export function saveOutlineExpanded(expanded: boolean): void {
  localStorage.setItem(KEYS.outlineExpanded, expanded ? '1' : '0');
}

/** 读取工作区侧边栏是否展开（默认展开） */
export function loadSidebarExpanded(): boolean {
  return localStorage.getItem(KEYS.sidebarExpanded) !== '0';
}

/** 保存工作区侧边栏展开状态 */
export function saveSidebarExpanded(expanded: boolean): void {
  localStorage.setItem(KEYS.sidebarExpanded, expanded ? '1' : '0');
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
