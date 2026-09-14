import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scripts = [
  { name: "Q1: Tool Registry & Default Coding Tools Isolation", file: "src/test-q1-tools.ts" },
  { name: "Q2: Hard Gate Pre-Execution Wrap (0-Leakage)", file: "src/test-q2-hardgate.ts" },
  { name: "Q3: Pause & Resume at Exact Point (US-4.2 / AC2)", file: "src/test-q3-pause-resume.ts" },
  { name: "Q4: Multi-Instance Concurrency & Isolation", file: "src/test-q4-concurrency.ts" },
  { name: "Q5: Provider Layer & OpenAI-Compatible Integration", file: "src/test-q5-providers.ts" },
  { name: "Q6: Multimodal Image Input (FR-PET-04)", file: "src/test-q6-vision.ts" },
  { name: "Q7: Token Usage Tracking (R-6, R-11)", file: "src/test-q7-token-usage.ts" },
];

async function runScript(name: string, file: string): Promise<void> {
  console.log(`\n================================================================================`);
  console.log(`RUNNING: ${name} (${file})`);
  console.log(`================================================================================\n`);

  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", file], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`\n✅ ${name}: PASSED`);
        resolve();
      } else {
        console.error(`\n❌ ${name}: FAILED with exit code ${code}`);
        reject(new Error(`Script ${file} failed with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log("Starting SP-6 Comprehensive Verification Suite...");
  const t0 = Date.now();

  for (const s of scripts) {
    await runScript(s.name, s.file);
  }

  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n================================================================================`);
  console.log(`ALL SPIKE SP-6 TESTS PASSED SUCCESSFULLY in ${durationSec}s!`);
  console.log(`================================================================================\n`);
}

main().catch((err) => {
  console.error("Suite failed:", err.message);
  process.exit(1);
});
