import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UniformLedger } from "../core/ledger.js";
import { HardGateEvaluator } from "../core/evaluator/evaluator.js";
import { createHardGatedTool } from "../core/wrapped-tool.js";
import { ToolGenerator } from "../generator/tool-generator.js";
import type { ConnectorManifest, ToolDefinition } from "../types/manifest-types.js";
import type { SessionContext } from "../core/evaluator/context.js";
import type { ConnectorAdapter } from "../adapters/adapter-interface.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../../evidence");
const logPath = path.resolve(evidenceDir, "q5-irreversible-gate.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + "\n");
}

async function runQ5Test() {
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  log("================================================================================");
  log("SPIKE SP-19 / Q5: Thao tác gắn cờ irreversible tự động thuộc diện phê duyệt");
  log("Yêu cầu FR-AP-05, FR-CF-07: Ở mode smart/on, thao tác irreversible mặc định cần phê duyệt");
  log("================================================================================\n");

  const ledger = new UniformLedger();
  // Evaluator RỖNG, KHÔNG hề khai báo bất kỳ user rule nào về comment hay purge cache
  const evaluator = new HardGateEvaluator([]);

  // Manifest giả lập bổ sung một tool irreversible nhân tạo
  const mockManifest: ConnectorManifest = {
    schema_version: "v0",
    id: "system_service",
    name: "System Service",
    version: "1.0.0",
    icon: "service.svg",
    description: "Mock service for testing irreversible gate",
    auth: {
      type: "api_key",
      endpoints: {},
      capabilities: {},
    },
    tools: [
      {
        id: "purge_permanent_logs",
        name: "service_purge_permanent_logs",
        label: "Purge All Logs Permanently",
        description: "Permanently erase all historical system logs. Cannot be undone.",
        category: "write",
        parameters: {
          type: "object",
          properties: {
            retention_days: { type: "number", description: "Logs older than days" },
          },
          required: ["retention_days"],
        },
        snapshot: { enabled: false },
        compensation: { type: "none" },
        irreversible: true, // FR-CF-01 / FR-AP-05 flag
      },
      {
        id: "reversible_flush_cache",
        name: "service_reversible_flush_cache",
        label: "Flush Temporary Cache",
        description: "Flush RAM cache, rebuildable on demand.",
        category: "write",
        parameters: {
          type: "object",
          properties: {
            cache_name: { type: "string" },
          },
        },
        snapshot: { enabled: false },
        compensation: { type: "static_formula", formula_type: "custom" },
        irreversible: false,
      },
    ],
  };

  let executionAttempted = false;
  const mockAdapter: ConnectorAdapter = {
    connectorId: "system_service",
    initialize: async () => {},
    checkStatus: async () => ({ status: "connected", checkedAt: new Date().toISOString() }),
    revoke: async () => true,
    execute: async (_op: string, _params: any) => {
      executionAttempted = true;
      return { success: true, message: "CRITICAL: Irreversible operation was executed!" };
    },
  };

  const tools = ToolGenerator.generateTools(mockManifest, mockAdapter);
  const purgeTool = tools.find((t) => t.manifestMeta.toolId === "purge_permanent_logs")!;
  const flushTool = tools.find((t) => t.manifestMeta.toolId === "reversible_flush_cache")!;

  // 1. Thử nghiệm ở Approval Mode = "smart": KHÔNG CÓ USER RULE NÀO ĐƯỢC KHAI
  const sessionSmart: SessionContext = {
    jobId: "job-q5-smart-mode",
    mode: "smart",
    currentUser: "admin@example.com",
    now: new Date(),
    cumulativeWritesInJob: 0,
    deadlineChangesInJob: 0,
    distinctPagesModifiedInJob: new Set(),
    createdPagesInJob: new Set(),
    dailyTaskCreates: 0,
    activeJobApprovals: [], // Không có token phê duyệt trước
  };

  const wrappedPurge = createHardGatedTool(purgeTool, ledger, evaluator, sessionSmart, mockAdapter);

  log("[1] Thử gọi tool có cờ 'irreversible: true' ở mode 'smart' (không có rule nào nhắc đến):");
  executionAttempted = false;
  const purgeResult = await wrappedPurge.execute("call-purge-1", { retention_days: 30 });

  log(`  - Kết quả trả về: ${JSON.stringify(purgeResult.details)}`);
  log(`  - Adapter có bị gọi lén không? executionAttempted = ${executionAttempted}`);

  if (executionAttempted) {
    throw new Error("VIOLATION: Irreversible tool executed without approval!");
  }
  if (purgeResult.details?.verdict !== "APPROVAL_REQUIRED" || purgeResult.details?.ruleId !== "FR-AP-05-IRREVERSIBLE") {
    throw new Error(`Expected FR-AP-05-IRREVERSIBLE gate, got ${JSON.stringify(purgeResult.details)}`);
  }
  log("  ✅ ĐẠT: Hook tự động chặn và yêu cầu phê duyệt [FR-AP-05-IRREVERSIBLE] mà KHÔNG cần khai thêm ở nơi khác.");

  // 2. Thử gọi tool không gắn cờ irreversible (reversible_flush_cache) ở mode smart
  log("\n[2] Thử gọi tool KHÔNG gắn cờ irreversible ở mode 'smart':");
  executionAttempted = false;
  const wrappedFlush = createHardGatedTool(flushTool, ledger, evaluator, sessionSmart, mockAdapter);
  const flushResult = await wrappedFlush.execute("call-flush-1", { cache_name: "redis_temp" });
  log(`  - Kết quả trả về: success=${flushResult.details?.success}`);
  log(`  - Adapter có được gọi không? executionAttempted = ${executionAttempted}`);

  if (!executionAttempted) {
    throw new Error("Reversible tool should be allowed when no specific blocking rule matches");
  }
  log("  ✅ ĐẠT: Tool reversible chạy bình thường, chứng minh cờ irreversible được phân biệt chính xác.");

  // 3. Thử nghiệm khi người dùng đã cấp phê duyệt (Approved token)
  log("\n[3] Thử nghiệm khi người dùng ĐÃ BẤM PHÊ DUYỆT (Active Job Approval token tồn tại):");
  const sessionApproved: SessionContext = {
    ...sessionSmart,
    activeJobApprovals: [
      {
        jobId: "job-q5-smart-mode",
        ruleId: "FR-AP-05-IRREVERSIBLE",
        toolName: purgeTool.name,
      },
    ],
  };

  executionAttempted = false;
  const wrappedPurgeApproved = createHardGatedTool(purgeTool, ledger, evaluator, sessionApproved, mockAdapter);
  const approvedResult = await wrappedPurgeApproved.execute("call-purge-2", { retention_days: 30 });
  log(`  - Kết quả sau phê duyệt: executionAttempted = ${executionAttempted}`);

  if (!executionAttempted || !approvedResult.details?.success) {
    throw new Error("Approved irreversible tool should execute successfully");
  }
  log("  ✅ ĐẠT: Sau khi người dùng duyệt, tool irreversible thực thi an toàn.");

  log("\n================================================================================");
  log("KẾT LUẬN Q5: ĐẠT 100%");
  log("Thao tác gắn cờ `irreversible: true` trong manifest TỰ ĐỘNG thuộc diện phê duyệt");
  log("(FR-AP-05 / FR-CF-07) ở mode smart/on mà KHÔNG CẦN khai thêm ở bất kỳ đâu khác.");
  log("================================================================================");
}

runQ5Test().catch((err) => {
  console.error("Test Q5 failed:", err);
  process.exit(1);
});
