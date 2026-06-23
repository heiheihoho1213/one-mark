/** 统一落盘调度器：debounce 写入，避免频繁 IO */
export class PersistenceScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: string | null = null;
  private readonly delayMs: number;
  private readonly flushFn: (markdown: string) => void | Promise<void>;

  constructor(flushFn: (markdown: string) => void | Promise<void>, delayMs = 400) {
    this.flushFn = flushFn;
    this.delayMs = delayMs;
  }

  schedule(markdown: string) {
    this.pending = markdown;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      const value = this.pending;
      this.pending = null;
      if (value !== null) void this.flushFn(value);
    }, this.delayMs);
  }

  /** 立即刷盘（切换文件、关闭前） */
  async flushNow(markdown?: string) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const value = markdown ?? this.pending;
    this.pending = null;
    if (value !== null) await this.flushFn(value);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}
