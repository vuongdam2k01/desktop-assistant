import { runUnitTests } from "../tests/unit-evaluator.test.js";
import { runLatencyBenchmark } from "../tests/benchmark-latency.js";
import { runCorpus } from "./run-corpus.js";

async function runAll() {
  console.log("================================================================================");
  console.log("CHẠY TOÀN BỘ QUY TRÌNH KIỂM CHỨNG SPIKE SP-8");
  console.log("================================================================================\n");

  console.log(">>> BƯỚC 1: KIỂM THỬ ĐƠN VỊ EVALUATOR & RULE IR");
  runUnitTests();

  console.log("\n>>> BƯỚC 2: ĐO ĐẠC ĐỘ TRỄ EVALUATOR (10,000 LƯỢT)");
  runLatencyBenchmark();

  console.log("\n>>> BƯỚC 3: KIỂM THỬ 20 CA CORPUS ĐỐI KHÁNG TRÊN AGENT THẬT");
  await runCorpus();

  console.log("\n================================================================================");
  console.log("HOÀN TẤT TOÀN BỘ KIỂM CHỨNG SPIKE SP-8 — 0 LỌT!");
  console.log("================================================================================");
}

runAll().catch((err) => {
  console.error("Lỗi khi chạy runAll:", err);
  process.exit(1);
});
