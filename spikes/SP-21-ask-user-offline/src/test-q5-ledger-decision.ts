import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TestHarness } from "./harness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q5-ledger-decision.log");

async function runQ5() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q5: KIỂM CHỨNG BẢN GHI LEDGER LOẠI 'decision' (Phụ lục A.5 mục 4)");
  log("Yêu cầu: Bản ghi decision chứa: question, options, câu trả lời, nguồn trả lời, thời điểm.");
  log("================================================================================\n");

  const dbPath = path.resolve(__dirname, "../evidence/test-ledger.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const harness = new TestHarness(dbPath);

  // 1. Tạo bản ghi Decision 1 từ ô thoại (bubble)
  log("1. TẠO BẢN GHI DECISION 1 TỪ BUBBLE (Ô THOẠI):");
  const jobId1 = "job-decision-bubble";
  const ask1Promise = harness.askManager.registerAsk(jobId1, "call-ask-001", {
    question: "Bạn muốn assign task cho ai?",
    options: [
      { id: "u_linh", label: "Linh Nguyen", description: "Tech Lead" },
      { id: "u_nam", label: "Nam Tran", description: "Backend Dev" },
    ],
    allow_free_text: true,
  });

  log("  - Người dùng bấm chọn option 'Linh Nguyen' trên ô thoại (bubble)");
  const decision1 = harness.askManager.respondAsk(
    jobId1,
    { option_id: "u_linh" },
    "bubble"
  );
  await ask1Promise;

  log(`  - Decision 1 ID: ${decision1.id}`);
  log(`  - Job ID: ${decision1.jobId}`);
  log(`  - Question: "${decision1.question}"`);
  log(`  - Options: ${JSON.stringify(decision1.options)}`);
  log(`  - Answer: ${JSON.stringify(decision1.answer)}`);
  log(`  - Answer Source: "${decision1.answerSource}"`);
  log(`  - Created At (Thời điểm): "${decision1.createdAt}"`);

  // 2. Tạo bản ghi Decision 2 từ cửa sổ app (app)
  log("\n2. TẠO BẢN GHI DECISION 2 TỪ APP WINDOW (CỬA SỔ APP):");
  const jobId2 = "job-decision-app";
  const ask2Promise = harness.askManager.registerAsk(jobId2, "call-ask-002", {
    question: "Xác nhận thời hạn hoàn thành sprint:",
    options: [
      { id: "opt_fri", label: "Thứ Sáu 17h" },
      { id: "opt_mon", label: "Thứ Hai tuần sau" },
    ],
    allow_free_text: true,
  });

  log("  - Người dùng gõ text tự do trên cửa sổ App: 'Hoãn sang Thứ Ba vì vướng release'");
  const decision2 = harness.askManager.respondAsk(
    jobId2,
    { text: "Hoãn sang Thứ Ba vì vướng release" },
    "app"
  );
  await ask2Promise;

  log(`  - Decision 2 ID: ${decision2.id}`);
  log(`  - Job ID: ${decision2.jobId}`);
  log(`  - Question: "${decision2.question}"`);
  log(`  - Options: ${JSON.stringify(decision2.options)}`);
  log(`  - Answer: ${JSON.stringify(decision2.answer)}`);
  log(`  - Answer Source: "${decision2.answerSource}"`);
  log(`  - Created At (Thời điểm): "${decision2.createdAt}"`);

  // 3. Kiểm tra tính toàn vẹn trong cơ sở dữ liệu SQLite
  log("\n3. TRUY VẤN VÀ ĐỐI CHIẾU TRỰC TIẾP TỪ SQLITE:");
  const decisions = harness.ledger.getDecisionsForJob(jobId1);
  log(`  - Số lượng bản ghi decision của job 1: ${decisions.length}`);
  const d1 = decisions[0];

  const checks = [
    { field: "question", valid: d1.question === "Bạn muốn assign task cho ai?" },
    { field: "options", valid: Array.isArray(d1.options) && d1.options.length === 2 },
    { field: "answer", valid: d1.answer?.option_id === "u_linh" },
    { field: "answer_source", valid: d1.answerSource === "bubble" },
    { field: "created_at (thời điểm)", valid: !isNaN(Date.parse(d1.createdAt)) },
  ];

  for (const c of checks) {
    log(`  - Trường '${c.field}': ${c.valid ? "ĐẦY ĐỦ VÀ CHÍNH XÁC ✅" : "THIẾU / SAI ❌"}`);
    if (!c.valid) throw new Error(`Trường ${c.field} không hợp lệ trong ledger!`);
  }

  // 4. Kiểm tra tính append-only (FR-LG-02)
  log("\n4. KIỂM TRA BẢO VỆ APPEND-ONLY (TRIGGER CHẶN UPDATE/DELETE TRÊN BẢN GHI DECISION):");
  const rawDb = (harness.ledger as any).db;

  let updateBlocked = false;
  try {
    rawDb.prepare("UPDATE decisions SET question = 'Fake Question' WHERE id = ?").run(decision1.id);
  } catch (err: any) {
    if (err.message.includes("APPEND_ONLY_VIOLATION")) {
      updateBlocked = true;
      log(`  - UPDATE bị chặn: ${err.message} -> PASS ✅`);
    }
  }

  let deleteBlocked = false;
  try {
    rawDb.prepare("DELETE FROM decisions WHERE id = ?").run(decision1.id);
  } catch (err: any) {
    if (err.message.includes("APPEND_ONLY_VIOLATION")) {
      deleteBlocked = true;
      log(`  - DELETE bị chặn: ${err.message} -> PASS ✅`);
    }
  }

  if (!updateBlocked || !deleteBlocked) {
    throw new Error("❌ VI PHẠM: Bản ghi decision không được bảo vệ append-only!");
  }

  log("\n5. KẾT LUẬN Q5:");
  log("  - Bản ghi loại 'decision' ghi nhận đầy đủ 5/5 trường bắt buộc theo Phụ lục A.5 mục 4:");
  log("    1. question (chuỗi câu hỏi gộp)");
  log("    2. options (danh sách 0-4 lựa chọn kèm label/desc)");
  log("    3. câu trả lời (option_id hoặc text)");
  log("    4. nguồn trả lời ('bubble' từ ô thoại pet hoặc 'app' từ cửa sổ chính)");
  log("    5. thời điểm (timestamp ISO 8601)");
  log("  - Bản ghi được bảo vệ bởi trigger append-only SQLite, không thể bị sửa/xoá.");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);
  harness.cleanup();
}

runQ5().catch((err) => {
  console.error("Test Q5 failed:", err);
  process.exit(1);
});
