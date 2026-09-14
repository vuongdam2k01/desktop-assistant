import { FifoRateQueue, FairRateQueue } from './rate-queue.js';

export interface Q3BenchmarkResults {
  workload: {
    job1_bulkRequests: number;
    job2_interactiveRequests: number;
    job3_urgentRequests: number;
    rateLimitRps: number;
  };
  fifo: {
    job1_avgWaitMs: number;
    job1_totalDurationMs: number;
    job2_waitMs: number;
    job2_totalMs: number;
    job3_waitMs: number;
    job3_totalMs: number;
    headOfLineBlockingObserved: boolean;
  };
  fairQueue: {
    job1_avgWaitMs: number;
    job1_totalDurationMs: number;
    job2_waitMs: number;
    job2_totalMs: number;
    job3_waitMs: number;
    job3_totalMs: number;
    headOfLineBlockingPrevented: boolean;
    job2SpeedupRatio: number;
  };
  architecturalRecommendation: {
    queueLayer: string;
    schedulingAlgorithm: string;
    rationale: string;
  };
}

export async function runQ3Benchmark(): Promise<Q3BenchmarkResults> {
  console.log('--- [Q3] Running Rate Queue Benchmark (FIFO vs Fair Queueing) ---');

  const rps = 3;
  const mockApiDurationMs = 120; // typical Notion network RTT
  const simulateTask = (id: string) => async () => {
    await new Promise((r) => setTimeout(r, mockApiDurationMs));
    return { ok: true, id };
  };

  // =========================================================================
  // Test 1: FIFO Rate Queue
  // =========================================================================
  console.log('Testing FifoRateQueue...');
  const fifo = new FifoRateQueue({ requestsPerSecond: rps, maxBurstTokens: 3 });

  // Job 1 pushes 15 requests
  const fifoJob1Promises = [];
  for (let i = 0; i < 15; i++) {
    fifoJob1Promises.push(fifo.enqueue('job-1-bulk', simulateTask(`bulk-${i}`)));
  }

  // Job 2 arrives at 80ms (interactive action)
  await new Promise((r) => setTimeout(r, 80));
  const fifoJob2Promise = fifo.enqueue('job-2-interactive', simulateTask('interactive-1'));

  // Job 3 arrives at 150ms (urgent status check)
  await new Promise((r) => setTimeout(r, 70));
  const fifoJob3Promise = fifo.enqueue('job-3-urgent', simulateTask('urgent-1'));

  await Promise.all([...fifoJob1Promises, fifoJob2Promise, fifoJob3Promise]);

  const fifoJob1Metrics = fifo.metrics.filter((m) => m.jobId === 'job-1-bulk');
  const fifoJob2Metric = fifo.metrics.find((m) => m.jobId === 'job-2-interactive')!;
  const fifoJob3Metric = fifo.metrics.find((m) => m.jobId === 'job-3-urgent')!;

  const fifoJob1AvgWait = fifoJob1Metrics.reduce((acc, m) => acc + m.queueWaitMs, 0) / fifoJob1Metrics.length;
  const fifoJob1TotalDuration = Math.max(...fifoJob1Metrics.map((m) => m.completedAt)) - Math.min(...fifoJob1Metrics.map((m) => m.enqueuedAt));

  console.log(`FIFO Results: Job 2 Wait: ${fifoJob2Metric.queueWaitMs.toFixed(0)}ms | Job 3 Wait: ${fifoJob3Metric.queueWaitMs.toFixed(0)}ms`);

  // =========================================================================
  // Test 2: Fair Rate Queue (Per-Job Round-Robin)
  // =========================================================================
  console.log('Testing FairRateQueue (Round-Robin per job)...');
  const fair = new FairRateQueue({ requestsPerSecond: rps, maxBurstTokens: 3 });

  const fairJob1Promises = [];
  for (let i = 0; i < 15; i++) {
    fairJob1Promises.push(fair.enqueue('job-1-bulk', simulateTask(`bulk-${i}`)));
  }

  // Job 2 arrives at 80ms
  await new Promise((r) => setTimeout(r, 80));
  const fairJob2Promise = fair.enqueue('job-2-interactive', simulateTask('interactive-1'));

  // Job 3 arrives at 150ms
  await new Promise((r) => setTimeout(r, 70));
  const fairJob3Promise = fair.enqueue('job-3-urgent', simulateTask('urgent-1'));

  await Promise.all([...fairJob1Promises, fairJob2Promise, fairJob3Promise]);

  const fairJob1Metrics = fair.metrics.filter((m) => m.jobId === 'job-1-bulk');
  const fairJob2Metric = fair.metrics.find((m) => m.jobId === 'job-2-interactive')!;
  const fairJob3Metric = fair.metrics.find((m) => m.jobId === 'job-3-urgent')!;

  const fairJob1AvgWait = fairJob1Metrics.reduce((acc, m) => acc + m.queueWaitMs, 0) / fairJob1Metrics.length;
  const fairJob1TotalDuration = Math.max(...fairJob1Metrics.map((m) => m.completedAt)) - Math.min(...fairJob1Metrics.map((m) => m.enqueuedAt));

  const speedupRatio = fifoJob2Metric.totalMs / fairJob2Metric.totalMs;

  console.log(`FairQueue Results: Job 2 Wait: ${fairJob2Metric.queueWaitMs.toFixed(0)}ms | Job 3 Wait: ${fairJob3Metric.queueWaitMs.toFixed(0)}ms`);
  console.log(`Speedup for interactive Job 2: ${speedupRatio.toFixed(2)}x faster with FairQueue!`);

  return {
    workload: {
      job1_bulkRequests: 15,
      job2_interactiveRequests: 1,
      job3_urgentRequests: 1,
      rateLimitRps: rps,
    },
    fifo: {
      job1_avgWaitMs: Math.round(fifoJob1AvgWait),
      job1_totalDurationMs: Math.round(fifoJob1TotalDuration),
      job2_waitMs: Math.round(fifoJob2Metric.queueWaitMs),
      job2_totalMs: Math.round(fifoJob2Metric.totalMs),
      job3_waitMs: Math.round(fifoJob3Metric.queueWaitMs),
      job3_totalMs: Math.round(fifoJob3Metric.totalMs),
      headOfLineBlockingObserved: fifoJob2Metric.queueWaitMs > 3000,
    },
    fairQueue: {
      job1_avgWaitMs: Math.round(fairJob1AvgWait),
      job1_totalDurationMs: Math.round(fairJob1TotalDuration),
      job2_waitMs: Math.round(fairJob2Metric.queueWaitMs),
      job2_totalMs: Math.round(fairJob2Metric.totalMs),
      job3_waitMs: Math.round(fairJob3Metric.queueWaitMs),
      job3_totalMs: Math.round(fairJob3Metric.totalMs),
      headOfLineBlockingPrevented: fairJob2Metric.queueWaitMs < 1000,
      job2SpeedupRatio: Number(speedupRatio.toFixed(2)),
    },
    architecturalRecommendation: {
      queueLayer: 'Connector Gateway / Rate Limiter Service (Singleton in Electron Main Process)',
      schedulingAlgorithm: 'Deficit Round-Robin / Fair Queueing per Job ID kết hợp Leaky/Token Bucket',
      rationale:
        'Hàng đợi rate limit bắt buộc phải là singleton dùng chung tại tầng Runtime (Connector Gateway) ' +
        'để bảo đảm tổng số request phát ra không vượt quá trần 3 req/s của Notion. ' +
        'Để triệt tiêu hiện tượng Head-of-Line blocking (khi một job background gửi hàng chục request làm đơ job UI tương tác), ' +
        'thuật toán phân phối lượt gọi phải dùng Fair Queueing (Round-robin theo job_id) thay vì FIFO ngây thơ.',
    },
  };
}
