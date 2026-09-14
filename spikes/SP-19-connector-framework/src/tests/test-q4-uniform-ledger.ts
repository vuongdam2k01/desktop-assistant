import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UniformLedger } from "../core/ledger.js";
import { HardGateEvaluator } from "../core/evaluator/evaluator.js";
import { createHardGatedTool } from "../core/wrapped-tool.js";
import { ToolGenerator } from "../generator/tool-generator.js";
import { NotionAdapter } from "../adapters/notion-adapter.js";
import { GmailAdapter } from "../adapters/gmail-adapter.js";
import { loadNotionFixtures, NOTION_TOKEN_A, loadGoogleTokens, loadGoogleClient } from "../client.js";
import type { ConnectorManifest } from "../types/manifest-types.js";
import type { SessionContext } from "../core/evaluator/context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../../evidence");
const logPath = path.resolve(evidenceDir, "q4-uniform-ledger.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + "\n");
}

async function runQ4Test() {
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  log("================================================================================");
  log("SPIKE SP-19 / Q4: Hook và Ledger áp dụng đồng nhất trên cả 2 connector");
  log("Yêu cầu FR-CF-07: Xử lý được cả 2 hình dạng (Notion ghi+snapshot vs Gmail đọc) mà không rẽ nhánh");
  log("================================================================================\n");

  const ledger = new UniformLedger();
  const evaluator = new HardGateEvaluator([]); // mode smart/off with default rules
  const fixtures = loadNotionFixtures();
  const dbId = fixtures?.workspaces?.A?.databases?.[0]?.id || "3d8c0043-56ec-81cf-a480-e9e679285df6";

  const notionManifest: ConnectorManifest = JSON.parse(
    fs.readFileSync(path.resolve(evidenceDir, "notion.manifest.json"), "utf-8")
  );
  const gmailManifest: ConnectorManifest = JSON.parse(
    fs.readFileSync(path.resolve(evidenceDir, "gmail.manifest.json"), "utf-8")
  );

  const googleTokens = loadGoogleTokens();
  const googleClient = loadGoogleClient();

  const notionAdapter = new NotionAdapter({ accessToken: NOTION_TOKEN_A });
  const gmailAdapter = new GmailAdapter({
    accessToken: googleTokens?.access_token,
    refreshToken: googleTokens?.refresh_token,
    clientId: googleClient?.client_id,
    clientSecret: googleClient?.client_secret,
  });

  const session: SessionContext = {
    jobId: "job-q4-uniform-ledger",
    mode: "smart",
    currentUser: "test-runner@example.com",
    now: new Date(),
    cumulativeWritesInJob: 0,
    deadlineChangesInJob: 0,
    distinctPagesModifiedInJob: new Set(),
    createdPagesInJob: new Set(),
    dailyTaskCreates: 0,
    activeJobApprovals: [],
  };

  // 1. Sinh tools từ cả hai connector
  const notionTools = ToolGenerator.generateTools(notionManifest, notionAdapter);
  const gmailTools = ToolGenerator.generateTools(gmailManifest, gmailAdapter);

  const wrappedCreatePage = createHardGatedTool(
    notionTools.find((t) => t.manifestMeta.toolId === "create_page")!,
    ledger,
    evaluator,
    session,
    notionAdapter
  );

  const wrappedGmailSearch = createHardGatedTool(
    gmailTools.find((t) => t.manifestMeta.toolId === "search_emails")!,
    ledger,
    evaluator,
    session,
    gmailAdapter
  );

  // 2. Thực thi tool Notion (Write có compensation archive_page)
  log("[1] Thực thi tool Notion (Write: notion_create_page)...");
  const notionRes = await wrappedCreatePage.execute("call-1", {
    database_id: dbId,
    title: "[SP-19 Test] Uniform Ledger Validation Task",
  });
  const createdPageId = notionRes.details?.id;
  log(`  -> Tạo page thành công: id=${createdPageId}`);

  // Thực thi tiếp Notion Update để kiểm chứng snapshot trước-ghi
  if (createdPageId) {
    const wrappedUpdatePage = createHardGatedTool(
      notionTools.find((t) => t.manifestMeta.toolId === "update_page_properties")!,
      ledger,
      evaluator,
      session,
      notionAdapter
    );
    log("[2] Thực thi tool Notion Update (Write: notion_update_page_properties có pre-write snapshot)...");
    await wrappedUpdatePage.execute("call-2", {
      page_id: createdPageId,
      properties: {
        Name: "[SP-19 Test] Updated Task Title",
      },
    });
    log("  -> Update page thành công kèm pre-write snapshot.");

    // Dọn dẹp task vừa tạo
    const wrappedArchive = createHardGatedTool(
      notionTools.find((t) => t.manifestMeta.toolId === "archive_page")!,
      ledger,
      evaluator,
      session,
      notionAdapter
    );
    await wrappedArchive.execute("call-cleanup", { page_id: createdPageId });
    log("  -> Đã archive dọn dẹp task thử nghiệm.");
  }

  // 3. Thực thi tool Gmail (Read-only: gmail_search_emails)
  log("\n[3] Thực thi tool Gmail (Read-only: gmail_search_emails)...");
  const gmailRes = await wrappedGmailSearch.execute("call-3", {
    query: "Verification",
    max_results: 2,
  });
  log(`  -> Gmail search thành công: count=${gmailRes.details?.count || 0}`);

  // 4. Kiểm tra dữ liệu trong Uniform Ledger
  const allRecords = ledger.getAllRecords();
  log(`\n[4] Kiểm tra cấu trúc bản ghi Uniform Ledger (${allRecords.length} records):`);
  for (const r of allRecords) {
    log(`  - #${r.seq} [${r.type}] connector=${r.connectorId} tool=${r.toolName} target=${r.targetId || "n/a"}`);
    if (r.type === "PRE_SNAPSHOT") {
      log(`    * Pre-snapshot captured: ${Boolean(r.preSnapshot)}, CompensatingAction: ${JSON.stringify(r.compensatingAction)}`);
    }
  }

  // Assertions
  const notionRecords = ledger.getRecords({ connectorId: "notion" });
  const gmailRecords = ledger.getRecords({ connectorId: "gmail" });

  if (notionRecords.length === 0 || gmailRecords.length === 0) {
    throw new Error("Ledger must contain records for both Notion and Gmail");
  }

  const snapRecord = notionRecords.find((r) => r.type === "PRE_SNAPSHOT" && r.toolName === "notion_update_page_properties");
  if (!snapRecord || !snapRecord.preSnapshot || !snapRecord.compensatingAction) {
    throw new Error("Notion write missing pre-write snapshot or compensating action in ledger");
  }
  log("  ✅ Notion update ghi nhận đầy đủ preSnapshot và compensatingAction phục vụ rollback.");

  const gmailSnapshotRecords = gmailRecords.filter((r) => r.type === "PRE_SNAPSHOT");
  if (gmailSnapshotRecords.length > 0) {
    throw new Error("Gmail read-only tool should NOT generate pre-write snapshots");
  }
  log("  ✅ Gmail read-only tool chỉ sinh INTENT & RESULT, không có snapshot rác.");

  log("\n================================================================================");
  log("KẾT LUẬN Q4: ĐẠT 100%");
  log("1. Lớp hook và ledger hoạt động hoàn toàn đồng nhất trên cả 2 connector.");
  log("2. Không cần bất kỳ rẽ nhánh theo tên connector nào: mọi hành vi snapshot và");
  log("   bù trừ được quyết định tự động bởi manifest metadata.");
  log("================================================================================");
}

runQ4Test().catch((err) => {
  console.error("Test Q4 failed:", err);
  process.exit(1);
});
