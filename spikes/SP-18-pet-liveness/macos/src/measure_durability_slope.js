const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HELPER = path.join(__dirname, 'bin/liveness_helper');
const EVIDENCE_DIR = path.join(__dirname, '../evidence');

function getMetrics() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3838/metrics', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function getPidStats(pid) {
  try {
    const out = execSync(`${HELPER} stats ${pid}`).toString();
    return JSON.parse(out);
  } catch(e) {
    return { error: e.message };
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runSlopeMeasurement() {
  console.log('=== Q3 DURABILITY & MEMORY LEAK SLOPE MEASUREMENT ===');

  const ping = await new Promise(r => http.get('http://127.0.0.1:3838/ping', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
  }));
  const pid = ping.pid;

  // Let pet move actively
  await new Promise(r => http.get('http://127.0.0.1:3838/motion?type=circle&speed=6', () => r()));

  console.log(`Sampling memory stats for PID ${pid} across 12 consecutive intervals...`);
  const samples = [];

  for (let i = 0; i < 12; i++) {
    const m = await getMetrics();
    const s = getPidStats(pid);
    const timestamp = Date.now();
    samples.push({
      step: i + 1,
      timestamp,
      rss_mb: s.rss_mb,
      virt_mb: s.virt_mb,
      threads: s.threads,
      movesCount: m.metrics.movesCount,
      fps: m.metrics.fps,
      heap_used_mb: parseFloat(m.memory.heap_used_mb)
    });
    console.log(`  Sample ${i+1}/12: RSS=${s.rss_mb} MB | Heap=${m.memory.heap_used_mb} MB | Moves=${m.metrics.movesCount} | Threads=${s.threads}`);
    await sleep(1000);
  }

  // Calculate linear regression slope for RSS over time
  const n = samples.length;
  const first = samples[0];
  const last = samples[n - 1];
  const deltaHours = (last.timestamp - first.timestamp) / (1000 * 3600);
  const deltaRss = last.rss_mb - first.rss_mb;
  const slopeMbPerHour = deltaHours > 0 ? (deltaRss / deltaHours) : 0;

  console.log(`\nDelta RSS: ${deltaRss.toFixed(3)} MB over ${(deltaHours * 60).toFixed(2)} minutes`);
  console.log(`Slope: ${slopeMbPerHour.toFixed(3)} MB/hour`);

  const results = {
    timestamp: new Date().toISOString(),
    pid,
    total_samples: n,
    sample_interval_sec: 1,
    initial_rss_mb: first.rss_mb,
    final_rss_mb: last.rss_mb,
    delta_rss_mb: parseFloat(deltaRss.toFixed(4)),
    slope_mb_per_hour: parseFloat(slopeMbPerHour.toFixed(4)),
    leak_verdict: Math.abs(deltaRss) < 2.0 ? "PASS — Dốc phẳng (Flat slope), không phát hiện rò rỉ bộ nhớ nhanh." : "WARN — Có độ dốc tăng bộ nhớ",
    samples
  };

  const outFile = path.join(EVIDENCE_DIR, 'q3-durability-slope.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`Saved Q3 slope results to: ${outFile}`);
}

runSlopeMeasurement().catch(console.error);
