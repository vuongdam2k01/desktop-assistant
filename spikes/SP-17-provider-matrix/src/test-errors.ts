import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamSimple as openAiStreamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import type { Context, Model } from "@earendil-works/pi-ai";
import {
  createModel,
  LLM_API_KEY,
  LLM_BASE_URL,
  LLM_MODEL_CHEAP,
} from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../evidence");
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

export interface SystemCardPayload {
  type: "SYSTEM";
  title: string;
  description: string;
  remedy: string;
  actionLabel: string;
  actionTarget: string;
  isBlocking: boolean;
  autoDismissSeconds: null; // SYSTEM card does not auto-dismiss
  badgePersistent: boolean;
  rawErrorCode?: string | number;
  providerDetails?: any;
}

export function mapErrorToSystemCard(error: any): SystemCardPayload {
  const errMsg = error?.message || error?.errorMessage || String(error);
  const status = error?.status || error?.statusCode || (errMsg.match(/(?:status\s+|^\s*)(\d{3})/i)?.[1] ? parseInt(errMsg.match(/(?:status\s+|^\s*)(\d{3})/i)![1], 10) : undefined);

  // 1. Lỗi xác thực / Sai API Key
  if (status === 401 || errMsg.includes("401") || errMsg.toLowerCase().includes("unauthorized") || errMsg.toLowerCase().includes("authenticationerror") || errMsg.toLowerCase().includes("invalid api key")) {
    return {
      type: "SYSTEM",
      title: "Lỗi xác thực LLM Provider",
      description: "API Key cấu hình không hợp lệ hoặc đã bị vô hiệu hoá trên provider.",
      remedy: "Vui lòng kiểm tra và cập nhật lại API Key trong mục Cài đặt.",
      actionLabel: "Mở Cài đặt LLM Provider",
      actionTarget: "settings://providers/llm",
      isBlocking: false,
      autoDismissSeconds: null,
      badgePersistent: true,
      rawErrorCode: status || 401,
      providerDetails: errMsg,
    };
  }

  // 2. Model không tồn tại hoặc không được hỗ trợ trong gói
  if (status === 404 || status === 400 && (errMsg.includes("model") || errMsg.includes("not found") || errMsg.includes("unsupportedmodel") || errMsg.includes("does not exist") || errMsg.includes("does not support"))) {
    return {
      type: "SYSTEM",
      title: "Model LLM không khả dụng",
      description: "Model đã chọn không tồn tại trên provider hoặc không thuộc gói dịch vụ đã kích hoạt.",
      remedy: "Vui lòng chọn model hợp lệ khác trong danh mục model khả dụng.",
      actionLabel: "Đổi Model trong Cài đặt",
      actionTarget: "settings://providers/llm/models",
      isBlocking: false,
      autoDismissSeconds: null,
      badgePersistent: true,
      rawErrorCode: status || 404,
      providerDetails: errMsg,
    };
  }

  // 3. Hết Quota / Hết hạn mức / Rate limit
  if (status === 429 || errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("insufficient_quota")) {
    return {
      type: "SYSTEM",
      title: "Hết hạn mức / Quota LLM Provider",
      description: "Tài khoản provider đã vượt giới hạn lượt gọi hoặc đã dùng hết số dư tín dụng.",
      remedy: "Vui lòng nạp thêm credit vào tài khoản provider hoặc đợi hạn mức phục hồi.",
      actionLabel: "Kiểm tra Tài khoản Provider",
      actionTarget: "https://ark.bytedance.net",
      isBlocking: false,
      autoDismissSeconds: null,
      badgePersistent: true,
      rawErrorCode: status || 429,
      providerDetails: errMsg,
    };
  }

  // 4. Lỗi kết nối mạng / Endpoint không truy cập được
  if (errMsg.includes("fetch failed") || errMsg.includes("ECONNREFUSED") || errMsg.includes("ENOTFOUND") || errMsg.includes("ETIMEDOUT")) {
    return {
      type: "SYSTEM",
      title: "Mất kết nối tới LLM Provider",
      description: "Không thể kết nối tới endpoint provider (mất mạng hoặc URL sai).",
      remedy: "Kiểm tra kết nối Internet của máy hoặc kiểm tra lại Base URL trong Cài đặt.",
      actionLabel: "Kiểm tra Mạng & Cài đặt",
      actionTarget: "settings://network",
      isBlocking: false,
      autoDismissSeconds: null,
      badgePersistent: true,
      rawErrorCode: "NETWORK_ERROR",
      providerDetails: errMsg,
    };
  }

  // Fallback chung
  return {
    type: "SYSTEM",
    title: "Sự cố LLM Provider",
    description: `Gặp lỗi không mong muốn khi giao tiếp với LLM: ${errMsg.slice(0, 100)}`,
    remedy: "Kiểm tra log hệ thống và trạng thái hoạt động của provider.",
    actionLabel: "Mở Xem Chi Tiết Log",
    actionTarget: "app://logs",
    isBlocking: false,
    autoDismissSeconds: null,
    badgePersistent: true,
    rawErrorCode: "UNKNOWN_PROVIDER_ERROR",
    providerDetails: errMsg,
  };
}

