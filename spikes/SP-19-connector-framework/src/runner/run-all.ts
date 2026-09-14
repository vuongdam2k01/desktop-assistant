import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const evidenceDir = path.resolve(rootDir, "evidence");
const summaryPath = path.resolve(evidenceDir, "run-all-summary.log");

interface TestSuite {
  id: string;
  name: string;
  file: string;
}

const SUITES: TestSuite[] = [
  { id: "Q1", name: "Manifest Schema Validation (Notion & Gmail)", file: "src/tests/test-q1-schema.ts" },
  { id: "Q2", name: "Dynamic Tool Generation & Harness Pi Registration", file: "src/tests/test-q2-tool-generation.ts" },
  { id: "Q3", name: "Core Diff Measurement (PRD §10.10 Proposition)", file: "src/tests/test-q3-core-diff.ts" },
  { id: "Q4", name: "Uniform Hook & Ledger across Different Connectors", file: "src/tests/test-q4-uniform-ledger.ts" },
  { id: "Q5", name: "Irreversible Flag Automatic Approval Gate (FR-AP-05)", file: "src/tests/test-q5-irreversible-gate.ts" },
  { id: "Q6", name: "Disconnected Connector Exclusion (FR-CF-06)", file: "src/tests/test-q6-disconnected-filtering.ts" },
  { id: "Q7", name: "Multi-Connector Job Execution (FR-CF-10)", file: "src/tests/test-q7-multi-connector-job.ts" },
  { id: "Q8", name: "Channel Release Scope Profiles (FR-CF-04)", file: "src/tests/test-q8-scope-profiles.ts" },
  { id: "Q9", name: "Connector Health Status Detection (FR-CF-05)", file: "src/tests/test-q9-status-detection.ts" },
  { id: "Q10", name: "Disconnect Revoke & In-flight Fail Clean (FR-CF-08, FR-AG-07)", file: "src/tests/test-q10-disconnect-revoke.ts" },
  { id: "Q11", name: "Model Context Protocol (MCP) Compatibility (FR-CF-09)", file: "src/tests/test-q11-mcp-compat.ts" },
];

async function main() {
  console.log("================================================================================");
  console.log("SPIKE SP-19: CONNECTOR FRAMEWORK FULL TEST SUITE RUNNER");
  console.log("================================================================================\n");

  const summaryLines: string[] = [];
  summaryLines.push(`RUN ALL EXECUTED AT: ${new Date().toISOString()}`);
  summaryLines.push("--------------------------------------------------------------------------------");

  let passed = 0;
  let failed = 0;

  for (const suite of SUITES) {
    console.log(`\n▶ [${suite.id}] Running: ${suite.name}...`);
    const start = Date.now();
    try {
      execSync(`npx tsx ${suite.file}`, {
        cwd: rootDir,
        stdio: "inherit",
        timeout: 90000,
      });
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`✅ [${suite.id}] PASSED (${duration}s)`);
      summaryLines.push(`[${suite.id}] PASSED (${duration}s) - ${suite.name}`);
      passed++;
    } catch (err: any) {
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.error(`❌ [${suite.id}] FAILED (${duration}s): ${err.message}`);
      summaryLines.push(`[${suite.id}] FAILED (${duration}s) - ${suite.name}: ${err.message}`);
      failed++;
    }
  }

  summaryLines.push("--------------------------------------------------------------------------------");
  summaryLines.push(`TOTAL: ${SUITES.length} | PASSED: ${passed} | FAILED: ${failed}`);

  fs.writeFileSync(summaryPath, summaryLines.join("\n"), "utf-8");

  console.log("\n================================================================================");
  console.log(`TỔNG KẾT: ${passed}/${SUITES.length} test suites ĐẠT, ${failed} hỏng.`);
  console.log(`Log tổng kết: ${summaryPath}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
