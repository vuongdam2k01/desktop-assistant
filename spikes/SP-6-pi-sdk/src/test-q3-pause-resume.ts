import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { createModel, customStreamFn, LLM_MODEL_STRONG } from "./client.js";
import { DummyEnvironment, createReadTool, createWriteTool, createWrappedTool } from "./dummy-tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q3-pause-resume.log");

async function runQ3Test() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-6 / Q3: 🔴 KIỂM CHỨNG PAUSE / RESUME ĐÚNG ĐIỂM DỪNG (US-4.2 / AC2)");
  log("Yêu cầu cứng: Khi Approve, job tiếp tục từ đúng điểm dừng, KHÔNG chạy lại bước đã xong.");
  log("================================================================================\n");

  const env = new DummyEnvironment();
  const model = createModel(LLM_MODEL_STRONG);

  // ============================================================================
  // CHẾ ĐỘ 1: IN-FLIGHT ASYNC PAUSE & RESUME (Tiến trình đang chạy, chờ người dùng bấm duyệt)
  // ============================================================================
  log("--------------------------------------------------------------------------------");
  log("[CHẾ ĐỘ 1] IN-FLIGHT ASYNC SUSPENSION & RESUME (Phục vụ UI Card / Approval Gate)");
  log("--------------------------------------------------------------------------------");

  let resolveApprovalPromise: (approved: boolean) => void = () => {};
  const approvalPromise = new Promise<boolean>((resolve) => {
    resolveApprovalPromise = resolve;
  });

  const readTool1 = createWrappedTool(createReadTool(env), env.ledger);

  // Tool ghi có tích hợp cổng phê duyệt bất đồng bộ
  const writeToolWithAsyncGate = {
    name: "write_data",
    label: "Write Task Data",
    description: "Create or update a task in the database",
    parameters: createWriteTool(env).parameters,
    execute: async (_toolCallId: string, params: any) => {
      log(`  [Approval Gate] Gặp thao tác ghi '${params.title}'. Treo tiến trình chờ người dùng duyệt...`);
      const approved = await approvalPromise;
      log(`  [Approval Gate] Nhận được quyết định người dùng: ${approved ? "APPROVED ✅" : "DENIED ❌"}`);
      if (!approved) {
        return {
          content: [{ type: "text" as const, text: "Thao tác bị người dùng từ chối." }],
          isError: true,
        };
      }
      env.writeCallCount++;
      const newItem = { id: `task-${env.items.length + 1}`, title: params.title, status: "Todo" };
      env.items.push(newItem);
      return {
        content: [{ type: "text" as const, text: `Created item: ${JSON.stringify(newItem)}` }],
        details: { item: newItem },
      };
    },
  };

  const agent1 = new Agent({
    streamFn: customStreamFn,
    initialState: {
      model,
      systemPrompt: "You are a task management agent. Follow instructions step by step.",
      tools: [readTool1, writeToolWithAsyncGate],
    },
  });

  log("\n1. Bắt đầu prompt agent: 'Đọc task trước (read_data), rồi thêm task mới (write_data) Setup CI-CD.'");
  const promptPromise1 = agent1.prompt(
    "Trước tiên hãy đọc danh sách task bằng read_data. Sau đó thêm một task mới bằng write_data có title: 'Setup CI-CD'. Cuối cùng tổng kết ngắn gọn."
  );

  // Chờ cho đến khi read_data chạy xong và agent dừng lại ở cổng phê duyệt của write_data
  log("2. Chờ agent thực thi xong Bước 1 (read_data) và rơi vào trạng thái waiting_approval...");
  while (env.readCallCount === 0) {
    await new Promise((r) => setTimeout(r, 400));
  }
  // Chờ thêm 1.5s để đảm bảo write_data đã chạm vào approvalPromise
  await new Promise((r) => setTimeout(r, 1500));

  log("\n--- Trạng thái tại thời điểm agent đang tạm dừng (PAUSE POINT) ---");
  log(`- readCallCount (Bước 1): ${env.readCallCount} (Đã chạy xong)`);
  log(`- writeCallCount (Bước 2): ${env.writeCallCount} (Chưa chạy, đang treo chờ duyệt)`);

  if (env.readCallCount !== 1 || env.writeCallCount !== 0) {
    throw new Error("Lỗi: Trạng thái tại điểm dừng không chính xác!");
  }

  log("\n3. Người dùng bấm [APPROVE] trên giao diện!");
  resolveApprovalPromise(true);

  log("4. Chờ agent tiếp tục và hoàn tất...");
  await promptPromise1;

  log("\n--- Kiểm tra sau khi Resume hoàn tất ---");
  log(`- readCallCount (Bước 1): ${env.readCallCount} (Kỳ vọng = 1, KHÔNG chạy lại)`);
  log(`- writeCallCount (Bước 2): ${env.writeCallCount} (Kỳ vọng = 1, chỉ chạy 1 lần sau khi duyệt)`);

  const lastMsg1 = agent1.state.messages[agent1.state.messages.length - 1];
  const responseText1 =
    lastMsg1 && lastMsg1.role === "assistant"
      ? lastMsg1.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ")
      : "";
  log(`- Phản hồi tổng kết của agent:\n  "${responseText1.trim()}"`);

  if (env.readCallCount !== 1) {
    throw new Error(`❌ VI PHẠM US-4.2/AC2: read_data bị chạy lại! count = ${env.readCallCount}`);
  }
  if (env.writeCallCount !== 1) {
    throw new Error(`❌ LỖI: write_data count = ${env.writeCallCount}`);
  }
  log("✅ CHẾ ĐỘ 1 THÀNH CÔNG: Treo đúng điểm dừng, resume trơn tru, tuyệt đối không chạy lại bước 1.");

  // ============================================================================
  // CHẾ ĐỘ 2: COLD CHECKPOINT RESTART & RESUME QUA continue()
  // (Mô phỏng app bị tắt, crash, hoặc resume sau nhiều ngày từ SQLite checkpoint)
  // ============================================================================
  log("\n--------------------------------------------------------------------------------");
  log("[CHẾ ĐỘ 2] COLD CHECKPOINT PERSISTENCE & RESUME (Phục vụ Crash Recovery / Session Restore)");
  log("--------------------------------------------------------------------------------");

  const env2 = new DummyEnvironment();
  const readTool2 = createWrappedTool(createReadTool(env2), env2.ledger);
  const writeTool2 = createWrappedTool(createWriteTool(env2), env2.ledger);

  log("\n1. Giả lập một session bị gián đoạn đã lưu vào Persistent Storage (SQLite):");
  log("   - Lượt 1: User prompt 'Read tasks then create task Deploy Staging'");
  log("   - Lượt 2: Assistant gọi 2 tool: call-step-1 (read_data) và call-step-2 (write_data)");
  log("   - Lượt 3: ToolResult của call-step-1 đã hoàn thành (read_data)");
  log("   - call-step-2 (write_data) rơi vào trạng thái waiting_approval thì app bị tắt.");

  const callStep1Id = "call-read-991";
  const callStep2Id = "call-write-992";

  // Checkpoint được lưu trong DB trước khi app tắt
  const checkpointBeforeApproval: AgentMessage[] = [
    {
      role: "user",
      content: [{ type: "text", text: "Read tasks then create task 'Deploy Staging'" }],
      timestamp: Date.now() - 10000,
    },
    {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: callStep1Id,
          name: "read_data",
          arguments: {},
        },
        {
          type: "toolCall",
          id: callStep2Id,
          name: "write_data",
          arguments: { title: "Deploy Staging" },
        },
      ],
      api: "openai-completions",
      provider: "custom",
      model: LLM_MODEL_STRONG,
      usage: { input: 80, output: 40, cacheRead: 0, cacheWrite: 0, totalTokens: 120 },
      stopReason: "toolUse",
    } as any,
    {
      role: "toolResult",
      toolCallId: callStep1Id,
      toolName: "read_data",
      content: [{ type: "text", text: JSON.stringify(env2.items) }],
      isError: false,
      timestamp: Date.now() - 8000,
    } as any,
  ];

  log(`   -> Checkpoint hiện có ${checkpointBeforeApproval.length} tin nhắn.`);

  log("\n2. Người dùng mở lại app và bấm [APPROVE] cho thao tác write_data:");
  log("   - Thực thi thao tác write_data đã duyệt");
  const approvedResult = await writeTool2.execute(callStep2Id, { title: "Deploy Staging" });
  log(`   - Kết quả thực thi write_data: ${JSON.stringify(approvedResult.content)}`);
  log(`   - writeCallCount của env2 = ${env2.writeCallCount}`);

  // Nạp kết quả đã duyệt vào transcript, hoàn tất cặp toolCall - toolResult
  const resumedMessages: AgentMessage[] = [
    ...checkpointBeforeApproval,
    {
      role: "toolResult",
      toolCallId: callStep2Id,
      toolName: "write_data",
      content: approvedResult.content,
      isError: false,
      timestamp: Date.now(),
    } as any,
  ];

  log(`\n3. Khởi tạo instance Agent MỚI hoàn toàn từ resumedMessages (${resumedMessages.length} tin nhắn)`);
  log(`   Tin nhắn cuối cùng là: role='${resumedMessages[resumedMessages.length - 1].role}'`);

  const coldResumedAgent = new Agent({
    streamFn: customStreamFn,
    initialState: {
      model,
      systemPrompt: "You are an assistant. Step 1: read tasks. Step 2: create task.",
      tools: [readTool2, writeTool2],
      messages: resumedMessages,
    },
  });

  log("4. Gọi coldResumedAgent.continue() để tiếp tục chu trình suy luận...");
  const tStart = Date.now();
  await coldResumedAgent.continue();
  const tContinue = Date.now() - tStart;

  log(`   -> coldResumedAgent.continue() hoàn thành thành công trong ${tContinue}ms!`);

  const finalMsg2 = coldResumedAgent.state.messages[coldResumedAgent.state.messages.length - 1];
  const responseText2 =
    finalMsg2 && finalMsg2.role === "assistant"
      ? finalMsg2.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ")
      : "";
  log(`- Phản hồi của cold resumed agent:\n  "${responseText2.trim()}"`);

  log("\n--- Kiểm chứng tiêu chí US-4.2 / AC2 trên Cold Restart ---");
  log(`- readCallCount của env2: ${env2.readCallCount} (Kỳ vọng = 0, vì bước 1 đã hoàn thành từ phiên trước)`);
  log(`- writeCallCount của env2: ${env2.writeCallCount} (Kỳ vọng = 1, chỉ chạy 1 lần sau khi duyệt)`);

  if (env2.readCallCount !== 0) {
    throw new Error(`❌ VI PHẠM US-4.2/AC2: read_data bị chạy lại trong cold resume! count = ${env2.readCallCount}`);
  }
  if (env2.writeCallCount !== 1) {
    throw new Error(`❌ LỖI: write_data count = ${env2.writeCallCount}`);
  }
  log("✅ CHẾ ĐỘ 2 THÀNH CÔNG: Cold restart nạp lại checkpoint và resume qua continue() hoàn hảo!");

  log("\n================================================================================");
  log("KẾT LUẬN CHÍNH THỨC Q3: ĐẠT 100% (ĐÁP ỨNG TUYỆT ĐỐI US-4.2 / AC2)");
  log("1. Trong bộ nhớ (In-flight): Tool wrapper treo async Promise, app giữ nguyên trạng thái, duyệt là chạy tiếp.");
  log("2. Khôi phục bền vững (Cold Restart): Checkpoint lưu cặp assistant(toolCalls) -> toolResult,");
  log("   tiếp tục bằng Agent.continue() mà không chạy lại bất kỳ bước nào đã xong.");
  log("================================================================================");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  console.log(`\nSaved evidence log to ${logPath}`);
}

runQ3Test().catch((err) => {
  console.error("Q3 Test failed:", err);
  process.exit(1);
});