async function testRawHttp(apiKey: string, model: string): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
}> {
  const url = `${LLM_BASE_URL}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Ping" }],
      max_tokens: 10,
    }),
  });

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });

  let body: any;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }

  return {
    status: res.status,
    statusText: res.statusText,
    headers,
    body,
  };
}

async function testPiSdk(apiKey: string, modelId: string): Promise<{
  hasErrorEvent: boolean;
  stopReason: string | undefined;
  errorMessage: string | undefined;
  rawEventError: any;
}> {
  const model: Model<"openai-completions"> = {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: "custom",
    baseUrl: LLM_BASE_URL,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1048576,
    maxTokens: 10,
  };

  const context: Context = {
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "Ping" }],
        timestamp: Date.now(),
      },
    ],
  };

  let hasErrorEvent = false;
  let rawEventError: any = null;

  try {
    const stream = openAiStreamSimple(model, context, { apiKey });
    for await (const event of stream) {
      if (event.type === "error") {
        hasErrorEvent = true;
        rawEventError = event;
      }
    }
    const res = await stream.result();
    return {
      hasErrorEvent,
      stopReason: res.stopReason,
      errorMessage: res.errorMessage,
      rawEventError,
    };
  } catch (err: any) {
    return {
      hasErrorEvent: true,
      stopReason: "error",
      errorMessage: err.message,
      rawEventError: err,
    };
  }
}

export async function runErrorHandlingTests() {
  console.log("================================================================================");
  console.log("SPIKE SP-17 / Q5: KIỂM CHỨNG BẮT LỖI CẤU HÌNH & HẾT QUOTA → SYSTEM CARD (A.2)");
  console.log("================================================================================\n");

  const results: any = {};

  // Kịch bản 1: Sai API Key
  console.log("[1] Thử nghiệm với API Key sai: ark-invalid-key-999999");
  const rawKeyError = await testRawHttp("ark-invalid-key-999999", LLM_MODEL_CHEAP);
  console.log(`    -> Raw HTTP Status: ${rawKeyError.status} ${rawKeyError.statusText}`);
  console.log(`    -> Response Body:`, JSON.stringify(rawKeyError.body));

  const sdkKeyError = await testPiSdk("ark-invalid-key-999999", LLM_MODEL_CHEAP);
  console.log(`    -> Pi SDK hasErrorEvent: ${sdkKeyError.hasErrorEvent}, stopReason: ${sdkKeyError.stopReason}`);
  console.log(`    -> SDK errorMessage: "${sdkKeyError.errorMessage}"`);

  const cardKeyError = mapErrorToSystemCard({ message: sdkKeyError.errorMessage, status: rawKeyError.status });
  console.log(`    -> Generated SYSTEM Card: [${cardKeyError.title}] - ${cardKeyError.description} | Nút: "${cardKeyError.actionLabel}"`);

  results.invalidApiKey = {
    rawHttp: rawKeyError,
    sdkResult: sdkKeyError,
    systemCard: cardKeyError,
  };

  // Kịch bản 2: Model không tồn tại
  console.log("\n[2] Thử nghiệm với Model không tồn tại: non-existent-model-xyz");
  const rawModelError = await testRawHttp(LLM_API_KEY, "non-existent-model-xyz");
  console.log(`    -> Raw HTTP Status: ${rawModelError.status} ${rawModelError.statusText}`);
  console.log(`    -> Response Body:`, JSON.stringify(rawModelError.body));

  const sdkModelError = await testPiSdk(LLM_API_KEY, "non-existent-model-xyz");
  console.log(`    -> Pi SDK hasErrorEvent: ${sdkModelError.hasErrorEvent}, stopReason: ${sdkModelError.stopReason}`);
  console.log(`    -> SDK errorMessage: "${sdkModelError.errorMessage}"`);

  const cardModelError = mapErrorToSystemCard({ message: sdkModelError.errorMessage, status: rawModelError.status });
  console.log(`    -> Generated SYSTEM Card: [${cardModelError.title}] - ${cardModelError.description} | Nút: "${cardModelError.actionLabel}"`);

  results.nonExistentModel = {
    rawHttp: rawModelError,
    sdkResult: sdkModelError,
    systemCard: cardModelError,
  };

  // Kịch bản 3: Mô phỏng Quota Exceeded / Rate Limit (HTTP 429)
  console.log("\n[3] Mô phỏng mã lỗi HTTP 429 Quota Exceeded / Rate Limit");
  const simulated429 = {
    status: 429,
    message: "HTTP 429 Too Many Requests: Insufficient quota or rate limit exceeded on provider account.",
  };
  const cardQuotaError = mapErrorToSystemCard(simulated429);
  console.log(`    -> Generated SYSTEM Card: [${cardQuotaError.title}] - ${cardQuotaError.description} | Nút: "${cardQuotaError.actionLabel}"`);

  results.quotaExceededSimulation = {
    simulatedError: simulated429,
    systemCard: cardQuotaError,
  };

  // Lưu evidence
  const evidenceResponsesPath = path.resolve(evidenceDir, "error-responses.json");
  fs.writeFileSync(evidenceResponsesPath, JSON.stringify(results, null, 2), "utf-8");

  const evidenceCardsPath = path.resolve(evidenceDir, "system-cards.json");
  const cardsSummary = {
    schemaVersion: "1.0",
    compliancePrdAppendix: "A.2 (SYSTEM Card)",
    cards: [
      { trigger: "Invalid API Key", card: cardKeyError },
      { trigger: "Non-existent Model", card: cardModelError },
      { trigger: "Quota Exceeded (429)", card: cardQuotaError },
    ],
  };
  fs.writeFileSync(evidenceCardsPath, JSON.stringify(cardsSummary, null, 2), "utf-8");

  console.log(`\n✅ Đã lưu error responses vào: ${evidenceResponsesPath}`);
  console.log(`✅ Đã lưu SYSTEM cards vào: ${evidenceCardsPath}\n`);

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runErrorHandlingTests().catch((err) => {
    console.error("FATAL ERROR in test-errors:", err);
    process.exit(1);
  });
}
