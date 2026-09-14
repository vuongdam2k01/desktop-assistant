import os from 'node:os';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

// Worker execution code
if (!isMainThread) {
  let running = true;
  if (parentPort) {
    parentPort.on('message', (msg: { command: string }) => {
      if (msg.command === 'stop') {
        running = false;
      }
    });
  }

  // Intense mathematical busy loop
  while (running) {
    let x = 0;
    for (let i = 0; i < 1_000_000; i++) {
      x += Math.sqrt(i) * Math.sin(i);
    }
    void x;
  }
  process.exit(0);
}

export interface CpuUsageSnapshot {
  idle: number;
  total: number;
}

export function sampleCpuTimes(): CpuUsageSnapshot {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }

  return { idle, total };
}

export function computeCpuUtilization(
  prev: CpuUsageSnapshot,
  curr: CpuUsageSnapshot
): number {
  const idleDelta = curr.idle - prev.idle;
  const totalDelta = curr.total - prev.total;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

export interface StressHandle {
  stop: () => Promise<void>;
  sampleUtilization: () => number;
}

export function startCpuStress(coreCount: number = os.cpus().length): StressHandle {
  const workers: Worker[] = [];
  let lastSample = sampleCpuTimes();

  for (let i = 0; i < coreCount; i++) {
    // Spawn worker executing this file
    const worker = new Worker(new URL(import.meta.url));
    workers.push(worker);
  }

  return {
    sampleUtilization: (): number => {
      const current = sampleCpuTimes();
      const util = computeCpuUtilization(lastSample, current);
      lastSample = current;
      return util;
    },
    stop: async (): Promise<void> => {
      for (const w of workers) {
        w.postMessage({ command: 'stop' });
        await w.terminate();
      }
      workers.length = 0;
    },
  };
}
