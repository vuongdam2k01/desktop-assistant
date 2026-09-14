const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

if (isMainThread) {
  const targetPercent = parseInt(process.argv[2] || '70', 10);
  const durationSec = parseInt(process.argv[3] || '10', 10);
  const numCores = os.cpus().length;
  // Use numCores threads
  const numWorkers = numCores;

  console.log(`[CPU Load] Starting ${numWorkers} worker threads targeting ${targetPercent}% CPU for ${durationSec}s...`);

  const workers = [];
  for (let i = 0; i < numWorkers; i++) {
    const w = new Worker(__filename, {
      workerData: { targetPercent, durationSec }
    });
    workers.push(w);
  }

  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed++;
    if (elapsed >= durationSec) {
      clearInterval(timer);
      console.log('[CPU Load] Completed duration.');
    }
  }, 1000);

  Promise.all(workers.map(w => new Promise((res) => w.on('exit', res)))).then(() => {
    console.log('[CPU Load] All workers finished.');
    process.exit(0);
  });
} else {
  const { targetPercent, durationSec } = workerData;
  const totalDurationMs = durationSec * 1000;
  const start = Date.now();

  // Calibration: cycle of 50ms
  const cycleMs = 50;
  const workMs = cycleMs * (targetPercent / 100);
  const sleepMs = cycleMs - workMs;

  function runCycle() {
    if (Date.now() - start >= totalDurationMs) return;

    const cycleStart = performance.now();
    // Busy spin
    while (performance.now() - cycleStart < workMs) {
      Math.sqrt(Math.random() * 100000);
    }
    // Sleep remaining
    setTimeout(runCycle, sleepMs);
  }

  runCycle();
}
