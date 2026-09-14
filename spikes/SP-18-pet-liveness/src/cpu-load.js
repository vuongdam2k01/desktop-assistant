const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

if (isMainThread) {
  const durationSec = parseInt(process.argv[2] || '10', 10);
  const targetPct = parseInt(process.argv[3] || '70', 10);
  const coreCount = os.cpus().length;
  console.log([CPU-Load] Spawning  workers for s at ~% load...);

  const workers = [];
  for (let i = 0; i < coreCount; i++) {
    const w = new Worker(__filename, { workerData: { durationSec, targetPct } });
    workers.push(w);
  }

  setTimeout(() => {
    console.log('[CPU-Load] Completed stress run.');
    process.exit(0);
  }, (durationSec + 1) * 1000);
} else {
  const { durationSec, targetPct } = workerData;
  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;

  // Duty cycle
  const workMs = Math.round((targetPct / 100) * 50);
  const sleepMs = 50 - workMs;

  function runCycle() {
    if (Date.now() >= endTime) return;
    const workEnd = Date.now() + workMs;
    while (Date.now() < workEnd) {
      Math.sin(Math.random()) * Math.cos(Math.random());
    }
    setTimeout(runCycle, sleepMs);
  }

  runCycle();
}
