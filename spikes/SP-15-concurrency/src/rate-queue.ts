import { QueueRequestMetrics } from './types.js';

export interface RateQueueItem<T> {
  id: string;
  jobId: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: any) => void;
  enqueuedAt: number;
}

export interface RateLimiterOptions {
  requestsPerSecond: number; // e.g. 3
  maxBurstTokens: number;    // e.g. 5
}

/**
 * Strategy 1: Naive FIFO Rate Limiter
 */
export class FifoRateQueue {
  private queue: RateQueueItem<any>[] = [];
  private tokens: number;
  private maxTokens: number;
  private refillRatePerMs: number;
  private lastRefill: number;
  private isProcessing: boolean = false;
  public metrics: QueueRequestMetrics[] = [];

  constructor(options: RateLimiterOptions = { requestsPerSecond: 3, maxBurstTokens: 5 }) {
    this.tokens = options.maxBurstTokens;
    this.maxTokens = options.maxBurstTokens;
    this.refillRatePerMs = options.requestsPerSecond / 1000;
    this.lastRefill = performance.now();
  }

  private refill(): void {
    const now = performance.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }

  public enqueue<T>(jobId: string, task: () => Promise<T>): Promise<T> {
    const id = `req-${Math.random().toString(36).slice(2, 9)}`;
    const enqueuedAt = performance.now();

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        jobId,
        task,
        resolve,
        reject,
        enqueuedAt,
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      this.refill();

      if (this.tokens < 1) {
        const timeNeededMs = (1 - this.tokens) / this.refillRatePerMs;
        await new Promise((r) => setTimeout(r, Math.max(10, timeNeededMs)));
        this.refill();
      }

      const item = this.queue.shift();
      if (!item) break;

      this.tokens -= 1;
      const startedAt = performance.now();
      const queueWaitMs = startedAt - item.enqueuedAt;

      // Execute task
      (async () => {
        try {
          const res = await item.task();
          const completedAt = performance.now();
          this.metrics.push({
            id: item.id,
            jobId: item.jobId,
            enqueuedAt: item.enqueuedAt,
            startedAt,
            completedAt,
            queueWaitMs,
            executionMs: completedAt - startedAt,
            totalMs: completedAt - item.enqueuedAt,
            status: 200,
          });
          item.resolve(res);
        } catch (err: any) {
          const completedAt = performance.now();
          this.metrics.push({
            id: item.id,
            jobId: item.jobId,
            enqueuedAt: item.enqueuedAt,
            startedAt,
            completedAt,
            queueWaitMs,
            executionMs: completedAt - startedAt,
            totalMs: completedAt - item.enqueuedAt,
            status: err?.status || 500,
          });
          item.reject(err);
        }
      })();
    }

    this.isProcessing = false;
  }

  public get pendingCount(): number {
    return this.queue.length;
  }
}

/**
 * Strategy 2: Fair Queueing Rate Limiter (Deficit Round-Robin per Job)
 * Prevents Head-of-Line blocking from bulk jobs.
 */
export class FairRateQueue {
  private jobQueues: Map<string, RateQueueItem<any>[]> = new Map();
  private activeJobsOrder: string[] = [];
  private currentJobIndex: number = 0;
  private tokens: number;
  private maxTokens: number;
  private refillRatePerMs: number;
  private lastRefill: number;
  private isProcessing: boolean = false;
  public metrics: QueueRequestMetrics[] = [];

  constructor(options: RateLimiterOptions = { requestsPerSecond: 3, maxBurstTokens: 5 }) {
    this.tokens = options.maxBurstTokens;
    this.maxTokens = options.maxBurstTokens;
    this.refillRatePerMs = options.requestsPerSecond / 1000;
    this.lastRefill = performance.now();
  }

  private refill(): void {
    const now = performance.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }

  public enqueue<T>(jobId: string, task: () => Promise<T>): Promise<T> {
    const id = `req-${Math.random().toString(36).slice(2, 9)}`;
    const enqueuedAt = performance.now();

    return new Promise<T>((resolve, reject) => {
      let q = this.jobQueues.get(jobId);
      if (!q) {
        q = [];
        this.jobQueues.set(jobId, q);
        this.activeJobsOrder.push(jobId);
      }

      q.push({
        id,
        jobId,
        task,
        resolve,
        reject,
        enqueuedAt,
      });

      this.processQueue();
    });
  }

  private getNextItem(): RateQueueItem<any> | null {
    if (this.activeJobsOrder.length === 0) return null;

    let attempts = 0;
    const totalActive = this.activeJobsOrder.length;

    while (attempts < totalActive) {
      if (this.currentJobIndex >= this.activeJobsOrder.length) {
        this.currentJobIndex = 0;
      }
      const jobId = this.activeJobsOrder[this.currentJobIndex];
      const q = this.jobQueues.get(jobId);

      if (q && q.length > 0) {
        const item = q.shift()!;
        this.currentJobIndex++;
        return item;
      } else {
        // Remove empty job queue
        this.jobQueues.delete(jobId);
        this.activeJobsOrder.splice(this.currentJobIndex, 1);
        // Do not increment currentJobIndex since splice shifted elements
      }
      attempts++;
    }

    return null;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.activeJobsOrder.length > 0) {
      this.refill();

      if (this.tokens < 1) {
        const timeNeededMs = (1 - this.tokens) / this.refillRatePerMs;
        await new Promise((r) => setTimeout(r, Math.max(10, timeNeededMs)));
        this.refill();
      }

      const item = this.getNextItem();
      if (!item) break;

      this.tokens -= 1;
      const startedAt = performance.now();
      const queueWaitMs = startedAt - item.enqueuedAt;

      // Execute task
      (async () => {
        try {
          const res = await item.task();
          const completedAt = performance.now();
          this.metrics.push({
            id: item.id,
            jobId: item.jobId,
            enqueuedAt: item.enqueuedAt,
            startedAt,
            completedAt,
            queueWaitMs,
            executionMs: completedAt - startedAt,
            totalMs: completedAt - item.enqueuedAt,
            status: 200,
          });
          item.resolve(res);
        } catch (err: any) {
          const completedAt = performance.now();
          this.metrics.push({
            id: item.id,
            jobId: item.jobId,
            enqueuedAt: item.enqueuedAt,
            startedAt,
            completedAt,
            queueWaitMs,
            executionMs: completedAt - startedAt,
            totalMs: completedAt - item.enqueuedAt,
            status: err?.status || 500,
          });
          item.reject(err);
        }
      })();
    }

    this.isProcessing = false;
  }

  public get pendingCount(): number {
    let count = 0;
    for (const q of this.jobQueues.values()) {
      count += q.length;
    }
    return count;
  }
}
