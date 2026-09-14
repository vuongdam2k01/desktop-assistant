import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateRisk, LLM_MODEL_CHEAP, LLM_BASE_URL } from "./judge.js";
import { WRITE_CASES } from "./cases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, "../evidence");

interface FailureScenario {
  id: string;
  name: string;
  description: string;
  options: {
    baseUrl?: string;
    apiKey?: string;
    timeoutMs?: number;
  };
  modelId?: string;
}

const FAILURE_SCENARIOS: FailureScenario[] = [
  {
    id: "NET-01-DEAD-PORT",
    name: "Cổng chết cục bộ (Connection Refused)",
    description: "Trỏ base URL sang cổng 127.0.0.1:59999 không có service nào lắng nghe.",
    options: {
      baseUrl: "http://127.0.0.1:59999/v1"
    }
  },
  {
    id: "NET-02-TIMEOUT-BLACKHOLE",
    name: "Mất mạng / IP không phản hồi (Network Timeout / Blackhole IP)",
    description: "Trỏ base URL sang địa chỉ TEST-NET 192.0.2.1:81 với timeout 1500ms.",
    options: {
      baseUrl: "http://192.0.2.1:81/v1",
      timeoutMs: 1500
    }
  },
  {
    id: "NET-03-INVALID-AUTH",
    name: "Sai thông tin xác thực / Hết hạn token (HTTP 401 Unauthorized)",
    description: "Gửi request với API key không hợp lệ.",
    options: {
      apiKey: "ark-invalid-fake-token-sp10-test"
    }
  },
  {
    id: "NET-04-INVALID-MODEL",
    name: "Model không tồn tại / Hết quota model (HTTP 404 / 400)",
    description: "Gọi model ID không hợp lệ trong catalog.",
    options: {},
    modelId: "non-existent-model-quota-exceeded-test"
  }
];

async function runNetworkTests() {
  console.log("=== KIỂM THỬ AN TOÀN FAIL-CLOSED KHI LỜI GỌI JUDGE THẤT BẠI (SP-10 Q4) ===");
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });

  const testCase = WRITE_CASES[0]; // Ca W-01 (vốn là AN TOÀN)
  console.log(`Ca kiểm thử dùng làm mẫu: ${testCase.id} - ${testCase.targetDescription}`);
  console.log(`(Nếu hoạt động bình thường, W-01 sẽ được AUTO_APPROVE. Khi lỗi mạng, PHẢI đổi thành ESCALATE_USER)\n`);

  const results: any[] = [];
  let allPassed = true;

  for (const scenario of FAILURE_SCENARIOS) {
    console.log(`[TEST] ${scenario.id}: ${scenario.name}`);
    console.log(`       Chi tiết: ${scenario.description}`);

    const result = await evaluateRisk(
      testCase,
      scenario.modelId || LLM_MODEL_CHEAP,
      scenario.options
    );

    const isFailClosed = result.decision === "ESCALATE_USER";
    const isFallback = result.isFallback === true;
    const isSafe = result.decision !== "AUTO_APPROVE";
    const passed = isFailClosed && isFallback && isSafe;

    if (!passed) {
      allPassed = false;
    }

    console.log(`       Kết quả trả về: decision = ${result.decision}, isFallback = ${result.isFallback}, latency = ${result.latencyMs}ms`);
    console.log(`       Reasoning: ${result.reasoning}`);
    console.log(`       -> Đánh giá: ${passed ? "✅ ĐẠT (Fail-closed đúng)" : "❌ THẤT BẠI (Không fail-closed)"}\n`);

    results.push({
      scenarioId: scenario.id,
      name: scenario.name,
      description: scenario.description,
      testCaseUsed: testCase.id,
      expectedDecision: "ESCALATE_USER",
      actualDecision: result.decision,
      isFallback: result.isFallback,
      latencyMs: result.latencyMs,
      reasoning: result.reasoning,
      errorDetail: result.errorDetail,
      passed
    });
  }

  const outputPath = path.join(EVIDENCE_DIR, "network_failure_test.json");
  await fs.writeFile(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalScenarios: FAILURE_SCENARIOS.length,
    allPassed,
    scenarios: results
  }, null, 2));

  console.log(`Đã ghi toàn bộ bằng chứng vào: ${outputPath}`);
  if (!allPassed) {
    console.error("❌ CÓ KỊCH BẢN THẤT BẠI TRONG KIỂM THỬ FAIL-CLOSED!");
    process.exit(1);
  } else {
    console.log("✅ 100% KỊCH BẢN LỖI ĐỀU FAIL-CLOSED ĐẨY LÊN NGƯỜI DÙNG THÀNH CÔNG!\n");
  }
}

runNetworkTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
