import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConnectorRegistry } from "../core/connector-registry.js";
import { UniformLedger } from "../core/ledger.js";
import { HardGateEvaluator } from "../core/evaluator/evaluator.js";
import { createHardGatedTool } from "../core/wrapped-tool.js";
import { ToolGenerator } from "../generator/tool-generator.js";
import { GmailAdapter } from "../adapters/gmail-adapter.js";
import type { ConnectorManifest } from "../types/manifest-types.js";
import type { SessionContext } from "../core/evaluator/context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../../evidence");
const logPath = path.resolve(evidenceDir, "q10-disconnect-revoke.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + "\n");
}

async function runQ10Test() {
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  log("================================================================================");
  log("SPIKE SP-19 / Q10: Ngắt kết nối gọi revoke endpoint và job fail sạch (FR-CF-08, FR-AG-07)");
  log("Yêu cầu: Gọi revoke endpoint, xoá token; job đang chạy dùng connector đó fail sạch");
  log("================================================================================\n");

  const registry = new ConnectorRegistry();
  const ledger = new UniformLedger();
  const evaluator = new HardGateEvaluator([]);

  const gmailManifest: ConnectorManifest = JSON.parse(
    fs.readFileSync(path.resolve(evidenceDir, "gmail.manifest.json"), "utf-8")
  );

  // 1. Khởi tạo Gmail adapter có token giả lập cho test revoke
  const testAccessToken = "test_access_token_mock_to_revoke";
  const gmailAdapter = new GmailAdapter({
    accessToken: testAccessToken,
    refreshToken: "test_refresh_token",
    clientId: "mock_client_id",
    clientSecret: "mock_client_secret",
  });

  registry.register(gmailManifest, gmailAdapter, "connected");

  log("[1] Trạng thái ban đầu:");
  log(`  - Connector: ${gmailManifest.id}`);
  log(`  - Revoke endpoint khai báo trong manifest: ${gmailManifest.auth.endpoints.revoke_url}`);
  log(`  - Registry status: ${registry.getStatus("gmail")}`);

  // 2. Sinh tools và chuẩn bị một job đang chạy
  const tools = ToolGenerator.generateTools(gmailManifest, gmailAdapter);
  const searchTool = tools.find((t) => t.manifestMeta.toolId === "search_emails")!;

  const session: SessionContext = {
    jobId: "job-q10-in-flight",
    mode: "smart",
    currentUser: "user@example.com",
    now: new Date(),
    cumulativeWritesInJob: 0,
    deadlineChangesInJob: 0,
    distinctPagesModifiedInJob: new Set(),
    createdPagesInJob: new Set(),
    dailyTaskCreates: 0,
    activeJobApprovals: [],
  };

  const wrappedTool = createHardGatedTool(searchTool, ledger, evaluator, session, gmailAdapter);

  // 3. Thực hiện NGẮT KẾT NỐI (DISCONNECT & REVOKE)
  log("\n[2] Thực hiện hành động ngắt kết nối (Disconnect & Revoke):");
  const revokeSuccess = await gmailAdapter.revoke();
  registry.setStatus("gmail", "revoked");

  log(`  - Đã gọi adapter.revoke(): success = ${revokeSuccess}`);
  log(`  - Trạng thái adapter sau revoke: ${(await gmailAdapter.checkStatus()).status}`);
  log(`  - Trạng thái trong registry: ${registry.getStatus("gmail")}`);

  if (!revokeSuccess) {
    throw new Error("Revoke call failed");
  }
  log("  ✅ Revoke hoàn tất, token nội bộ đã bị xoá khỏi bộ nhớ an toàn.");

  // 4. Job đang chạy gọi tool của connector vừa bị ngắt kết nối
  log("\n[3] Mô phỏng Job đang chạy (in-flight) cố gọi tool sau khi connector đã bị ngắt:");
  let caughtError: any = null;

  try {
    await wrappedTool.execute("call-inflight-1", { query: "urgent" });
  } catch (err: any) {
    caughtError = err;
    log(`  ⚡ Bắt được lỗi khi thực thi tool: ${err.message}`);
  }

  if (!caughtError) {
    throw new Error("Tool execution must fail after connector is revoked!");
  }

  const isCleanFail = caughtError.message.includes("CONNECTOR_REVOKED");
  log(`  - Lỗi có phải dạng chuẩn CONNECTOR_REVOKED không? ${isCleanFail}`);

  if (!isCleanFail) {
    throw new Error(`Expected clean error with code CONNECTOR_REVOKED, got: ${caughtError.message}`);
  }

  // 5. Kiểm tra Ledger có ghi nhận trạng thái BLOCKED sạch sẽ không (FR-AG-07)
  const records = ledger.getRecords({ jobId: session.jobId });
  log(`\n[4] Kiểm tra bản ghi Uniform Ledger cho job bị fail:`);
  for (const r of records) {
    log(`  - Seq #${r.seq}: [${r.type}] tool=${r.toolName} reason=${r.reason || "n/a"}`);
  }

  const blockedRecord = records.find((r) => r.type === "BLOCKED");
  if (!blockedRecord || !blockedRecord.reason?.includes("CONNECTOR_REVOKED")) {
    throw new Error("Ledger must record BLOCKED event with clear revocation reason");
  }
  log("  ✅ ĐẠT: Ledger ghi nhận BLOCKED sạch sẽ, kèm mã lỗi rõ ràng.");

  log("\n================================================================================");
  log("KẾT LUẬN Q10: ĐẠT 100%");
  log("1. Ngắt kết nối thực hiện gọi revoke endpoint và xoá sạch token khỏi bộ nhớ.");
  log("2. Job đang chạy (in-flight) đụng connector đã ngắt sẽ FAIL SẠCH theo FR-AG-07,");
  log("   không treo luồng, không nuốt lỗi, và ghi nhận lý do rõ ràng vào ledger.");
  log("================================================================================");
}

runQ10Test().catch((err) => {
  console.error("Test Q10 failed:", err);
  process.exit(1);
});
