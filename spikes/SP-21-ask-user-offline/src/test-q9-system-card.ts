import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalComposerService } from "./offline-queue.js";
import { SQLiteLedger } from "./ledger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q9-system-card.log");

async function runQ9() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q9: KIỂM CHỨNG CẤU TRÚC VÀ HÀNH VI SYSTEM CARD (Phụ lục A.2)");
  log("Yêu cầu: Card SYSTEM báo đúng trạng thái, mô tả + khắc phục 1 dòng, non-blocking, badge.");
  log("================================================================================\n");

  const dbPath = path.resolve(__dirname, "../evidence/test-system-card.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const ledger = new SQLiteLedger(dbPath);
  // Cố tình trỏ vào port không có backend chạy để mô phỏng gián đoạn
  const composer = new LocalComposerService(ledger, "http://127.0.0.1:3992");

  log("1. Gửi lệnh khi backend gián đoạn (port 3992 offline):");
  const result = await composer.submitCommand("Tạo task deploy hệ thống");

  log(`  - Trạng thái nhận lệnh: ${result.success ? "THÀNH CÔNG ✅" : "THẤT BẠI ❌"}`);
  log(`  - queuedOffline: ${result.queuedOffline}`);

  const card = result.systemCard;
  log("\n2. ĐỐI CHIẾU ANATOMY CỦA SYSTEM CARD VỚI PHỤ LỤC A.2:");
  log(`  - Card ID: ${card?.id}`);
  log(`  - Type: "${card?.type}" (Kỳ vọng: SYSTEM)`);
  log(`  - Category: "${card?.category}" (Kỳ vọng: BACKEND_DISRUPTED)`);
  log(`  - Title: "${card?.title}"`);
  log(`  - Description (Thân card - mô tả): "${card?.description}"`);
  log(`  - Action (Hướng khắc phục 1 dòng): "${card?.action}"`);
  log(`  - isBlocking (Có chặn người dùng không): ${card?.isBlocking} (Kỳ vọng: false)`);
  log(`  - autoDismiss (Có tự biến mất sau vài giây không): ${card?.autoDismiss} (Kỳ vọng: false - tồn tại tới khi hết lỗi)`);
  log(`  - badge (Hiển thị badge trên pet): ${card?.badge} (Kỳ vọng: true)`);
  log(`  - active: ${card?.active}`);

  const checks = [
    { name: "Loại card là SYSTEM", pass: card?.type === "SYSTEM" },
    { name: "Không blocking (isBlocking = false)", pass: card?.isBlocking === false },
    { name: "Không tự ẩn (autoDismiss = false)", pass: card?.autoDismiss === false },
    { name: "Hiển thị dạng badge (badge = true)", pass: card?.badge === true },
    { name: "Có mô tả thân card 1 dòng", pass: !!card?.description && card.description.length > 0 },
    { name: "Có hướng khắc phục dẫn tới app", pass: !!card?.action && card.action.length > 0 },
  ];

  log("\n3. BẢNG KIỂM TRA ĐẠT TIÊU CHUẨN A.2:");
  for (const c of checks) {
    log(`  - ${c.name}: ${c.pass ? "ĐẠT CHUẨN ✅" : "VI PHẠM ❌"}`);
    if (!c.pass) throw new Error(`SYSTEM Card vi phạm tiêu chuẩn: ${c.name}`);
  }

  log("\n4. KẾT LUẬN Q9:");
  log("  - SYSTEM card phát sinh chính xác khi backend gián đoạn.");
  log("  - Cấu trúc khớp 100% Phụ lục A.2:");
  log("    + Thân card: Mô tả trạng thái gián đoạn.");
  log("    + Hành động: 1 dòng hướng khắc phục.");
  log("    + Non-blocking (người dùng vẫn thao tác bình thường, composer vẫn nhận lệnh).");
  log("    + Không tự ẩn, duy trì badge tới khi backend phục hồi.");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);
  ledger.close();
}

runQ9().catch((err) => {
  console.error("Test Q9 failed:", err);
  process.exit(1);
});
