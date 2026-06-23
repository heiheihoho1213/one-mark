/** Word 式快照撤销栈，最多保留 5 步可回退 */
const MAX_UNDO_STEPS = 5;

export class UndoStack {
  private snapshots: string[] = [];
  private index = 0;

  reset(initial: string) {
    this.snapshots = [initial];
    this.index = 0;
  }

  /** 文档变更后追加新快照（当前状态已在 snapshots[index]） */
  recordNext(next: string) {
    const base = this.snapshots.slice(0, this.index + 1);
    if (base[base.length - 1] === next) return;

    base.push(next);
    while (base.length > MAX_UNDO_STEPS + 1) {
      base.shift();
    }
    this.snapshots = base;
    this.index = this.snapshots.length - 1;
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index < this.snapshots.length - 1;
  }

  undo(): string | null {
    if (!this.canUndo()) return null;
    this.index -= 1;
    return this.snapshots[this.index];
  }

  redo(): string | null {
    if (!this.canRedo()) return null;
    this.index += 1;
    return this.snapshots[this.index];
  }

  current(): string {
    return this.snapshots[this.index] ?? '';
  }
}
