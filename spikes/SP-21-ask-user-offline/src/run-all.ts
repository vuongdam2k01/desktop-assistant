import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scripts = [
  { name: "Q1: ask_user Structured Parameters & Schema", file: "src/test-q1-schema.ts" },
  { name: "Q2: Max One Pending Ask Constraint & Consolidation", file: "src/test-q2-max-one-ask.ts" },
  { name: "Q3: Pause/Resume without Step Duplication (US-4.2/AC2)", file: "src/test-q3-pause-resume.ts" },
  { name: "Q4: Option ID & Case E9 Contradictory Free Text", file: "src/test-q4-options-freetext.ts" },
  { name: "Q5: SQLite Ledger Decision Record & Append-Only", file: "src/test-q5-ledger-decision.ts" },
  { name: "Q6: waiting_input Timeout & Safe Resume", file: "src/test-q6-timeout.ts" },
  { name: "Q7: ASK vs APPROVAL Distinction & Anti-Evasion", file: "src/test-q7-evasion-hook.ts" },
  { name: "Q8: Offline Command Queue Intake during Outage", file: "src/test-q8-offline-queue.ts" },
  { name: "Q9: SYSTEM Card Anatomy & Status Verification", file: "src/test-q9-system-card.ts" },
  { name: "Q10: Auto-Resend FIFO Order & Idempotency", file: "src/test-q10-auto-resend.ts" },
  { name: "Q11: R-9 Active Job Continuity during Backend Outage", file: "src/test-q11-job-during-outage.ts" },
  { name: "Q12: Local Queue Persistence across App Restarts", file: "src/test-q12-persistence-storage.ts" },
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
  console.log("Starting SP-21 Comprehensive Verification Suite (12 Questions)...");
  const t0 = Date.now();

  for (const s of scripts) {
    await runScript(s.name, s.file);
  }

  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n================================================================================`);
  console.log(`ALL SPIKE SP-21 TESTS (Q1-Q12) PASSED SUCCESSFULLY in ${durationSec}s!`);
  console.log(`================================================================================\n`);
}

main().catch((err) => {
  console.error("SP-21 Suite failed:", err.message);
  process.exit(1);
});
