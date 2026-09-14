import { LockAcquireResult } from './types.js';

interface LockEntry {
  holderJobId: string;
  reentrancyCount: number;
  acquiredAt: number;
  waiters: Array<{
    jobId: string;
    resolve: (res: LockAcquireResult) => void;
    timeoutTimer: NodeJS.Timeout;
    enqueuedAt: number;
  }>;
}

export class ObjectLockManager {
  private locks: Map<string, LockEntry> = new Map();
  public stats = {
    totalAcquires: 0,
    contendedAcquires: 0,
    timeouts: 0,
    totalWaitTimeMs: 0,
  };

  public async acquire(
    resourceUrn: string,
    jobId: string,
    timeoutMs: number = 10000
  ): Promise<LockAcquireResult> {
    this.stats.totalAcquires++;
    const startTime = performance.now();
    const entry = this.locks.get(resourceUrn);

    // If lock is free:
    if (!entry) {
      this.locks.set(resourceUrn, {
        holderJobId: jobId,
        reentrancyCount: 1,
        acquiredAt: Date.now(),
        waiters: [],
      });
      return {
        acquired: true,
        resourceUrn,
        holderJobId: jobId,
        waitTimeMs: performance.now() - startTime,
      };
    }

    // If already held by same job (re-entrant):
    if (entry.holderJobId === jobId) {
      entry.reentrancyCount++;
      return {
        acquired: true,
        resourceUrn,
        holderJobId: jobId,
        waitTimeMs: performance.now() - startTime,
      };
    }

    // Contention! Must wait in queue:
    this.stats.contendedAcquires++;

    return new Promise<LockAcquireResult>((resolve) => {
      const timeoutTimer = setTimeout(() => {
        // Remove from waiters
        const idx = entry.waiters.findIndex((w) => w.jobId === jobId);
        if (idx !== -1) {
          entry.waiters.splice(idx, 1);
        }
        this.stats.timeouts++;
        const waitTime = performance.now() - startTime;
        this.stats.totalWaitTimeMs += waitTime;
        resolve({
          acquired: false,
          resourceUrn,
          holderJobId: entry.holderJobId,
          waitTimeMs: waitTime,
          timedOut: true,
        });
      }, timeoutMs);

      entry.waiters.push({
        jobId,
        resolve,
        timeoutTimer,
        enqueuedAt: startTime,
      });
    });
  }

  public release(resourceUrn: string, jobId: string): void {
    const entry = this.locks.get(resourceUrn);
    if (!entry) {
      return;
    }

    if (entry.holderJobId !== jobId) {
      throw new Error(`Job ${jobId} tried to release lock on ${resourceUrn} held by ${entry.holderJobId}`);
    }

    entry.reentrancyCount--;
    if (entry.reentrancyCount > 0) {
      return; // Still held by reentrant calls
    }

    // Pop next waiter
    const nextWaiter = entry.waiters.shift();
    if (nextWaiter) {
      clearTimeout(nextWaiter.timeoutTimer);
      entry.holderJobId = nextWaiter.jobId;
      entry.reentrancyCount = 1;
      entry.acquiredAt = Date.now();

      const waitTime = performance.now() - nextWaiter.enqueuedAt;
      this.stats.totalWaitTimeMs += waitTime;

      nextWaiter.resolve({
        acquired: true,
        resourceUrn,
        holderJobId: nextWaiter.jobId,
        waitTimeMs: waitTime,
      });
    } else {
      this.locks.delete(resourceUrn);
    }
  }

  public async withLock<T>(
    resourceUrn: string,
    jobId: string,
    fn: () => Promise<T>,
    timeoutMs: number = 10000
  ): Promise<T> {
    const res = await this.acquire(resourceUrn, jobId, timeoutMs);
    if (!res.acquired) {
      throw new Error(`Failed to acquire lock for ${resourceUrn} by job ${jobId} after ${res.waitTimeMs}ms`);
    }
    try {
      return await fn();
    } finally {
      this.release(resourceUrn, jobId);
    }
  }

  public isLocked(resourceUrn: string): boolean {
    return this.locks.has(resourceUrn);
  }

  public getHolder(resourceUrn: string): string | undefined {
    return this.locks.get(resourceUrn)?.holderJobId;
  }
}
