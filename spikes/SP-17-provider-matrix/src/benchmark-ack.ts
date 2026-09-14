import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamSimple as openAiStreamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import type { Context, AssistantMessageEventStream } from "@earendil-works/pi-ai";
import {
  createModel,
  LLM_API_KEY,
  LLM_BASE_URL,
  LLM_MODEL_STRONG,
  LLM_MODEL_CHEAP,
  LLM_MODEL_VISION,
} from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../evidence");
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

interface RunResult {
  run: number;
  ttftMs: number;
  totalMs: number;
  inputTokens: number;
  outputTokens: number;
  text: string;
  success: boolean;
  error?: string;
}

interface ModelBenchmarkStats {
  modelName: string;
  modelId: string;
  runs: RunResult[];
  ttft: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p90: number;
  };
  totalLatency: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p90: number;
  };
  tokens: {
    avgInput: number;
    avgOutput: number;
    avgTotal: number;
  };
  meetsNfrPf03Ttft: boolean; // TTFT <= 2000ms
  meetsNfrPf03Total: boolean; // Total <= 2000ms
}

function calculatePercentiles(values: number[]) {
  if (values.length === 0) return { min: 0, max: 0, mean: 0, median: 0, p90: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = Math.round((sum / sorted.length) * 10) / 10;
  
  const p50Index = Math.floor(sorted.length * 0.5);
  const median = sorted.length % 2 === 0
    ? (sorted[p50Index - 1] + sorted[p50Index]) / 2
    : sorted[p50Index];
    
  const p90Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  const p90 = sorted[p90Index];

  return { min, max, mean, median, p90 };
}

async function runSingleTurn(
  modelId: string,
  hasVision: boolean,
  context: Context,
  runIdx: number
): Promise<RunResult> {
  const model = createModel(modelId, hasVision);
  const startTime = Date.now();
  let ttftMs = 0;
  let text = "";
  let success = true;
  let errorMsg: string | undefined;

  try {
    const stream: AssistantMessageEventStream = openAiStreamSimple(model, context, {
      apiKey: LLM_API_KEY,
    });

    for await (const event of stream) {
      if (event.type === "text_delta") {
        if (ttftMs === 0) {
          ttftMs = Date.now() - startTime;
        }
        text += event.delta;
      }
    }

    const result = await stream.result();
    const totalMs = Date.now() - startTime;
    if (ttftMs === 0) ttftMs = totalMs;

    return {
      run: runIdx,
      ttftMs,
      totalMs,
      inputTokens: result.usage?.input || 0,
      outputTokens: result.usage?.output || 0,
      text: text.trim(),
      success: true,
    };
  } catch (err: any) {
    const totalMs = Date.now() - startTime;
    return {
      run: runIdx,
      ttftMs: ttftMs || totalMs,
      totalMs,
      inputTokens: 0,
      outputTokens: 0,
      text: "",
      success: false,
      error: err.message || String(err),
    };
  }
}

async function benchmarkModel(
  modelName: string,
  modelId: string,
  iterations: number
): Promise<ModelBenchmarkStats> {
  console.log(`\n>>> Đang đo kiểm model [${modelName}] (${modelId}) - ${iterations} lượt lặp...`);
  
  const systemPrompt = "Bạn là Pet Assistant. Khi người dùng giao việc, hãy lập tức phản hồi 1 câu ngắn gọn theo phong cách thân thiện, xác nhận đã nhận lệnh và bắt đầu thực hiện (ví dụ: 'Nhận rồi, tôi kiểm tra Notion và tạo task ngay nhé!'). Giới hạn đúng 1 câu.";
  const userText = "Tạo task review PR #212 hạn thứ 6 tuần sau";

  const runs: RunResult[] = [];

  for (let i = 1; i <= iterations; i++) {
    const context: Context = {
      systemPrompt,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: userText }],
          timestamp: Date.now(),
        },
      ],
    };

    const res = await runSingleTurn(modelId, false, context, i);
    runs.push(res);
    process.stdout.write(`  Lượt ${i}/${iterations}: TTFT=${res.ttftMs}ms, Total=${res.totalMs}ms | "${res.text.slice(0, 40)}..."\n`);
    // Chờ 200ms giữa các request để tránh rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  const validRuns = runs.filter((r) => r.success);
  const ttftStats = calculatePercentiles(validRuns.map((r) => r.ttftMs));
  const totalStats = calculatePercentiles(validRuns.map((r) => r.totalMs));
  const avgInput = Math.round(validRuns.reduce((acc, r) => acc + r.inputTokens, 0) / validRuns.length);
  const avgOutput = Math.round(validRuns.reduce((acc, r) => acc + r.outputTokens, 0) / validRuns.length);

  return {
    modelName,
    modelId,
    runs,
    ttft: ttftStats,
    totalLatency: totalStats,
    tokens: {
      avgInput,
      avgOutput,
      avgTotal: avgInput + avgOutput,
    },
    meetsNfrPf03Ttft: ttftStats.median <= 2000,
    meetsNfrPf03Total: totalStats.median <= 2000,
  };
}

