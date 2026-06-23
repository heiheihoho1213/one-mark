/** 监听外部文件变更，触发冲突回调 */
export class FileSyncWatcher {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastMtime = 0;
  private disposed = false;

  constructor(
    private readonly readFile: () => Promise<{ content: string; mtime: number } | null>,
    private readonly onExternalChange: (diskContent: string) => void,
    private readonly pollMs = 2000
  ) {}

  start() {
    this.stop();
    void this.tick();
    this.interval = setInterval(() => void this.tick(), this.pollMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** 成功落盘后更新基准 mtime */
  markSaved(mtime: number) {
    this.lastMtime = mtime;
  }

  private async tick() {
    if (this.disposed) return;
    try {
      const file = await this.readFile();
      if (!file) return;
      if (this.lastMtime === 0) {
        this.lastMtime = file.mtime;
        return;
      }
      if (file.mtime > this.lastMtime) {
        this.lastMtime = file.mtime;
        this.onExternalChange(file.content);
      }
    } catch {
      // 读取失败时静默，下次轮询重试
    }
  }

  dispose() {
    this.disposed = true;
    this.stop();
  }
}
