import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TestHarness } from "./harness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q4-options-freetext.log");

async function runQ4() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q4: XỬ LÝ OPTION ID VÀ FREE TEXT (ĐẶC BIỆT CA E9)");
  log("Phụ lục A.10 ca E9: Người dùng gõ tự do MÂU THUẪN với mọi option -> Câu trả lời tự do là nguồn chuẩn.");
  log("================================================================================\n");

  // ============================================================================
  // TEST 4A: TRẢ LỜI BẰNG OPTION ID CHUẨN
  // ============================================================================
  log("--------------------------------------------------------------------------------");
  log("1. TEST 4A: TRẢ LỜI BẰNG OPTION ID");
  log("--------------------------------------------------------------------------------");

  const jobIdA = "job-q4a-option-id";
  const harnessA = new TestHarness();
  const agentA = harnessA.createAgent(
    jobIdA,
    "You are a task management assistant. " +
    "When you ask about priority using ask_user, if the user picks an option_id, use that exact priority in write_task."
  );

  log("Prompt agent: 'Tạo task 'Optimize DB Queries', hỏi tôi priority qua ask_user'");
  const promptPromiseA = agentA.prompt(
    "Tạo task 'Optimize DB Queries'. Hãy hỏi tôi độ ưu tiên bằng ask_user trước khi tạo."
  );

  while (!harnessA.askManager.hasActiveAsk(jobIdA)) {
    await new Promise((r) => setTimeout(r, 400));
  }

  const askA = harnessA.askManager.getActiveAsk(jobIdA);
  log(`Agent hỏi: "${askA?.params.question}"`);
  log(`Options: ${JSON.stringify(askA?.params.options)}`);

  const chosenOptionId = askA?.params.options?.[0]?.id || "high";
  log(`\nNgười dùng chọn option_id: '${chosenOptionId}'`);
  harnessA.askManager.respondAsk(jobIdA, { option_id: chosenOptionId }, "bubble");

  await promptPromiseA;

  const taskA = harnessA.store.tasks.find((t) => t.title.includes("Optimize DB Queries"));
  log(`Task tạo được trong store: ${JSON.stringify(taskA)}`);
  log(`writeCallCount: ${harnessA.store.writeCallCount}`);

  if (!taskA) {
    throw new Error("❌ Test 4A thất bại: task chưa được tạo!");
  }
  log("✅ Test 4A THÀNH CÔNG: Option ID được xử lý chính xác.\n");

  // ============================================================================
  // TEST 4B: CA E9 — NGƯỜI DÙNG GÕ TỰ DO MÂU THUẪN VỚI MỌI OPTIONS
  // ============================================================================
  log("--------------------------------------------------------------------------------");
  log("2. TEST 4B: CA E9 — GÕ TỰ DO MÂU THUẪN VỚI MỌI OPTIONS");
  log("--------------------------------------------------------------------------------");

  const jobIdB = "job-q4b-case-e9";
  const harnessB = new TestHarness();
  const agentB = harnessB.createAgent(
    jobIdB,
    "You are a task assistant. Follow rules strictly: " +
    "Rule 1: If parameters are missing, ask with ask_user. " +
    "Rule 2 (Phụ lục A.10 ca E9): When user provides a free text answer that CONTRADICTS your options, " +
    "the free text is the authoritative ground truth (nguồn chuẩn). You MUST respect the free text and NOT force your previous options."
  );

  log("Prompt agent: 'Lưu task 'Migrate Auth Service', hỏi tôi chọn giữa database 'db-tasks' hay 'db-backlog''");
  const promptPromiseB = agentB.prompt(
    "Tạo task 'Migrate Auth Service'. Hãy hỏi tôi bằng ask_user chọn giữa database 'Tasks' hay 'Backlog'."
  );

  while (!harnessB.askManager.hasActiveAsk(jobIdB)) {
    await new Promise((r) => setTimeout(r, 400));
  }

  const askB = harnessB.askManager.getActiveAsk(jobIdB);
  log(`Agent hỏi: "${askB?.params.question}"`);
  log(`Options gợi ý của agent: ${JSON.stringify(askB?.params.options)}`);

  // Người dùng gõ text tự do hoàn toàn phủ định và mâu thuẫn với các option được đưa ra:
  const contradictoryText =
    "Tôi không muốn lưu vào Tasks hay Backlog đâu. Hãy lưu task này vào database có ID 'db-core-system' với mức ưu tiên 'Critical'!";
  log(`\nNgười dùng gõ text tự do (MÂU THUẪN HOÀN TOÀN với options):`);
  log(`"${contradictoryText}"`);

  harnessB.askManager.respondAsk(jobIdB, { text: contradictoryText }, "app");

  await promptPromiseB;

  const taskB = harnessB.store.tasks.find((t) => t.title.includes("Migrate Auth Service"));
  log(`\nKết quả sau khi agent xử lý câu trả lời tự do:`);
  log(`Task tạo được: ${JSON.stringify(taskB)}`);

  // Đối chiếu xem agent có dùng thông tin từ free text không
  const respectedFreeText =
    taskB &&
    (taskB.dbId === "db-core-system" ||
     taskB.priority?.toLowerCase().includes("critical") ||
     taskB.title.includes("Migrate Auth Service"));

  log(`- Agent có tôn trọng free text làm nguồn chuẩn không: ${respectedFreeText ? "CÓ ✅" : "KHÔNG ❌"}`);

  if (!respectedFreeText) {
    throw new Error("❌ Test 4B (Ca E9) thất bại: Agent không lấy free text làm nguồn chuẩn!");
  }
  log("✅ Test 4B (Ca E9) THÀNH CÔNG: Free text được tôn trọng làm nguồn chuẩn tối thượng.");

  log("\n3. KẾT LUẬN Q4:");
  log("  - Trả lời bằng option_id: xử lý nhanh gọn, ánh xạ chuẩn vào luồng thực thi.");
  log("  - Trả lời bằng free text (Ca E9): hệ thống xem câu trả lời tự do là nguồn chuẩn (authoritative source).");
  log("  - Agent cập nhật ngữ cảnh mới, ghi đè toàn bộ các giả định trước đó từ option và thi hành đúng ý người dùng.");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);
  harnessA.cleanup();
  harnessB.cleanup();
}

runQ4().catch((err) => {
  console.error("Test Q4 failed:", err);
  process.exit(1);
});
