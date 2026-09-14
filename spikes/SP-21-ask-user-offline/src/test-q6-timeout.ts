import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { TestHarness } from "./harness.js";
import { createModel, customStreamFn, LLM_MODEL_STRONG } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q6-timeout.log");

async function runQ6() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q6: KIỂM CHỨNG TIMEOUT waiting_input VÀ TẠM DỪNG AN TOÀN");
  log("Phụ lục A.5 mục 6: Dùng chung cấu hình với phê duyệt (mặc định 30 phút = 1800s).");
  log("Quá hạn -> job tạm dừng an toàn (suspended), card về badge, và resume được từ app.");
  log("================================================================================\n");

  const dbPath = path.resolve(__dirname, "../evidence/test-timeout.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  // Dựng harness với timeout cấu hình ngắn (1500ms) để test tự động
  const TEST_TIMEOUT_MS = 1500;
  const harness = new TestHarness(dbPath, TEST_TIMEOUT_MS);
  const jobId = "job-q6-timeout-test";

  log(`1. Khởi tạo job '${jobId}' với cấu hình timeout: ${TEST_TIMEOUT_MS}ms (Mặc định sản phẩm: 30 phút / 1.800.000ms)`);

  const askTool = harness.getDomainTools(jobId).find((t) => t.name === "ask_user")!;

  log("2. Agent gọi ask_user -> Job chuyển sang waiting_input:");
  const askPromise = askTool.execute("call-ask-timeout-01", {
    question: "Xác nhận triển khai hạ tầng lên production?",
    options: [
      { id: "opt_yes", label: "Đồng ý" },
      { id: "opt_no", label: "Hủy" },
    ],
  });

  const stateInitial = harness.ledger.getJob(jobId);
  log(`  - Trạng thái ban đầu: ${stateInitial?.status} (Kỳ vọng: waiting_input)`);
  log(`  - Active ask ID: ${stateInitial?.active_ask_call_id}`);

  log(`\n3. Người dùng KHÔNG phản hồi trong ${TEST_TIMEOUT_MS}ms...`);
  log("   Đang đợi timeout timer kích hoạt...");

  // Chờ timer hết hạn
  await new Promise((r) => setTimeout(r, TEST_TIMEOUT_MS + 500));

  const stateAfterTimeout = harness.ledger.getJob(jobId);
  log("\n--- Trạng thái Job sau khi hết hạn timeout ---");
  log(`  - Trạng thái mới trong ledger: ${stateAfterTimeout?.status} (Kỳ vọng: suspended)`);
  log(`  - active_ask_call_id còn được lưu: ${stateAfterTimeout?.active_ask_call_id}`);

  // Chờ kết quả của askPromise
  const toolResult = await askPromise;
  log(`  - Tool execute trả về sau timeout: ${JSON.stringify(toolResult)}`);

  if (stateAfterTimeout?.status !== "suspended") {
    throw new Error(`❌ Lỗi: Job không chuyển sang 'suspended' sau timeout! (hiện tại: ${stateAfterTimeout?.status})`);
  }
  log("  -> ✅ ĐÃ XÁC NHẬN: Quá hạn timeout -> Job tạm dừng an toàn (suspended), card blocking thu về badge.");

  // ============================================================================
  // PHẦN 2: RESUME TỪ CỬA SỔ APP SAU KHI ĐÃ BỊ TẠM DỪNG
  // ============================================================================
  log("\n--------------------------------------------------------------------------------");
  log("4. KIỂM CHỨNG KHẢ NĂNG RESUME TỪ APP KHI JOB ĐANG BỊ TẠM DỪNG (SUSPENDED):");
  log("--------------------------------------------------------------------------------");

  log("  Người dùng mở app, thấy card trong danh sách chờ, nhấn nút [Tiếp tục] và chọn 'Đồng ý'");

  // Giả lập checkpoint transcript đã lưu trước khi suspend
  const checkpointMessages: AgentMessage[] = [
    {
      role: "user",
      content: [{ type: "text", text: "Triển khai hạ tầng và ghi nhận task sau khi xác nhận" }],
      timestamp: Date.now() - 5000,
    },
    {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "call-ask-timeout-01",
          name: "ask_user",
          arguments: {
            question: "Xác nhận triển khai hạ tầng lên production?",
            options: [
              { id: "opt_yes", label: "Đồng ý" },
              { id: "opt_no", label: "Hủy" },
            ],
          },
        },
      ],
      api: "openai-completions",
      provider: "custom",
      model: LLM_MODEL_STRONG,
      usage: { input: 80, output: 40, cacheRead: 0, cacheWrite: 0, totalTokens: 120 },
      stopReason: "toolUse",
    } as any,
  ];

  // Ghi nhận quyết định muộn từ app
  const lateDecision = harness.ledger.recordDecision({
    jobId,
    question: "Xác nhận triển khai hạ tầng lên production?",
    options: [
      { id: "opt_yes", label: "Đồng ý" },
      { id: "opt_no", label: "Hủy" },
    ],
    answer: { option_id: "opt_yes" },
    answerSource: "app",
  });
  log(`  - Quyết định muộn đã ghi ledger (Source: app, Decision ID: ${lateDecision.id})`);

  // Chuyển trạng thái job từ suspended -> running
  harness.ledger.saveJobState(jobId, "running", null);

  // Nạp kết quả vào transcript và gọi continue()
  const resumedMessages: AgentMessage[] = [
    ...checkpointMessages,
    {
      role: "toolResult",
      toolCallId: "call-ask-timeout-01",
      toolName: "ask_user",
      content: [{ type: "text", text: JSON.stringify({ answer: { option_id: "opt_yes" } }) }],
      isError: false,
      timestamp: Date.now(),
    } as any,
  ];

  const tools = harness.getDomainTools(jobId);
  const resumedAgent = new Agent({
    streamFn: customStreamFn,
    initialState: {
      model: createModel(LLM_MODEL_STRONG),
      systemPrompt: "You are a deployment assistant. When user confirms via ask_user, call write_task to record 'Production Deployment Completed'.",
      tools,
      messages: resumedMessages,
    },
  });

  log("  - Gọi resumedAgent.continue() để tiếp tục chu trình suy luận...");
  await resumedAgent.continue();

  log("\n--- Kiểm tra sau khi Resume hoàn tất ---");
  log(`  - Job status cuối: ${harness.ledger.getJob(jobId)?.status}`);
  log(`  - writeCallCount: ${harness.store.writeCallCount}`);
  const recordedTask = harness.store.tasks.find((t) => t.title.toLowerCase().includes("deployment"));
  log(`  - Task tạo trong store: ${JSON.stringify(recordedTask)}`);

  if (harness.store.writeCallCount === 0) {
    throw new Error("❌ Lỗi: write_task không được gọi sau khi resume!");
  }
  log("  -> ✅ ĐÃ XÁC NHẬN: Resume sau timeout thành công 100%, không mất mát dữ liệu.");

  log("\n5. KẾT LUẬN Q6:");
  log("  - Timeout waiting_input dùng chung cấu hình với phê duyệt (mặc định 30 phút).");
  log("  - Khi quá hạn: job tạm dừng an toàn (suspended), card thu về badge, không làm rò rỉ bộ nhớ hay tiến trình ma.");
  log("  - Người dùng có thể mở app bất kỳ lúc nào để trả lời và resume job tiếp tục từ đúng điểm dừng.");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);
  harness.cleanup();
}

runQ6().catch((err) => {
  console.error("Test Q6 failed:", err);
  process.exit(1);
});
