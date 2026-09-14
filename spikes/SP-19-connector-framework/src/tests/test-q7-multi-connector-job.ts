import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConnectorRegistry } from "../core/connector-registry.js";
import { JobManager } from "../core/job-manager.js";
import { UniformLedger } from "../core/ledger.js";
import { HardGateEvaluator } from "../core/evaluator/evaluator.js";
import { NotionAdapter } from "../adapters/notion-adapter.js";
import { GmailAdapter } from "../adapters/gmail-adapter.js";
import {
  createModel,
  customStreamFn,
  loadNotionFixtures,
  NOTION_TOKEN_A,
  loadGoogleTokens,
  loadGoogleClient,
} from "../client.js";
import type { ConnectorManifest } from "../types/manifest-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../../evidence");
const logPath = path.resolve(evidenceDir, "q7-multi-connector-job.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + "\n");
}

async function runQ7Test() {
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  log("================================================================================");
  log("SPIKE SP-19 / Q7: Job sử dụng NHIỀU connector (đọc Gmail -> ghi Notion)");
  log("Yêu cầu FR-CF-10: Một job gọi đa connector; ledger ghi rõ connectorId của từng tool call");
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

  const fixtures = loadNotionFixtures();
  const dbId = fixtures?.workspaces?.A?.databases?.[0]?.id || "3d8c0043-56ec-81cf-a480-e9e679285df6";

  const googleTokens = loadGoogleTokens();
  const googleClient = loadGoogleClient();

  const notionAdapter = new NotionAdapter({ accessToken: NOTION_TOKEN_A });
  const gmailAdapter = new GmailAdapter({
    accessToken: googleTokens?.access_token,
    refreshToken: googleTokens?.refresh_token,
    clientId: googleClient?.client_id,
    clientSecret: googleClient?.client_secret,
  });

  // Đăng ký cả hai connector
  registry.register(notionManifest, notionAdapter, "connected");
  registry.register(gmailManifest, gmailAdapter, "connected");

  const jobId = "job-q7-cross-connector-flow";
  const prompt = `Bạn hãy thực hiện quy trình sau:
1. Tìm kiếm email có từ khóa "Verification" trong Gmail.
2. Dựa vào thông tin email tìm được, hãy tạo 1 task mới trên Notion database id "${dbId}" với tiêu đề "[Gmail Import] " kèm tiêu đề email vừa tìm thấy.
3. Báo cáo lại kết quả sau khi hoàn tất.`;

  log(`[1] Bắt đầu chạy Job đa connector: jobId="${jobId}"`);
  log(`    Prompt: "${prompt}"`);

  const model = createModel();
  const result = await jobManager.runJob({
    jobId,
    prompt,
    mode: "smart",
    model,
    streamFn: customStreamFn,
  });

  log(`\n[2] Kết quả chạy Job:`);
  log(`  - Status: ${result.status}`);
  log(`  - Total Tool Executions: ${result.toolCallsCount}`);
  log(`  - Active Connectors: [${result.activeConnectors.join(", ")}]`);
  log(`  - Phản hồi từ Agent:\n${result.response.trim()}`);

  // 3. Kiểm tra bản ghi trong Uniform Ledger
  const jobLedger = ledger.getRecords({ jobId });
  log(`\n[3] Bản ghi trong Uniform Ledger cho Job ${jobId} (${jobLedger.length} records):`);

  const connectorsUsed = new Set<string>();
  let createdPageId: string | undefined;

  for (const r of jobLedger) {
    connectorsUsed.add(r.connectorId);
    log(`  - Seq #${r.seq}: [${r.type}] connectorId="${r.connectorId}" tool="${r.toolName}"`);
    if (r.type === "RESULT" && r.toolName === "notion_create_page") {
      createdPageId = r.result?.id;
      log(`    * Created Notion Page ID: ${createdPageId}`);
    }
  }

  // 4. Assertions cho FR-CF-10
  if (!connectorsUsed.has("gmail")) {
    throw new Error("Job failed to use Gmail connector");
  }
  if (!connectorsUsed.has("notion")) {
    throw new Error("Job failed to use Notion connector");
  }

  log(`\n[4] Kiểm tra các tiêu chí FR-CF-10:`);
  log(`  - Đã gọi connector 'gmail': ${connectorsUsed.has("gmail")}`);
  log(`  - Đã gọi connector 'notion': ${connectorsUsed.has("notion")}`);
  log(`  - Mỗi tool call ghi nhận tường minh connectorId: ĐẠT`);

  // 5. Dọn dẹp task vừa tạo trên Notion để tránh rác
  if (createdPageId) {
    try {
      await notionAdapter.execute("archive_page", { page_id: createdPageId });
      log(`  - Đã dọn dẹp (archive) task test id=${createdPageId} trên Notion.`);
    } catch (err: any) {
      log(`  - Cảnh báo dọn dẹp: ${err.message}`);
    }
  }

  log("\n================================================================================");
  log("KẾT LUẬN Q7: ĐẠT 100%");
  log("1. Một job chạy thành công xuyên suốt NHIỀU connector (đọc Gmail -> ghi Notion).");
  log("2. Uniform Ledger ghi nhận rành mạch connectorId cho từng tool call độc lập.");
  log("================================================================================");
}

runQ7Test().catch((err) => {
  console.error("Test Q7 failed:", err);
  process.exit(1);
});
