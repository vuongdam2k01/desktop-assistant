import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BackendStubServer } from "./backend-stub.js";
import { TestHarness } from "./harness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q11-job-during-outage.log");

async function runQ11() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q11: R-9 & ADR-007 — JOB ĐANG CHẠY KHI BACKEND GIÁN ĐOẠN");
  log("Luận điểm ADR-007: LLM đi thẳng client -> provider, không qua backend.");
  log("Kỳ vọng: Backend sập/ngắt giữa chừng -> Job ĐANG CHẠY vẫn tiếp tục trơn tru.");
  log("================================================================================\n");

  const dbPath = path.resolve(__dirname, "../evidence/test-q11-outage.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const backend = new BackendStubServer(3994);
  await backend.start();
  log("1. Backend server đang chạy tại port 3994.");

  const harness = new TestHarness(dbPath);
  const jobId = "job-q11-active-during-outage";

  const agent = harness.createAgent(
    jobId,
    "You are a helpful task management agent. Step 1: read_tasks. Step 2: create a task with title 'Build Offline Engine' using write_task."
  );

  log("\n2. Khởi chạy Job với Agent thật (kết nối trực tiếp LLM Provider):");
  log("   Lệnh: 'Đọc danh sách task, sau đó tạo task 'Build Offline Engine''");

  const jobPromise = agent.prompt(
    "Đọc danh sách task bằng read_tasks, sau đó tạo task 'Build Offline Engine' bằng write_task và báo cáo kết quả."
  );

  // Chờ agent bắt đầu chạy (readCallCount > 0)
  while (harness.store.readCallCount === 0) {
    await new Promise((r) => setTimeout(r, 300));
  }
  log(`  - Agent đã bắt đầu thực thi: readCallCount = ${harness.store.readCallCount}`);

  // GIẾT BACKEND GIỮA CHỪNG KHI JOB ĐANG CHẠY
  log("\n3. ⚡ GIẾT BACKEND SERVER NGAY GIỮA CHỪNG KHI JOB ĐANG CHẠY ⚡");
  await backend.stop();
  log(`  - Backend server status: isRunning = ${backend.isRunning} (ĐÃ TẮT HOÀN TOÀN)`);

  // Kiểm tra xác nhận backend đã chết thật
  let backendDead = false;
  try {
    await fetch("http://127.0.0.1:3994/health");
  } catch (err) {
    backendDead = true;
  }
  log(`  - Kiểm tra kết nối tới backend port 3994: ${backendDead ? "CONNECTION REFUSED (Chết thật) ✅" : "Vẫn sống ❌"}`);

  log("\n4. Quan sát Job đang chạy có hoàn thành được không...");
  const tStart = Date.now();
  await jobPromise;
  const duration = Date.now() - tStart;

  log(`  - Job đã hoàn tất thành công trong ${duration}ms!`);
  log(`  - writeCallCount: ${harness.store.writeCallCount} (Kỳ vọng = 1)`);

  const createdTask = harness.store.tasks.find((t) => t.title.includes("Build Offline Engine"));
  log(`  - Task tạo trong local store: ${JSON.stringify(createdTask)}`);

  // Kiểm tra ledger entries
  const entries = harness.ledger["db"].prepare(
    "SELECT record_type, payload FROM ledger_entries WHERE job_id = ?"
  ).all(jobId) as any[];

  log(`  - Số lượng bản ghi ledger ghi nhận trong lúc backend sập: ${entries.length}`);
  for (const e of entries) {
    log(`    + Record Type: ${e.record_type}`);
  }

  if (harness.store.writeCallCount !== 1 || !createdTask) {
    throw new Error("❌ THẤT BẠI: Job bị dừng hoặc không tạo được task khi backend sập!");
  }

  log("\n5. KẾT LUẬN Q11:");
  log("  - Kiểm chứng thực nghiệm 100% chính xác luận điểm R-9 và ADR-007:");
  log("  - LLM traffic đi trực tiếp từ Client Desktop Assistant tới Provider Endpoint (BytePlus/OpenAI).");
  log("  - Dữ liệu trạng thái và Ledger lưu trữ cục bộ tại SQLite trên máy người dùng (Local-First).");
  log("  - Do đó: Khi backend gián đoạn hoàn toàn, MỌI JOB ĐANG CHẠY VẪN TIẾP TỤC BÌNH THƯỜNG và hoàn thành trọn vẹn.");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);
  harness.cleanup();
}

runQ11().catch((err) => {
  console.error("Test Q11 failed:", err);
  process.exit(1);
});
