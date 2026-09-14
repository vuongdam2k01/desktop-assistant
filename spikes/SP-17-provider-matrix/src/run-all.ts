import { main as runAckBench } from "./benchmark-ack.js";
import { runErrorHandlingTests } from "./test-errors.js";
import { runCostAnalysis } from "./cost-calculator.js";

async function runAll() {
  console.log("================================================================================");
  console.log("CHẠY TRỌN BỘ KIỂM CHỨNG VÀ THỰC NGHIỆM SPIKE SP-17");
  console.log("================================================================================\n");

  console.log("PHẦN 1: BENCHMARK ĐỘ TRỄ ACK CỦA PET-AGENT (NFR-PF-03)");
  await runAckBench();

  console.log("\nPHẦN 2: KIỂM CHỨNG BẮT LỖI CẤU HÌNH & SYSTEM CARD (PHỤ LỤC A.2)");
  await runErrorHandlingTests();

  console.log("\nPHẦN 3: TÍNH TOÁN VÀ LẬP MA TRẬN CHI PHÍ HÀNG THÁNG CHO M-V1 (Q6)");
  runCostAnalysis();

  console.log("\n================================================================================");
  console.log("✅ HOÀN TẤT TOÀN BỘ THÍ NGHIỆM SP-17!");
  console.log("================================================================================");
}

runAll().catch((err) => {
  console.error("FATAL ERROR in run-all:", err);
  process.exit(1);
});
