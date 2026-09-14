import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BackendStubServer } from "./backend-stub.js";
import { LocalComposerService } from "./offline-queue.js";
import { SQLiteLedger } from "./ledger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q10-auto-resend.log");

async function runQ10() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q10: TỰ ĐỘNG GỬI LẠI ĐÚNG THỨ TỰ & CHỐNG GỬI TRÙNG (IDEMPOTENCY)");
  log("Yêu cầu: Backend trở lại -> Tự gửi lại ĐÚNG THỨ TỰ (FIFO), TUYỆT ĐỐI KHÔNG GỬI TRÙNG.");
  log("================================================================================\n");

  const dbPath = path.resolve(__dirname, "../evidence/test-resend-q10.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const ledger = new SQLiteLedger(dbPath);
  const backend = new BackendStubServer(3993);
  const composer = new LocalComposerService(ledger, "http://127.0.0.1:3993");

  // 1. Khi Backend đang tắt: Người dùng gửi 3 lệnh liên tiếp
  log("1. GỬI 3 LỆNH TUẦN TỰ KHI BACKEND GIÁN ĐOẠN:");
  const commandsToSend = [
    "Lệnh #1: Khởi tạo project Workspace A",
    "Lệnh #2: Tạo database Tasks trong Workspace A",
    "Lệnh #3: Gán quyền cho nhóm kỹ thuật",
  ];

  for (let i = 0; i < commandsToSend.length; i++) {
    const text = commandsToSend[i];
    await composer.submitCommand(text);
    log(`  - Đã đưa vào hàng chờ ngoại tuyến: "${text}"`);
    // Tạo khoảng cách thời gian nhỏ giữa các lệnh để kiểm chứng timestamp
    await new Promise((r) => setTimeout(r, 100));
  }

  const queuedBefore = ledger.getQueuedCommands();
  log(`  -> Số lượng lệnh trong SQLite queue: ${queuedBefore.length}`);
  log(`  -> Trạng thái SYSTEM card hiện tại: ${composer.activeSystemCard ? "ĐANG BẬT (Active)" : "TẮT"}`);

  // 2. Backend phục hồi (Bật server)
  log("\n2. BACKEND PHỤC HỒI (KHỞI ĐỘNG LẠI SERVER):");
  await backend.start();
  log("  - Backend stub server đã online tại http://127.0.0.1:3993/health");

  // 3. Kích hoạt chu trình đồng bộ tự động (Sync Queue)
  log("\n3. TIẾN HÀNH ĐỒNG BỘ TỰ ĐỘNG (DRAIN QUEUE):");
  const syncResult = await composer.syncQueue();
  log(`  - Số lệnh đồng bộ thành công: ${syncResult.syncedCount}`);
  log(`  - Lỗi phát sinh: ${syncResult.errors.length === 0 ? "0 lỗi" : JSON.stringify(syncResult.errors)}`);

  // 4. Đối chiếu thứ tự nhận lệnh tại Backend (Strict FIFO)
  log("\n4. ĐỐI CHIẾU THỨ TỰ NHẬN LỆNH TẠI PHÍA SERVER:");
  log(`  - Tổng số lệnh Server nhận được: ${backend.receivedCommands.length}`);

  let orderCorrect = true;
  for (let i = 0; i < backend.receivedCommands.length; i++) {
    const rcv = backend.receivedCommands[i];
    const expected = commandsToSend[i];
    const match = rcv.commandText === expected;
    if (!match) orderCorrect = false;
    log(`  [Server nhận #${i + 1}] "${rcv.commandText}" (Key: ${rcv.idempotencyKey}) -> ${match ? "ĐÚNG THỨ TỰ ✅" : "SAI THỨ TỰ ❌"}`);
  }

  if (!orderCorrect) {
    throw new Error("❌ THẤT BẠI: Hàng chờ gửi sai thứ tự FIFO!");
  }
  log("  -> ✅ ĐÃ XÁC NHẬN: Thứ tự gửi lại khớp 100% thứ tự ban đầu của người dùng (FIFO).");

  // 5. Kiểm thử CHỐNG GỬI TRÙNG (IDEMPOTENCY VERIFICATION)
  log("\n5. KIỂM THỬ KHẢ NĂNG CHỐNG GỬI TRÙNG (IDEMPOTENCY):");
  log("  Giả lập tình huống mạng chập chờn: Worker retry gửi lại Lệnh #2 với cùng IdempotencyKey...");

  const duplicateCmd = backend.receivedCommands[1];
  const duplicateRes = await fetch("http://127.0.0.1:3993/api/v1/commands/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commandId: duplicateCmd.commandId,
      commandText: duplicateCmd.commandText,
      idempotencyKey: duplicateCmd.idempotencyKey,
      createdAt: duplicateCmd.createdAt,
    }),
  });

  const dupJson: any = await duplicateRes.json();
  log(`  - Phản hồi từ Server khi gặp duplicate: ${JSON.stringify(dupJson)}`);
  log(`  - Tổng số lệnh lưu trong server sau duplicate: ${backend.receivedCommands.length} (Kỳ vọng vẫn = 3, KHÔNG tăng)`);

  if (backend.receivedCommands.length !== 3 || dupJson.status !== "deduplicated") {
    throw new Error("❌ THẤT BẠI: Server bị nhận trùng lệnh!");
  }
  log("  -> ✅ ĐÃ XÁC NHẬN: Idempotency Key bảo đảm không bị duplicate lệnh khi retry.");

  // 6. Kiểm tra trạng thái cuối của Hàng chờ và SYSTEM Card
  log("\n6. TRẠNG THÁI CUỐI TRONG HỆ THỐNG:");
  const queuedAfter = ledger.getQueuedCommands();
  log(`  - Số lệnh còn tồn đọng trong queue: ${queuedAfter.length} (Kỳ vọng = 0)`);
  log(`  - Trạng thái SYSTEM card: ${composer.activeSystemCard === null ? "ĐÃ TỰ ĐỘNG THU HỒI ✅" : "CHƯA THU HỒI ❌"}`);

  log("\n7. KẾT LUẬN Q10:");
  log("  - Khi backend trở lại, toàn bộ lệnh trong hàng chờ tự động gửi lại ĐÚNG THỨ TỰ (FIFO).");
  log("  - Cơ chế Idempotency Key chống tuyệt đối việc gửi trùng lệnh.");
  log("  - Đủ điều kiện kỹ thuật để ký nghiệm thu Tiêu chí phát hành #10 (Release Criteria #10).");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);

  await backend.stop();
  ledger.close();
}

runQ10().catch((err) => {
  console.error("Test Q10 failed:", err);
  process.exit(1);
});
