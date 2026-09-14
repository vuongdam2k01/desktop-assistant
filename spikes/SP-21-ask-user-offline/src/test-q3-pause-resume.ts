import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { TestHarness } from "./harness.js";
import { createModel, customStreamFn, LLM_MODEL_STRONG } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q3-pause-resume.log");

async function runQ3() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q3: KIỂM CHỨNG CHUYỂN waiting_input VÀ RESUME ĐÚNG ĐIỂM DỪNG");
  log("Tiêu chuẩn cấm US-4.2/AC2: Tuyệt đối KHÔNG chạy lại bước đã xong.");
  log("================================================================================\n");

  // ============================================================================
  // CHẾ ĐỘ 1: IN-FLIGHT ASYNC SUSPENSION VÀ RESUME
  // ============================================================================
  log("--------------------------------------------------------------------------------");
  log("[CHẾ ĐỘ 1] IN-FLIGHT ASYNC SUSPENSION & RESUME (Phục vụ UI Card / Ô thoại)");
  log("--------------------------------------------------------------------------------");

  const jobId1 = "job-q3-inflight";
  const harness1 = new TestHarness();
  const agent1 = harness1.createAgent(
    jobId1,
    "You are a task management agent. " +
    "Step 1: Always call read_tasks to inspect existing tasks. " +
    "Step 2: If the user did not give a priority for the new task 'Prepare Q4 OKRs', you MUST call ask_user to ask for priority. " +
    "Step 3: After getting the answer from ask_user, call write_task to create the task with that priority."
  );

  log("\n1. Bắt đầu prompt agent:");
  log("   'Hãy đọc danh sách task (read_tasks), rồi hỏi tôi độ ưu tiên qua ask_user, sau đó tạo task 'Prepare Q4 OKRs''");

  const promptPromise1 = agent1.prompt(
    "Trước tiên hãy đọc danh sách task bằng read_tasks. Sau đó hỏi tôi độ ưu tiên bằng ask_user, rồi tạo task 'Prepare Q4 OKRs' với độ ưu tiên đó."
  );

  // Chờ cho đến khi read_tasks hoàn tất và agent rơi vào waiting_input
  log("2. Chờ agent thực thi Bước 1 (read_tasks) và rơi vào trạng thái waiting_input...");
  while (!harness1.askManager.hasActiveAsk(jobId1)) {
    await new Promise((r) => setTimeout(r, 400));
  }

  const jobStateAtPause = harness1.ledger.getJob(jobId1);
  log("\n--- Trạng thái tại thời điểm agent đang tạm dừng (PAUSE POINT) ---");
  log(`- Job status trong ledger: ${jobStateAtPause?.status} (Kỳ vọng: waiting_input)`);
  log(`- readCallCount (Bước 1): ${harness1.store.readCallCount} (Đã chạy xong)`);
  log(`- writeCallCount (Bước 3): ${harness1.store.writeCallCount} (Chưa chạy, đang chờ câu trả lời)`);
  log(`- Active ask question: "${harness1.askManager.getActiveAsk(jobId1)?.params.question}"`);

  if (harness1.store.readCallCount !== 1 || harness1.store.writeCallCount !== 0) {
    throw new Error("❌ Lỗi: Trạng thái bước thực thi tại điểm dừng không chuẩn xác!");
  }
  if (jobStateAtPause?.status !== "waiting_input") {
    throw new Error(`❌ Lỗi: Trạng thái job không phải waiting_input (hiện tại: ${jobStateAtPause?.status})`);
  }
  log("  -> ✅ Đã xác nhận: Job chuyển waiting_input đúng điểm dừng.");

  log("\n3. Người dùng nhập câu trả lời: option_id: 'high' (Độ ưu tiên Cao)");
  harness1.askManager.respondAsk(jobId1, { option_id: "high" }, "bubble");

  log("4. Chờ agent tiếp tục và hoàn tất...");
  await promptPromise1;

  log("\n--- Trạng thái sau khi Resume hoàn tất ---");
  log(`- readCallCount (Bước 1): ${harness1.store.readCallCount} (Kỳ vọng = 1, TUYỆT ĐỐI KHÔNG lặp lại)`);
  log(`- writeCallCount (Bước 3): ${harness1.store.writeCallCount} (Kỳ vọng = 1, đã tạo task)`);

  const createdTask = harness1.store.tasks.find((t) => t.title.includes("Prepare Q4 OKRs"));
  log(`- Task vừa được tạo trong store: ${JSON.stringify(createdTask)}`);

  if (harness1.store.readCallCount !== 1) {
    throw new Error(`❌ VI PHẠM US-4.2/AC2: read_tasks bị chạy lại! count = ${harness1.store.readCallCount}`);
  }
  if (harness1.store.writeCallCount !== 1) {
    throw new Error(`❌ Lỗi: write_task chưa được gọi sau resume! count = ${harness1.store.writeCallCount}`);
  }
  log("  -> ✅ CHẾ ĐỘ 1 THÀNH CÔNG: Resume đúng điểm dừng, ngữ cảnh câu trả lời được nạp chuẩn, 0 lặp bước.");

  // ============================================================================
  // CHẾ ĐỘ 2: COLD CHECKPOINT RESTART QUA continue()
  // (Mô phỏng app tắt giữa chừng khi đang waiting_input, nạp lại từ SQLite và resume)
  // ============================================================================
  log("\n--------------------------------------------------------------------------------");
  log("[CHẾ ĐỘ 2] COLD CHECKPOINT PERSISTENCE & RESUME (Phục vụ Crash / App Restart)");
  log("--------------------------------------------------------------------------------");

  const jobId2 = "job-q3-cold-restart";
  const harness2 = new TestHarness();
  const readTool2 = harness2.getDomainTools(jobId2).find((t) => t.name === "read_tasks")!;
  const writeTool2 = harness2.getDomainTools(jobId2).find((t) => t.name === "write_task")!;
  const askTool2 = harness2.getDomainTools(jobId2).find((t) => t.name === "ask_user")!;

  log("1. Dựng checkpoint session bị gián đoạn đã lưu trong SQLite:");
  log("   - Lượt 1: User prompt 'Đọc tasks rồi hỏi tôi priority để tạo task 'Audit Security''");
  log("   - Lượt 2: Assistant gọi read_tasks và ask_user");
  log("   - Lượt 3: ToolResult của read_tasks đã có, ask_user đang waiting_input thì app bị tắt.");

  const callReadId = "call-read-cold-001";
  const callAskId = "call-ask-cold-002";

  const checkpointMessages: AgentMessage[] = [
    {
      role: "user",
      content: [{ type: "text", text: "Đọc danh sách task, sau đó hỏi tôi priority qua ask_user để tạo task 'Audit Security'" }],
      timestamp: Date.now() - 15000,
    },
    {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: callReadId,
          name: "read_tasks",
          arguments: {},
        },
        {
          type: "toolCall",
          id: callAskId,
          name: "ask_user",
          arguments: {
            question: "Chọn mức độ ưu tiên cho task 'Audit Security':",
            options: [
              { id: "urgent", label: "Khẩn cấp" },
              { id: "normal", label: "Bình thường" },
            ],
          },
        },
      ],
      api: "openai-completions",
      provider: "custom",
      model: LLM_MODEL_STRONG,
      usage: { input: 90, output: 45, cacheRead: 0, cacheWrite: 0, totalTokens: 135 },
      stopReason: "toolUse",
    } as any,
    {
      role: "toolResult",
      toolCallId: callReadId,
      toolName: "read_tasks",
      content: [{ type: "text", text: JSON.stringify(harness2.store.tasks) }],
      isError: false,
      timestamp: Date.now() - 10000,
    } as any,
  ];

  log(`   -> Checkpoint messages count: ${checkpointMessages.length}`);
  log("2. Người dùng mở app và trả lời câu hỏi: option_id = 'urgent' (Khẩn cấp)");

  // Ghi nhận quyết định vào ledger
  harness2.ledger.recordDecision({
    jobId: jobId2,
    question: "Chọn mức độ ưu tiên cho task 'Audit Security':",
    options: [
      { id: "urgent", label: "Khẩn cấp" },
      { id: "normal", label: "Bình thường" },
    ],
    answer: { option_id: "urgent" },
    answerSource: "app",
  });

  // Nạp ToolResult của ask_user vào transcript
  const resumedMessages: AgentMessage[] = [
    ...checkpointMessages,
    {
      role: "toolResult",
      toolCallId: callAskId,
      toolName: "ask_user",
      content: [{ type: "text", text: JSON.stringify({ answer: { option_id: "urgent" } }) }],
      isError: false,
      timestamp: Date.now(),
    } as any,
  ];

  log(`3. Khởi tạo instance Agent MỚI hoàn toàn từ checkpoint (${resumedMessages.length} messages)`);
  const coldAgent = new Agent({
    streamFn: customStreamFn,
    initialState: {
      model: createModel(LLM_MODEL_STRONG),
      systemPrompt: "You are a task management assistant. Use the answer from ask_user to create the task with write_task.",
      tools: [readTool2, writeTool2, askTool2],
      messages: resumedMessages,
    },
  });

  log("4. Gọi coldAgent.continue() để tiếp tục chu trình suy luận...");
  const tStart = Date.now();
  await coldAgent.continue();
  const tDuration = Date.now() - tStart;
  log(`   -> coldAgent.continue() hoàn tất trong ${tDuration}ms!`);

  log("\n--- Kiểm tra sau khi Cold Resume hoàn tất ---");
  log(`- readCallCount phiên mới: ${harness2.store.readCallCount} (Kỳ vọng = 0, hoàn toàn không gọi lại)`);
  log(`- writeCallCount: ${harness2.store.writeCallCount} (Kỳ vọng = 1)`);

  const coldCreatedTask = harness2.store.tasks.find((t) => t.title.includes("Audit Security"));
  log(`- Task được tạo: ${JSON.stringify(coldCreatedTask)}`);

  if (harness2.store.readCallCount !== 0) {
    throw new Error(`❌ VI PHẠM US-4.2/AC2: read_tasks bị chạy lại trong cold resume!`);
  }
  if (harness2.store.writeCallCount !== 1) {
    throw new Error(`❌ Lỗi: write_task chưa được gọi!`);
  }
  log("  -> ✅ CHẾ ĐỘ 2 THÀNH CÔNG: Khôi phục sạch từ checkpoint, không lặp lại bước cũ.");

  log("\n5. KẾT LUẬN Q3:");
  log("  - Job chuyển trạng thái waiting_input chuẩn xác khi ask_user được gọi.");
  log("  - Resume diễn ra ĐÚNG ĐIỂM DỪNG với câu trả lời làm ngữ cảnh.");
  log("  - Tuân thủ tuyệt đối US-4.2/AC2: Không có bất kỳ bước nào đã xong bị chạy lại (cả in-flight và cold restart).");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);
  harness1.cleanup();
  harness2.cleanup();
}

runQ3().catch((err) => {
  console.error("Test Q3 failed:", err);
  process.exit(1);
});
