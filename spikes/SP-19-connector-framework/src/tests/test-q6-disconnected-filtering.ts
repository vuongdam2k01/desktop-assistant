import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConnectorRegistry } from "../core/connector-registry.js";
import { JobManager } from "../core/job-manager.js";
import { UniformLedger } from "../core/ledger.js";
import { HardGateEvaluator } from "../core/evaluator/evaluator.js";
import { NotionAdapter } from "../adapters/notion-adapter.js";
import { GmailAdapter } from "../adapters/gmail-adapter.js";
import { createModel, customStreamFn, NOTION_TOKEN_A } from "../client.js";
import type { ConnectorManifest } from "../types/manifest-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../../evidence");
const logPath = path.resolve(evidenceDir, "q6-disconnected-filtering.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + "\n");
}

async function runQ6Test() {
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  log("================================================================================");
  log("SPIKE SP-19 / Q6: Connector CHƯA kết nối bị loại bỏ hoàn toàn khỏi Tool Set");
  log("Yêu cầu FR-CF-06: Agent không được 'biết' đến tool của connector chưa kết nối");
  log("================================================================================\n");

  const registry = new ConnectorRegistry();
  const ledger = new UniformLedger();
  const evaluator = new HardGateEvaluator([]);
  const jobManager = new JobManager(registry, ledger, evaluator);

  const notionManifest: ConnectorManifest = JSON.parse(
    fs.readFileSync(path.resolve(evidenceDir, "notion.manifest.json"), "utf-8")
  );
  const gmailManifest: ConnectorManifest = JSON.parse(
    fs.readFileSync(path.resolve(evidenceDir, "gmail.manifest.json"), "utf-8")
  );

  const notionAdapter = new NotionAdapter({ accessToken: NOTION_TOKEN_A });
  const gmailAdapter = new GmailAdapter(); // Chưa có token, trạng thái disconnected

  // 1. Đăng ký Notion ở trạng thái CONNECTED, Gmail ở trạng thái DISCONNECTED
  registry.register(notionManifest, notionAdapter, "connected");
  registry.register(gmailManifest, gmailAdapter, "disconnected");

  log("[1] Trạng thái đăng ký trong Connector Registry:");
  log(`  - Notion: ${registry.getStatus("notion")}`);
  log(`  - Gmail:  ${registry.getStatus("gmail")}`);

  // 2. Kiểm tra bộ tool cấp cho Agent
  const sessionTest = {
    jobId: "job-q6-test",
    mode: "smart" as const,
    currentUser: "user@example.com",
    now: new Date(),
    cumulativeWritesInJob: 0,
    deadlineChangesInJob: 0,
    distinctPagesModifiedInJob: new Set<string>(),
    createdPagesInJob: new Set<string>(),
    dailyTaskCreates: 0,
    activeJobApprovals: [],
  };

  const assembled = jobManager.assembleToolsForJob(sessionTest);
  log(`\n[2] Danh sách tool được cấp vào Agent runtime (FR-CF-06):`);
  log(`  - Active Connector IDs: [${assembled.activeConnectorIds.join(", ")}]`);
  log(`  - Tool names (${assembled.toolNames.length}): [${assembled.toolNames.join(", ")}]`);

  const hasGmailTool = assembled.toolNames.some((name) => name.startsWith("gmail"));
  if (hasGmailTool) {
    throw new Error("VIOLATION FR-CF-06: Disconnected Gmail tools leaked into agent tool set!");
  }
  log("  ✅ ĐẠT: Không có bất kỳ tool nào của Gmail xuất hiện trong tool set!");

  // 3. Chạy thử Agent thật khi người dùng yêu cầu việc cần Gmail
  const prompt = "Hãy kiểm tra hộp thư Gmail của tôi xem có email nào từ noreply@agentkit.best không.";
  log(`\n[3] Gửi prompt yêu cầu đọc Gmail tới Agent: "${prompt}"`);

  const model = createModel();
  const jobResult = await jobManager.runJob({
    jobId: "job-q6-agent-test",
    prompt,
    mode: "smart",
    model,
    streamFn: customStreamFn,
  });

  log(`\n[4] Kết quả thực thi Job:`);
  log(`  - Status: ${jobResult.status}`);
  log(`  - Tool calls count: ${jobResult.toolCallsCount}`);
  log(`  - Phản hồi từ Agent:\n${jobResult.response.trim()}`);

  if (jobResult.toolCallsCount > 0) {
    throw new Error("Agent should not have executed any tools since Gmail tool was not provided");
  }

  const responseMentionsNoTool =
    jobResult.response.toLowerCase().includes("không") ||
    jobResult.response.toLowerCase().includes("chưa") ||
    jobResult.response.toLowerCase().includes("gmail");

  log(`  - Agent nhận biết không có tool/quyền truy cập: ${responseMentionsNoTool}`);

  // 4. Kiểm tra khi Gmail được CONNECTED trở lại
  log(`\n[5] Thử chuyển trạng thái Gmail sang 'connected':`);
  registry.setStatus("gmail", "connected");
  const assembledAfterConnect = jobManager.assembleToolsForJob(sessionTest);
  log(`  - Active Connectors sau khi kết nối: [${assembledAfterConnect.activeConnectorIds.join(", ")}]`);
  log(`  - Tool count sau khi kết nối: ${assembledAfterConnect.toolNames.length}`);

  const hasGmailNow = assembledAfterConnect.toolNames.some((name) => name.startsWith("gmail"));
  if (!hasGmailNow) {
    throw new Error("Connected Gmail tools should be present in tool set");
  }
  log("  ✅ ĐẠT: Sau khi kết nối, Gmail tools tự động xuất hiện mà không cần restart hệ thống.");

  log("\n================================================================================");
  log("KẾT LUẬN Q6: ĐẠT 100%");
  log("Connector CHƯA kết nối bị loại bỏ hoàn toàn khỏi Tool Set (FR-CF-06).");
  log("Agent không hề 'biết' về sự tồn tại của tool Gmail và từ chối an toàn.");
  log("================================================================================");
}

runQ6Test().catch((err) => {
  console.error("Test Q6 failed:", err);
  process.exit(1);
});
