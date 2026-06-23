import type { DocumentAst, EditorSelection, BlockNode } from '../ast/types';
import { parseDocument, cloneAst, findBlock, setInlineContent } from '../ast/parse';
import { serializeDocument } from '../ast/serialize';
import { UndoStack } from './UndoStack';
import { PersistenceScheduler } from './PersistenceScheduler';

export type DocumentListener = (state: DocumentState) => void;

export interface DocumentState {
  markdown: string;
  ast: DocumentAst;
  selection: EditorSelection | null;
  canUndo: boolean;
  canRedo: boolean;
  revision: number;
}

export class DocumentStore {
  private markdown: string;
  private ast: DocumentAst;
  private selection: EditorSelection | null = null;
  private revision = 0;
  /** 缓存快照，避免 getState() 每次返回新引用导致 useSyncExternalStore 死循环 */
  private snapshotCache: DocumentState | null = null;
  private readonly undoStack = new UndoStack();
  private readonly listeners = new Set<DocumentListener>();
  private scheduler: PersistenceScheduler | null = null;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private typingSnapshotPending = false;
  /** 格式命令后待恢复至 DOM 的选区（避免被折叠选区覆盖） */
  private pendingRestoreSelection: EditorSelection | null = null;

  constructor(initialMarkdown: string) {
    this.markdown = initialMarkdown;
    this.ast = parseDocument(initialMarkdown);
    this.undoStack.reset(initialMarkdown);
  }

  /** 使 getState 在下次调用时重建（revision 变更后调用） */
  private invalidateSnapshot() {
    this.snapshotCache = null;
  }

  getState(): DocumentState {
    if (!this.snapshotCache) {
      this.snapshotCache = {
        markdown: this.markdown,
        ast: cloneAst(this.ast),
        selection: this.selection ? { ...this.selection } : null,
        canUndo: this.undoStack.canUndo(),
        canRedo: this.undoStack.canRedo(),
        revision: this.revision,
      };
    }
    return this.snapshotCache;
  }

  subscribe(listener: DocumentListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  attachScheduler(scheduler: PersistenceScheduler) {
    this.scheduler = scheduler;
  }

  private notify() {
    this.revision += 1;
    this.invalidateSnapshot();
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
    this.scheduler?.schedule(this.markdown);
  }

  /** 压入快照后应用新 Markdown（工具栏命令、外部替换） */
  applyMarkdown(next: string, options?: { recordUndo?: boolean }) {
    const record = options?.recordUndo !== false;
    if (record) {
      this.undoStack.recordNext(next);
    }
    this.markdown = next;
    this.ast = parseDocument(next);
    this.notify();
  }

  /** 键盘输入：合并为一步撤销（停止输入 800ms 后记一步） */
  applyMarkdownFromTyping(next: string) {
    if (next === this.markdown) return;
    this.commitTypingUpdate(next, parseDocument(next));
  }

  /**
   * WYSIWYG 块内键盘输入：直接变异 AST 并保留 blockId，
   * 避免 serialize→parse 打断 IME 上屏与焦点。
   */
  updateAstFromTyping(mutator: (ast: DocumentAst) => DocumentAst) {
    const nextAst = mutator(cloneAst(this.ast));
    const nextMarkdown = serializeDocument(nextAst);
    if (nextMarkdown === this.markdown) return;
    this.commitTypingUpdate(nextMarkdown, nextAst);
  }

  /** 打字输入的公共提交流程（防抖撤销） */
  private commitTypingUpdate(nextMarkdown: string, nextAst: DocumentAst) {
    if (!this.typingSnapshotPending) {
      this.typingSnapshotPending = true;
    }

    this.markdown = nextMarkdown;
    this.ast = nextAst;
    this.revision += 1;
    this.invalidateSnapshot();
    this.listeners.forEach((l) => l(this.getState()));
    this.scheduler?.schedule(this.markdown);

    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.undoStack.recordNext(this.markdown);
      this.typingSnapshotPending = false;
      this.typingTimer = null;
      this.revision += 1;
      this.invalidateSnapshot();
      this.listeners.forEach((l) => l(this.getState()));
    }, 800);
  }

  setSelection(selection: EditorSelection | null) {
    if (
      selection &&
      this.selection &&
      this.selection.blockId === selection.blockId &&
      this.selection.anchor === selection.anchor &&
      this.selection.focus === selection.focus
    ) {
      return;
    }
    this.selection = selection;
    this.revision += 1;
    this.invalidateSnapshot();
    this.listeners.forEach((l) => l(this.getState()));
  }

  /** 格式命令完成后登记待恢复的选区（与 selection 同步，不额外 notify） */
  setPendingRestoreSelection(selection: EditorSelection) {
    this.selection = { ...selection };
    this.pendingRestoreSelection = { ...selection };
    this.invalidateSnapshot();
  }

  /** 读取待恢复选区（不清除，供 useLayoutEffect 使用） */
  peekPendingRestoreSelection(blockId: string): EditorSelection | null {
    if (this.pendingRestoreSelection?.blockId !== blockId) return null;
    return { ...this.pendingRestoreSelection };
  }

  clearPendingRestoreSelection() {
    this.pendingRestoreSelection = null;
  }

  updateAst(mutator: (ast: DocumentAst) => DocumentAst, recordUndo = true) {
    const nextAst = mutator(cloneAst(this.ast));
    const nextMarkdown = serializeDocument(nextAst);
    if (recordUndo) {
      this.undoStack.recordNext(nextMarkdown);
    }
    this.markdown = nextMarkdown;
    // 直接沿用变异后的 AST，避免 serialize→parse 重新生成 blockId 导致选区失效
    this.ast = nextAst;
    this.notify();
  }

  undo(): boolean {
    const prev = this.undoStack.undo();
    if (prev === null) return false;
    this.markdown = prev;
    this.ast = parseDocument(prev);
    this.typingSnapshotPending = false;
    this.notify();
    return true;
  }

  redo(): boolean {
    const next = this.undoStack.redo();
    if (next === null) return false;
    this.markdown = next;
    this.ast = parseDocument(next);
    this.typingSnapshotPending = false;
    this.notify();
    return true;
  }

  /** 外部磁盘版本写入：不记撤销 */
  replaceFromDisk(markdown: string) {
    this.undoStack.reset(markdown);
    this.markdown = markdown;
    this.ast = parseDocument(markdown);
    this.typingSnapshotPending = false;
    this.notify();
  }

  replaceBlock(blockId: string, block: BlockNode) {
    this.updateAst((ast) => ({
      blocks: ast.blocks.map((b) => (b.id === blockId ? block : b)),
    }));
  }

  getBlock(blockId: string) {
    return findBlock(this.ast, blockId);
  }

  flushPersistence() {
    return this.scheduler?.flushNow(this.markdown);
  }

  dispose() {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.listeners.clear();
  }
}

export { setInlineContent, findBlock };