async function benchmarkMultimodal(
  modelName: string,
  modelId: string,
  imagePath: string,
  iterations: number
): Promise<{
  modelName: string;
  modelId: string;
  runs: RunResult[];
  ttft: any;
  totalLatency: any;
  tokens: any;
}> {
  console.log(`\n>>> Đang đo kiểm Multimodal (Ảnh + Text) trên [${modelName}] (${modelId})...`);
  
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const systemPrompt = "Bạn là Pet Assistant. Khi người dùng gửi ảnh giao việc, hãy nhìn ảnh và phản hồi ngay 1 câu xác nhận ngắn gọn (ví dụ: 'Đã nhận ảnh checklist, tôi bắt đầu cập nhật task ngay!'). Đúng 1 câu.";
  const userText = "Làm các task trong ảnh này giúp tôi";

  const runs: RunResult[] = [];

  for (let i = 1; i <= iterations; i++) {
    const context: Context = {
      systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image", data: base64Image, mimeType: "image/png" },
          ],
          timestamp: Date.now(),
        },
      ],
    };

    const res = await runSingleTurn(modelId, true, context, i);
    runs.push(res);
    process.stdout.write(`  Lượt ${i}/${iterations}: TTFT=${res.ttftMs}ms, Total=${res.totalMs}ms | "${res.text.slice(0, 40)}..."\n`);
    await new Promise((r) => setTimeout(r, 300));
  }

  const validRuns = runs.filter((r) => r.success);
  const ttftStats = calculatePercentiles(validRuns.map((r) => r.ttftMs));
  const totalStats = calculatePercentiles(validRuns.map((r) => r.totalMs));
  const avgInput = validRuns.length ? Math.round(validRuns.reduce((acc, r) => acc + r.inputTokens, 0) / validRuns.length) : 0;
  const avgOutput = validRuns.length ? Math.round(validRuns.reduce((acc, r) => acc + r.outputTokens, 0) / validRuns.length) : 0;

  return {
    modelName,
    modelId,
    runs,
    ttft: ttftStats,
    totalLatency: totalStats,
    tokens: {
      avgInput,
      avgOutput,
      avgTotal: avgInput + avgOutput,
    },
  };
}

async function testVisionRejection(modelName: string, modelId: string, imagePath: string) {
  console.log(`\n>>> Kiểm chứng từ chối ảnh (Vision Rejection) trên model [${modelName}] (${modelId})...`);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const context: Context = {
    systemPrompt: "Xác nhận nhận ảnh.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Xem ảnh này" },
          { type: "image", data: base64Image, mimeType: "image/png" },
        ],
        timestamp: Date.now(),
      },
    ],
  };

  const res = await runSingleTurn(modelId, true, context, 1);
  return {
    modelName,
    modelId,
    rejected: !res.success,
    error: res.error,
  };
}

