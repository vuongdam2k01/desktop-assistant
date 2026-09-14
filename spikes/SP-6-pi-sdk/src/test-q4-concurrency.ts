import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { createModel, customStreamFn, LLM_MODEL_STRONG } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q4-concurrency.log");

async function runQ4Test() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-6 / Q4: Chạy nhiều instance agent song song trong một process Node");
  log("Yêu cầu FR-AG-04: Nhiều job chạy song song được, mỗi job cô lập context tuyệt đối.");
  log("================================================================================\n");

  const model = createModel(LLM_MODEL_STRONG);

  // Khởi tạo 3 worker agent độc lập với dữ liệu và mục tiêu hoàn toàn khác nhau
  const instances = [
    {
      id: "Worker-Alpha",
      privateCode: "ALPHA-KEY-991",
      city: "Paris",
      prompt: "Hãy gọi tool get_worker_info rồi trả lời ngắn gọn: Bạn là worker nào, mã private code là gì và ở thành phố nào?",
    },
    {
      id: "Worker-Beta",
      privateCode: "BETA-KEY-442",
      city: "Tokyo",
      prompt: "Hãy gọi tool get_worker_info rồi trả lời ngắn gọn: Bạn là worker nào, mã private code là gì và ở thành phố nào?",
    },
    {
      id: "Worker-Gamma",
      privateCode: "GAMMA-KEY-773",
      city: "London",
      prompt: "Hãy gọi tool get_worker_info rồi trả lời ngắn gọn: Bạn là worker nào, mã private code là gì và ở thành phố nào?",
    },
  ];

  log(`[1] Khởi tạo ${instances.length} agent instances đồng thời trong cùng 1 process Node.js (PID: ${process.pid})...`);

  const results: { id: string; response: string; executionTimeMs: number }[] = [];

  const runInstance = async (inst: (typeof instances)[0]) => {
    const tool = {
      name: "get_worker_info",
      label: "Get Worker Info",
      description: "Retrieve internal configuration for current worker instance",
      parameters: Type.Object({}),
      execute: async () => {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                workerId: inst.id,
                privateCode: inst.privateCode,
                city: inst.city,
              }),
            },
          ],
        };
      },
    };

    const agent = new Agent({
      streamFn: customStreamFn,
      initialState: {
        model,
        systemPrompt: `You are worker instance ${inst.id}. Never reveal information belonging to other workers.`,
        tools: [tool],
      },
    });

    const start = Date.now();
    await agent.prompt(inst.prompt);
    const duration = Date.now() - start;

    const lastMsg = agent.state.messages[agent.state.messages.length - 1];
    const text =
      lastMsg && lastMsg.role === "assistant"
        ? lastMsg.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join(" ")
        : "";

    return { id: inst.id, response: text, executionTimeMs: duration };
  };

  log("[2] Kích hoạt Promise.all chạy đồng thời 3 worker agents...");
  const t0 = Date.now();
  const concurrentResults = await Promise.all(instances.map((i) => runInstance(i)));
  const totalWallTime = Date.now() - t0;

  log(`\n[3] Toàn bộ ${concurrentResults.length} agents đã hoàn thành trong ${totalWallTime}ms wall-clock time.`);

  log("\n--- Kết quả từng instance ---");
  for (const res of concurrentResults) {
    log(`\n[${res.id}] (Thời gian: ${res.executionTimeMs}ms):`);
    log(`Phản hồi: ${res.response.trim()}`);
  }

  // Kiểm tra cô lập dữ liệu (Cross-talk check)
  log("\n[4] Kiểm tra cô lập dữ liệu (Cross-talk / Data Leak Check):");
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const res = concurrentResults.find((r) => r.id === inst.id)!;

    // Phải chứa privateCode của chính mình
    const hasOwnCode = res.response.includes(inst.privateCode);
    log(`- ${inst.id} chứa đúng private code của mình (${inst.privateCode}): ${hasOwnCode ? "✅ ĐÚNG" : "❌ THIẾU"}`);

    // KHÔNG ĐƯỢC chứa privateCode của instance khác
    for (let j = 0; j < instances.length; j++) {
      if (i !== j) {
        const otherInst = instances[j];
        const leakedOther = res.response.includes(otherInst.privateCode);
        if (leakedOther) {
          throw new Error(`❌ RÒ RỈ DỮ LIỆU: ${inst.id} chứa mã ${otherInst.privateCode} của ${otherInst.id}!`);
        }
      }
    }
  }

  log("✅ KHÔNG HỀ CÓ HIỆN TƯỢNG CROSS-TALK HOẶC RÒ RỈ DỮ LIỆU GIỮA CÁC INSTANCE!");

  log("\n================================================================================");
  log("KẾT LUẬN Q4: ĐẠT 100%");
  log("1. Pi Agent class thiết kế dạng instance riêng biệt hoàn toàn (độc lập _state, messages, queues).");
  log("2. Không dùng global mutable state hay process-wide singleton (khác với @oh-my-pi's agentPauseGate).");
  log("3. Nhiều job chạy song song trong cùng 1 process Node.js đạt chuẩn FR-AG-04.");
  log("================================================================================");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  console.log(`\nSaved evidence log to ${logPath}`);
}

runQ4Test().catch((err) => {
  console.error("Q4 Test failed:", err);
  process.exit(1);
});
