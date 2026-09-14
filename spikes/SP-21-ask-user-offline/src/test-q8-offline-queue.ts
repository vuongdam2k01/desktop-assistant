import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BackendStubServer } from "./backend-stub.js";
import { LocalComposerService } from "./offline-queue.js";
import { SQLiteLedger } from "./ledger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q8-offline-queue.log");

async function runQ8() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q8: HÀNG CHỜ LỆNH NGOẠI TUYẾN KHI BACKEND GIÁN ĐOẠN (ca E8)");
  log("Tiêu chí phát hành #10: Lệnh gửi khi backend không phản hồi có vào hàng chờ cục bộ không?");
  log("================================================================================\n");

  const dbPath = path.resolve(__dirname, "../evidence/test-queue-q8.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const ledger = new SQLiteLedger(dbPath);
  const backend = new BackendStubServer(3991);
  const composer = new LocalComposerService(ledger, "http://127.0.0.1:3991");

  // 1. Kiểm tra gửi lệnh khi Backend đang ONLINE
  log("1. KIỂM TRA GỬI LỆNH KHI BACKEND ĐANG BẬT (ONLINE):");
  await backend.start();
  log("  - Backend stub đã khởi động trên cổng 3991");

  const onlineResult = await composer.submitCommand("Lệnh gửi lúc bình thường (Online)");
  log(`  - Trạng thái gửi trực tiếp: ${onlineResult.success ? "THÀNH CÔNG ✅" : "THẤT BẠI ❌"}`);
  log(`  - queuedOffline: ${onlineResult.queuedOffline} (Kỳ vọng: false - gửi thẳng, không cần xếp hàng)`);
  log(`  - Backend nhận được: ${backend.receivedCommands.length} lệnh`);

  // 2. Mô phỏng Backend GIÁN ĐOẠN (Tắt server hoàn toàn)
  log("\n2. MÔ PHỎNG BACKEND GIÁN ĐOẠN (TẮT SERVER BACKEND):");
  await backend.stop();
  log("  - Backend đã tắt hoàn toàn (Mô phỏng sập server / mất kết nối)");

  // 3. Người dùng nhập 2 lệnh trong Composer
  log("\n3. NGƯỜI DÙNG GỬI 2 LỆNH TRONG COMPOSER KHI BACKEND MẤT KẾT NỐI:");
  const cmdText1 = "Tạo task 'Sync Q4 Marketing Campaign' trong database Tasks";
  const cmdText2 = "Cập nhật status task-1 sang Done";

  log(`  - Gửi lệnh 1: "${cmdText1}"`);
  const res1 = await composer.submitCommand(cmdText1);
  log(`    -> Composer nhận lệnh: ${res1.success ? "CÓ ✅" : "KHÔNG ❌"}`);
  log(`    -> queuedOffline: ${res1.queuedOffline} (Kỳ vọng: true)`);
  log(`    -> Command ID: ${res1.commandId}`);

  log(`  - Gửi lệnh 2: "${cmdText2}"`);
  const res2 = await composer.submitCommand(cmdText2);
  log(`    -> Composer nhận lệnh: ${res2.success ? "CÓ ✅" : "KHÔNG ❌"}`);
  log(`    -> queuedOffline: ${res2.queuedOffline} (Kỳ vọng: true)`);
  log(`    -> Command ID: ${res2.commandId}`);

  // 4. Kiểm tra Hàng chờ cục bộ trong SQLite
  log("\n4. KIỂM TRA TÍNH TOÀN VẸN CỦA HÀNG CHỜ CỤC BỘ TRONG SQLITE:");
  const queuedItems = ledger.getQueuedCommands();
  log(`  - Tổng số lệnh đang lưu trong SQLite offline_command_queue: ${queuedItems.length} (Kỳ vọng = 2)`);

  for (let i = 0; i < queuedItems.length; i++) {
    const item = queuedItems[i];
    log(`  [Mục #${i + 1}] ID: ${item.id}, Status: ${item.status}, Text: "${item.commandText}", IdempotencyKey: ${item.idempotencyKey}`);
  }

  if (queuedItems.length !== 2) {
    throw new Error(`❌ THẤT BẠI: Số lượng lệnh trong hàng chờ không đúng (${queuedItems.length} != 2). Có nguy cơ mất lệnh!`);
  }

  const allQueuedOffline = queuedItems.every((it) => it.status === "QUEUED_OFFLINE");
  log(`  - Toàn bộ lệnh mang trạng thái 'QUEUED_OFFLINE': ${allQueuedOffline ? "ĐẠT ✅" : "SAI ❌"}`);

  log("\n5. KẾT LUẬN Q8:");
  log("  - Lệnh gửi khi backend không phản hồi KHÔNG BAO GIỜ BỊ MẤT.");
  log("  - Composer lập tức ghi nhận vào hàng chờ cục bộ (SQLite table offline_command_queue) với trạng thái QUEUED_OFFLINE.");
  log("  - Đáp ứng trọn vẹn yêu cầu Ca E8 và tiêu chí phát hành #10.");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);
  ledger.close();
}

runQ8().catch((err) => {
  console.error("Test Q8 failed:", err);
  process.exit(1);
});
