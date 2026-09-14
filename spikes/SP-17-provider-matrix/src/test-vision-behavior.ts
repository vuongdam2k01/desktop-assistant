import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamSimple as openAiStreamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import { createModel, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_CHEAP, LLM_MODEL_STRONG, LLM_MODEL_VISION } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagePath = path.resolve(__dirname, "../../SP-4-agent-loop/evidence/s16-slack-hr.png");
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString("base64");

async function testSdk(modelId: string, name: string) {
  const model = createModel(modelId, true);
  const context = {
    systemPrompt: "Hãy đọc chữ và mô tả nội dung trong ảnh đính kèm. Nếu không thấy ảnh hoặc không hỗ trợ đọc ảnh, hãy nói rõ.",
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Trong ảnh này viết những gì?" },
          { type: "image" as const, data: base64Image, mimeType: "image/png" },
        ],
        timestamp: Date.now(),
      },
    ],
  };

  try {
    const stream = openAiStreamSimple(model, context, { apiKey: LLM_API_KEY });
    let text = "";
    for await (const event of stream) {
      if (event.type === "text_delta") text += event.delta;
    }
    const res = await stream.result();
    console.log(`\n=== SDK: ${name} (${modelId}) ===`);
    console.log(`Response: "${text.trim()}"`);
    console.log(`Usage:`, res.usage);
    return { name, modelId, text: text.trim(), usage: res.usage, success: true };
  } catch (err: any) {
    console.log(`\n=== SDK: ${name} (${modelId}) ===`);
    console.log(`Error:`, err.message);
    return { name, modelId, error: err.message, success: false };
  }
}

async function testRawHttp(modelId: string, name: string) {
  const url = `${LLM_BASE_URL}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Trong ảnh viết gì?" },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 300,
    }),
  });

  const status = res.status;
  let body: any;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  console.log(`\n=== RAW HTTP: ${name} (${modelId}) ===`);
  console.log(`Status: ${status}`);
  if (status === 200) {
    console.log(`Response text: "${body?.choices?.[0]?.message?.content?.trim()}"`);
    console.log(`Usage:`, body?.usage);
  } else {
    console.log(`Error response:`, JSON.stringify(body));
  }
  return { name, modelId, status, body };
}

async function main() {
  console.log("KIỂM TRA NĂNG LỰC NHẬN DIỆN THỊ GIÁC THẬT CỦA CẢ 3 MODEL");
  console.log("Ảnh thử nghiệm: spikes/SP-4-agent-loop/evidence/s16-slack-hr.png (Ảnh chụp Slack giao 3 việc HR)");

  console.log("\n--- [1] KIỂM TRA MODEL VISION (Seed 2.0 Pro) ---");
  await testSdk(LLM_MODEL_VISION, "Seed 2.0 Pro");
  await testRawHttp(LLM_MODEL_VISION, "Seed 2.0 Pro");

  console.log("\n--- [2] KIỂM TRA MODEL CHEAP (DeepSeek V4 Flash) ---");
  await testSdk(LLM_MODEL_CHEAP, "DeepSeek Flash");
  await testRawHttp(LLM_MODEL_CHEAP, "DeepSeek Flash");

  console.log("\n--- [3] KIỂM TRA MODEL STRONG (DeepSeek V4 Pro) ---");
  await testSdk(LLM_MODEL_STRONG, "DeepSeek Pro");
  await testRawHttp(LLM_MODEL_STRONG, "DeepSeek Pro");
}

main().catch(console.error);
