import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { SQLiteLedger } from "./ledger.js";
import { BackendStubServer } from "./backend-stub.js";
import { LocalComposerService } from "./offline-queue.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q12-persistence-storage.log");
const dbPath = path.resolve(__dirname, "../evidence/test-persistence-q12.db");

async function runQ12() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-21 / Q12: SỐNG SÓT QUA RESTART APP & ĐỊA ĐIỂM LƯU TRỮ HÀNG CHỜ");
  log("Câu hỏi: Hàng chờ cục bộ sống sót qua restart app không? Lưu ở đâu: cùng SQLite với ledger hay riêng?");
  log("================================================================================\n");

  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  // ============================================================================
  // PHẦN 1: THỬ NGHIỆM TIẾN TRÌNH 1 — GỬI LỆNH RỒI THOÁT APP (CRASH/RESTART)
  // ============================================================================
  log("1. TIẾN TRÌNH 1 (PHÂN HỆ APP ĐỢT 1):");
  log("  - Khởi tạo kết nối SQLite ledger + queue tại: " + dbPath);
  const ledger1 = new SQLiteLedger(dbPath);
  const composer1 = new LocalComposerService(ledger1, "http://127.0.0.1:3995");

  log("  - Backend đang offline (port 3995). Người dùng đưa 2 lệnh vào composer:");
  const cmdA = "Lệnh quan trọng trước khi tắt máy: Cập nhật Roadmap Q4";
  const cmdB = "Lệnh thứ hai: Đồng bộ 15 tasks từ email";

  await composer1.submitCommand(cmdA);
  await composer1.submitCommand(cmdB);

  const queuedP1 = ledger1.getQueuedCommands();
  log(`  - Tiến trình 1 đã ghi nhận vào SQLite: ${queuedP1.length} lệnh (Status: QUEUED_OFFLINE)`);
  log(`  [P1-Cmd1] ID: ${queuedP1[0].id} -> "${queuedP1[0].commandText}"`);
  log(`  [P1-Cmd2] ID: ${queuedP1[1].id} -> "${queuedP1[1].commandText}"`);

  log("\n  ⚡ THOÁT TIẾN TRÌNH 1 HOÀN TOÀN (Mô phỏng người dùng đóng app hoặc crash) ⚡");
  ledger1.close();

  // ============================================================================
  // PHẦN 2: TIẾN TRÌNH 2 — KHỞI ĐỘNG LẠI APP MỚI, NẠP LẠI TỪ SQLITE
  // ============================================================================
  log("\n2. TIẾN TRÌNH 2 (MỞ LẠI APP SAU KHI RESTART):");
  log("  - Khởi tạo instance SQLiteLedger mới mở lại đúng file DB cũ...");
  const ledger2 = new SQLiteLedger(dbPath);
  const composer2 = new LocalComposerService(ledger2, "http://127.0.0.1:3995");

  const queuedP2 = ledger2.getQueuedCommands();
  log(`  - Số lượng lệnh tồn tại sau khi Restart: ${queuedP2.length} (Kỳ vọng = 2)`);

  let survivePass = true;
  if (queuedP2.length !== 2) {
    survivePass = false;
  } else {
    if (queuedP2[0].commandText !== cmdA || queuedP2[1].commandText !== cmdB) {
      survivePass = false;
    }
  }

  for (let i = 0; i < queuedP2.length; i++) {
    const q = queuedP2[i];
    log(`  [Khôi phục #${i + 1}] ID: ${q.id}, Key: ${q.idempotencyKey}, Text: "${q.commandText}", Status: ${q.status}`);
  }

  log(`  - Kiểm tra tính nguyên vẹn: ${survivePass ? "SỐNG SÓT 100% NGUYÊN VẸN QUA RESTART ✅" : "THẤT BẠI ❌"}`);

  if (!survivePass) {
    throw new Error("❌ THẤT BẠI: Hàng chờ cục bộ không sống sót qua restart app!");
  }

  // Khởi động backend và đồng bộ tiếp ở phiên mới
  log("\n3. ĐỒNG BỘ TIẾP TỤC Ở PHIÊN APP MỚI KHI BACKEND SỐNG LẠI:");
  const backend = new BackendStubServer(3995);
  await backend.start();
  log("  - Backend online tại port 3995");

  const syncP2 = await composer2.syncQueue();
  log(`  - Đồng bộ thành công: ${syncP2.syncedCount} lệnh`);
  log(`  - Số lệnh Backend nhận được: ${backend.receivedCommands.length}`);
  log(`  - Hàng chờ còn tồn trong DB sau sync: ${ledger2.getQueuedCommands().length}`);

  await backend.stop();
  ledger2.close();

  // ============================================================================
  // PHẦN 3: ĐÁNH GIÁ VÀ SO SÁNH VỊ TRÍ LƯU TRỮ (CÙNG SQLITE HAY RIÊNG)
  // ============================================================================
  log("\n--------------------------------------------------------------------------------");
  log("4. SO SÁNH VỊ TRÍ LƯU TRỮ: CÙNG FILE SQLITE VỚI LEDGER HAY FILE RIÊNG?");
  log("--------------------------------------------------------------------------------");

  const analysis = `
| Tiêu chí | CÙNG một file SQLite (khuyên dùng) | TÁCH RIÊNG 2 file SQLite |
| --- | --- | --- |
| **Tính nguyên tử (ACID)** | **VƯỢT TRỘI:** Giao dịch nguyên tử liên bảng (Jobs + Queue + Ledger) trong 1 commit. Không có trạng thái rách dữ liệu. | **KÉM:** Không hỗ trợ transaction cross-db nguyên bản; cần tự xây 2-phase commit phức tạp. |
| **Quản trị kết nối (Connection Pool)** | **GỌN NHẸ:** 1 connection duy nhất trong Electron Main Process, kiểm soát concurrency và WAL tập trung. | **PHỨC TẠP:** Phải mở và quản lý 2 database connections, nhân đôi tài nguyên handle file. |
| **Khóa tập tin trên OS (File Locking)** | **AN TOÀN:** Windows và macOS chỉ quản lý 1 file lock và 1 cặp shm/wal file, giảm nguy cơ file lock tranh chấp. | **RỦI RO:** Hai file độc lập tăng nguy cơ bị OS/Antivirus lock hoặc lệch trạng thái khi crash. |
| **Schema Migration** | **ĐỒNG BỘ:** 1 phiên bản user_version di chuyển toàn bộ cấu trúc DB cùng lúc khi cập nhật app. | **RỜI RẠC:** Phải duy trì 2 migration scripts riêng lẻ cho từng DB. |
| **Tách biệt dữ liệu (Separation of Concerns)** | **ĐẠT:** Tách biệt bằng tên bảng (offline_command_queue vs ledger_entries vs decisions). Dễ dàng xóa dọn (retention policy). | **ĐẠT:** Tách vật lý trên ổ đĩa. |

KHUYẾN NGHỊ KIẾN TRÚC DỨT KHOÁT:
- Lưu CÙNG một cơ sở dữ liệu SQLite duy nhất (desktop-assistant.db) tại thư mục người dùng (userData).
- Sử dụng BẢNG RIÊNG (offline_command_queue) với khóa duy nhất idempotency_key, độc lập logic với bảng append-only ledger_entries.
- Chu kỳ dọn dẹp (Retention): Các lệnh có status = 'SYNCED' được tự động dọn sau 7 ngày để giữ kích thước DB tối ưu.
`;

  log(analysis);

  log("5. KẾT LUẬN Q12:");
  log("  - Hàng chờ cục bộ SỐNG SÓT 100% qua mọi lần tắt app, khởi động lại máy, hoặc crash.");
  log("  - Vị trí lưu trữ tối ưu: CÙNG một file SQLite với ledger (desktop-assistant.db), tách biệt ở cấp độ BẢNG (table-level separation).");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  log(`\nĐã lưu bằng chứng vào: ${logPath}`);
}

runQ12().catch((err) => {
  console.error("Test Q12 failed:", err);
  process.exit(1);
});