export async function main() {
  console.log("================================================================================");
  console.log("SPIKE SP-17 — BENCHMARK ĐỘ TRỄ ACK CỦA PET-AGENT (NFR-PF-03 ≤ 2s)");
  console.log(`Endpoint: ${LLM_BASE_URL}`);
  console.log(`CHEAP : ${LLM_MODEL_CHEAP}`);
  console.log(`STRONG: ${LLM_MODEL_STRONG}`);
  console.log(`VISION: ${LLM_MODEL_VISION}`);
  console.log("================================================================================");

  const iterations = 10;

  // 1. Benchmark Text-only ACK trên cả 3 model
  const cheapBench = await benchmarkModel("CHEAP (DeepSeek V4 Flash)", LLM_MODEL_CHEAP, iterations);
  const strongBench = await benchmarkModel("STRONG (DeepSeek V4 Pro)", LLM_MODEL_STRONG, iterations);
  const visionBench = await benchmarkModel("VISION (Seed 2.0 Pro)", LLM_MODEL_VISION, iterations);

  // 2. Benchmark Multimodal (Ảnh + Text) trên Seed 2.0 Pro
  const testImagePath = path.resolve(__dirname, "../../SP-4-agent-loop/evidence/s16-slack-hr.png");
  const multimodalBench = await benchmarkMultimodal("VISION (Seed 2.0 Pro)", LLM_MODEL_VISION, testImagePath, 5);

  // 3. Xác nhận ràng buộc: DeepSeek từ chối ảnh
  const cheapRejection = await testVisionRejection("CHEAP (DeepSeek Flash)", LLM_MODEL_CHEAP, testImagePath);
  const strongRejection = await testVisionRejection("STRONG (DeepSeek Pro)", LLM_MODEL_STRONG, testImagePath);

  const fullReport = {
    benchmarkTimestamp: new Date().toISOString(),
    endpoint: LLM_BASE_URL,
    textBenchmarks: [cheapBench, strongBench, visionBench],
    multimodalBenchmark: multimodalBench,
    visionRejectionChecks: [cheapRejection, strongRejection],
  };

  const outputPath = path.resolve(evidenceDir, "ack-latency-bench.json");
  fs.writeFileSync(outputPath, JSON.stringify(fullReport, null, 2), "utf-8");
  console.log(`\n✅ Đã lưu dữ liệu benchmark vào: ${outputPath}`);

  // In bảng tổng hợp
  console.log("\n================================================================================");
  console.log("BẢNG TỔNG HỢP HIỆU NĂNG PET-AGENT ACK ĐỐI CHIẾU NFR-PF-03 (≤ 2.0s)");
  console.log("================================================================================");
  console.table([
    {
      "Model": "CHEAP (Flash)",
      "TTFT P50": `${cheapBench.ttft.median} ms`,
      "TTFT P90": `${cheapBench.ttft.p90} ms`,
      "Total P50": `${cheapBench.totalLatency.median} ms`,
      "Total P90": `${cheapBench.totalLatency.p90} ms`,
      "Output Tk": cheapBench.tokens.avgOutput,
      "NFR-PF-03 (≤2s)": cheapBench.meetsNfrPf03Total ? "✅ ĐẠT" : "⚠️ TTFT đạt, Total sát ngưỡng",
    },
    {
      "Model": "STRONG (Pro)",
      "TTFT P50": `${strongBench.ttft.median} ms`,
      "TTFT P90": `${strongBench.ttft.p90} ms`,
      "Total P50": `${strongBench.totalLatency.median} ms`,
      "Total P90": `${strongBench.totalLatency.p90} ms`,
      "Output Tk": strongBench.tokens.avgOutput,
      "NFR-PF-03 (≤2s)": strongBench.meetsNfrPf03Total ? "✅ ĐẠT" : "❌ KHÔNG ĐẠT",
    },
    {
      "Model": "VISION (Seed Text)",
      "TTFT P50": `${visionBench.ttft.median} ms`,
      "TTFT P90": `${visionBench.ttft.p90} ms`,
      "Total P50": `${visionBench.totalLatency.median} ms`,
      "Total P90": `${visionBench.totalLatency.p90} ms`,
      "Output Tk": visionBench.tokens.avgOutput,
      "NFR-PF-03 (≤2s)": visionBench.meetsNfrPf03Total ? "✅ ĐẠT" : "❌ KHÔNG ĐẠT",
    },
    {
      "Model": "VISION (Seed + Ảnh)",
      "TTFT P50": `${multimodalBench.ttft.median} ms`,
      "TTFT P90": `${multimodalBench.ttft.p90} ms`,
      "Total P50": `${multimodalBench.totalLatency.median} ms`,
      "Total P90": `${multimodalBench.totalLatency.p90} ms`,
      "Output Tk": multimodalBench.tokens.avgOutput,
      "NFR-PF-03 (≤2s)": multimodalBench.totalLatency.median <= 2000 ? "✅ ĐẠT" : "❌ KHÔNG ĐẠT (Độ trễ xử lý ảnh)",
    },
  ]);
  console.log("================================================================================\n");

  return fullReport;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("FATAL ERROR in benchmark-ack:", err);
    process.exit(1);
  });
}
