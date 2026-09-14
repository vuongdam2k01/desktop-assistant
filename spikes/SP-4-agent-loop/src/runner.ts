import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ImageContent } from "@earendil-works/pi-ai";
import { SCENARIOS, type ScenarioDefinition } from "./scenarios-data.js";
import { resetWorkspaceA, resetWorkspaceB, resetWorkspaceC, snapshotWorkspace } from "./notion-state.js";
import { createHarnessAgent, type HarnessExecutionStats } from "./harness/agent-harness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, "../evidence");
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

export interface ScenarioResult {
  id: string;
  workspace: "A" | "B" | "C";
  complexity: "đơn" | "vừa" | "phức";
  success: boolean;
  reasons: string[];
  hasSelfVerified: boolean;
  shouldAsk: boolean;
  askedCount: number;
  clarificationStatus: "CORRECT" | "UNDER_ASKING" | "OVER_ASKING";
  stats: HarnessExecutionStats;
  finalAssistantResponse: string;
}

async function runScenario(scenario: ScenarioDefinition): Promise<ScenarioResult> {
  console.log(`\n================================================================================`);
  console.log(`▶ CHẠY KỊCH BẢN: ${scenario.id} (Workspace ${scenario.workspace}, Độ phức tạp: ${scenario.complexity})`);
  console.log(`  Lệnh: "${scenario.instruction}"`);
  if (scenario.imagePath) console.log(`  Ảnh đính kèm: ${scenario.imagePath}`);
  console.log(`================================================================================`);

  // 1. Reset Workspace về Seed chuẩn
  console.log(`[1] Dựng trạng thái ban đầu chuẩn (Workspace ${scenario.workspace})...`);
  if (scenario.workspace === "A") await resetWorkspaceA();
  else if (scenario.workspace === "B") await resetWorkspaceB();
  else if (scenario.workspace === "C") await resetWorkspaceC();
  console.log(`[1] Đã dựng seed thành công.`);

  // 2. Khởi tạo Agent Harness
  const { agent, stats } = createHarnessAgent({
    workspace: scenario.workspace,
    isVision: Boolean(scenario.imagePath),
    onAskUser: async (q, opts) => {
      console.log(`  💬 [Agent hỏi]: "${q}" ${opts ? `(Options: ${opts.join(" | ")})` : ""}`);
      const ans = scenario.userAnswer || "Đồng ý thực hiện";
      console.log(`  👤 [User trả lời]: "${ans}"`);
      return ans;
    },
  });

  // Lắng nghe sự kiện token & turns
  agent.subscribe((event: any) => {
    if (event.type === "turn_start") {
      stats.turns++;
      console.log(`  [Turn ${stats.turns}] Bắt đầu suy luận...`);
    }
    if (event.type === "tool_execution_start") {
      console.log(`  ⚙️ [Tool Call]: ${event.toolName}(${JSON.stringify(event.arguments || event.params || {})})`);
    }
    if (event.type === "tool_execution_end") {
      console.log(`  ✔ [Tool Done]: ${event.toolName}`);
    }
    if (event.type === "turn_end") {
      const u = event.message?.usage;
      if (u) {
        stats.totalInputTokens += u.input || 0;
        stats.totalOutputTokens += u.output || 0;
        stats.totalReasoningTokens += u.reasoning || 0;
        stats.totalTokens += u.totalTokens || 0;
      }
    }
  });

  // 3. Chuẩn bị đầu vào (văn bản + ảnh nếu có)
  let images: ImageContent[] | undefined = undefined;
  if (scenario.imagePath && fs.existsSync(scenario.imagePath)) {
    const imgBuf = fs.readFileSync(scenario.imagePath);
    images = [
      {
        type: "image",
        data: imgBuf.toString("base64"),
        mimeType: "image/png",
      },
    ];
  }

  // 4. Chạy Agent Loop
  console.log(`[2] Khởi chạy vòng hoạt động agent...`);
  const startTime = Date.now();
  try {
    await agent.prompt(scenario.instruction, images);
  } catch (err: any) {
    console.error(`  ✗ Lỗi trong vòng hoạt động:`, err);
  }
  stats.durationMs = Date.now() - startTime;
  console.log(`[2] Hoàn tất vòng hoạt động trong ${(stats.durationMs / 1000).toFixed(2)}s (${stats.turns} turns, ${stats.toolCallsCount} tool calls).`);

  // Lấy câu trả lời cuối của agent
  const lastMsg = agent.state.messages[agent.state.messages.length - 1];
  const finalAssistantResponse =
    lastMsg && lastMsg.role === "assistant"
      ? lastMsg.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n")
      : "";

  // 5. Chụp Snapshot trạng thái Notion sau khi chạy
  console.log(`[3] Lấy snapshot trạng thái Notion sau khi chạy...`);
  const snapshot = await snapshotWorkspace(scenario.workspace);

  // 6. Tự động chấm điểm theo Ground Truth
  console.log(`[4] Chấm điểm đối chiếu với ground-truth...`);
  const evalResult = scenario.evaluate(snapshot, stats.askUserRecords);

  // Đánh giá hành vi hỏi lại (Clarification behavior)
  const asked = stats.askUserRecords.length > 0;
  let clarificationStatus: "CORRECT" | "UNDER_ASKING" | "OVER_ASKING" = "CORRECT";
  if (scenario.shouldAsk && !asked) {
    clarificationStatus = "UNDER_ASKING";
    evalResult.reasons.push("Hỏi thiếu: Kịch bản yêu cầu hỏi lại trước khi làm nhưng agent tự đoán!");
    evalResult.success = false;
  } else if (!scenario.shouldAsk && asked) {
    clarificationStatus = "OVER_ASKING";
    evalResult.reasons.push("Hỏi thừa (FR-AG-05): Thông tin đã rõ nhưng agent hỏi làm phiền người dùng!");
    evalResult.success = false;
  }

  console.log(`  Kết quả: ${evalResult.success ? "✅ ĐẠT (PASS)" : "❌ HỎNG (FAIL)"}`);
  if (!evalResult.success) {
    for (const r of evalResult.reasons) console.log(`   - ${r}`);
  }
  console.log(`  Tự kiểm chứng: ${stats.hasSelfVerified ? "CÓ" : "KHÔNG"}`);
  console.log(`  Hỏi lại: ${clarificationStatus} (Đã hỏi ${stats.askUserRecords.length} lần, Yêu cầu: ${scenario.shouldAsk ? "CÓ" : "KHÔNG"})`);
  console.log(`  Tài nguyên: ${stats.totalTokens} tokens (${stats.totalInputTokens} in / ${stats.totalOutputTokens} out)`);

  // 7. Lưu evidence
  const transcriptFile = path.resolve(EVIDENCE_DIR, `${scenario.id}-transcript.json`);
  const stateFile = path.resolve(EVIDENCE_DIR, `${scenario.id}-notion-state.json`);

  fs.writeFileSync(
    transcriptFile,
    JSON.stringify(
      {
        scenarioId: scenario.id,
        instruction: scenario.instruction,
        hasImage: Boolean(scenario.imagePath),
        stats,
        clarificationStatus,
        success: evalResult.success,
        reasons: evalResult.reasons,
        messages: agent.state.messages,
      },
      null,
      2
    ),
    "utf-8"
  );

  fs.writeFileSync(stateFile, JSON.stringify(snapshot, null, 2), "utf-8");

  return {
    id: scenario.id,
    workspace: scenario.workspace,
    complexity: scenario.complexity,
    success: evalResult.success,
    reasons: evalResult.reasons,
    hasSelfVerified: stats.hasSelfVerified,
    shouldAsk: scenario.shouldAsk,
    askedCount: stats.askUserRecords.length,
    clarificationStatus,
    stats,
    finalAssistantResponse,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const targetScenarioId = args.find((a) => a.startsWith("--scenario="))?.split("=")[1];
  const runAll = args.includes("--all") || !targetScenarioId;

  const scenariosToRun = runAll
    ? SCENARIOS
    : SCENARIOS.filter((s) => s.id.toLowerCase() === targetScenarioId?.toLowerCase());

  if (scenariosToRun.length === 0) {
    console.error(`Không tìm thấy kịch bản nào để chạy.`);
    process.exit(1);
  }

  console.log(`Bắt đầu chạy ${scenariosToRun.length} kịch bản...`);
  const results: ScenarioResult[] = [];

  for (const sc of scenariosToRun) {
    try {
      const res = await runScenario(sc);
      results.push(res);
    } catch (err) {
      console.error(`Lỗi nghiêm trọng khi chạy ${sc.id}:`, err);
    }
  }

  // ────────────────────────────────────────── Báo cáo tổng kết
  console.log(`\n\n================================================================================`);
  console.log(`TỔNG KẾT KẾT QUẢ SPIKE SP-4`);
  console.log(`================================================================================`);

  const total = results.length;
  const passed = results.filter((r) => r.success).length;
  const passRate = ((passed / total) * 100).toFixed(1);

  const selfVerifiedCount = results.filter((r) => r.hasSelfVerified).length;
  const correctClarification = results.filter((r) => r.clarificationStatus === "CORRECT").length;
  const underAskingCount = results.filter((r) => r.clarificationStatus === "UNDER_ASKING").length;
  const overAskingCount = results.filter((r) => r.clarificationStatus === "OVER_ASKING").length;

  // Thống kê theo độ phức tạp
  const calcGroupStats = (complexity: "đơn" | "vừa" | "phức") => {
    const group = results.filter((r) => r.complexity === complexity);
    if (group.length === 0) return { count: 0, avgSteps: 0, avgTokens: 0, medianSec: 0, avgSec: 0 };
    const steps = group.map((r) => r.stats.turns);
    const tokens = group.map((r) => r.stats.totalTokens);
    const secs = group.map((r) => r.stats.durationMs / 1000).sort((a, b) => a - b);

    const avgSteps = steps.reduce((a, b) => a + b, 0) / steps.length;
    const avgTokens = tokens.reduce((a, b) => a + b, 0) / tokens.length;
    const avgSec = secs.reduce((a, b) => a + b, 0) / secs.length;
    const medianSec = secs[Math.floor(secs.length / 2)];

    return {
      count: group.length,
      avgSteps: Number(avgSteps.toFixed(1)),
      avgTokens: Math.round(avgTokens),
      avgSec: Number(avgSec.toFixed(1)),
      medianSec: Number(medianSec.toFixed(1)),
    };
  };

  const simpleStats = calcGroupStats("đơn");
  const mediumStats = calcGroupStats("vừa");
  const complexStats = calcGroupStats("phức");

  console.log(`Q1: Tỉ lệ đạt trạng thái cuối đúng: ${passed}/${total} (${passRate}%)`);
  console.log(`Q2: Tự kiểm chứng trước khi báo xong: ${selfVerifiedCount}/${total} (${((selfVerifiedCount / total) * 100).toFixed(1)}%)`);
  console.log(`Q3: Chất lượng hỏi lại:`);
  console.log(`    - Đúng lúc: ${correctClarification}/${total} (${((correctClarification / total) * 100).toFixed(1)}%)`);
  console.log(`    - Hỏi thiếu (đoán mò): ${underAskingCount}`);
  console.log(`    - Hỏi thừa (vi phạm FR-AG-05): ${overAskingCount}`);
  console.log(`Q4: Số liệu hiệu năng theo độ phức tạp:`);
  console.log(`    - Job Đơn (${simpleStats.count} ca): ${simpleStats.avgSteps} bước | ${simpleStats.avgTokens} tokens | Trung vị ${simpleStats.medianSec}s (Trung bình ${simpleStats.avgSec}s) — NFR-PF-05 (≤30s): ${simpleStats.medianSec <= 30 ? "ĐẠT" : "KHÔNG ĐẠT"}`);
  console.log(`    - Job Vừa (${mediumStats.count} ca): ${mediumStats.avgSteps} bước | ${mediumStats.avgTokens} tokens | Trung vị ${mediumStats.medianSec}s (Trung bình ${mediumStats.avgSec}s)`);
  console.log(`    - Job Phức (${complexStats.count} ca): ${complexStats.avgSteps} bước | ${complexStats.avgTokens} tokens | Trung vị ${complexStats.medianSec}s (Trung bình ${complexStats.avgSec}s)`);

  // Lưu file tổng hợp
  const summaryFile = path.resolve(EVIDENCE_DIR, "summary-results.json");
  fs.writeFileSync(
    summaryFile,
    JSON.stringify(
      {
        total,
        passed,
        passRate: Number(passRate),
        selfVerifiedCount,
        correctClarification,
        underAskingCount,
        overAskingCount,
        groups: {
          simple: simpleStats,
          medium: mediumStats,
          complex: complexStats,
        },
        scenarios: results.map((r) => ({
          id: r.id,
          workspace: r.workspace,
          complexity: r.complexity,
          success: r.success,
          reasons: r.reasons,
          hasSelfVerified: r.hasSelfVerified,
          clarificationStatus: r.clarificationStatus,
          turns: r.stats.turns,
          tokens: r.stats.totalTokens,
          durationSec: Number((r.stats.durationMs / 1000).toFixed(2)),
        })),
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`\nĐã lưu kết quả tổng hợp vào: ${summaryFile}`);
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
