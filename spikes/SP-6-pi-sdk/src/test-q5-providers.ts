import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamSimple as openAiStreamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import { createModel, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_STRONG, LLM_MODEL_CHEAP } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../evidence/q5-provider-response.log");

async function runQ5Test() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("SPIKE SP-6 / Q5: Cơ chế Provider Layer & Phân Tích FR-AG-11");
  log("Bối cảnh: FR-AG-11 ghi 'subscription qua /login OAuth, API key, custom provider'.");
  log("Mục tiêu: Làm rõ SDK phơi ra gì, phân biệt SDK vs CLI, kiến nghị sửa FR-AG-11.");
  log("================================================================================\n");

  log("[1] Khảo sát kiến trúc Provider Layer trong @earendil-works/pi-ai:");
  log("  - Các họ API native được hỗ trợ:");
  log("    * openai-completions (chuẩn tương thích OpenAI, dùng cho mọi endpoint bên thứ ba)");
  log("    * openai-responses / azure-openai-responses");
  log("    * anthropic-messages");
  log("    * google-generative-ai / google-vertex");
  log("    * bedrock-converse-stream");
  log("    * mistral-conversations");

  log("\n[2] Cơ chế cấu hình Provider trong đường NHÚNG SDK (Embedded SDK Path):");
  log("  - Model configuration là plain TypeScript object (Model<TApi>):");
  log(`    { baseUrl: "${LLM_BASE_URL}", api: "openai-completions", provider: "custom" }`);
  log("  - Cơ chế cấp phát Credential:");
  log("    * Trực tiếp qua options.apiKey");
  log("    * Động qua getApiKey(provider: string) callback (phù hợp token xoay vòng / expiring tokens)");
  log("    * Tuỳ biến request headers qua custom headers object (hỗ trợ gateway / auth proxy)");

  log("\n[3] Thực nghiệm gọi 2 model khác nhau (STRONG và CHEAP) qua custom provider endpoint:");

  const testModels = [
    { name: "STRONG", id: LLM_MODEL_STRONG },
    { name: "CHEAP", id: LLM_MODEL_CHEAP },
  ];

  for (const m of testModels) {
    log(`\n  --- Đang test model ${m.name}: ${m.id} ---`);
    const model = createModel(m.id);
    const context = {
      systemPrompt: "You are a test assistant. Answer in 1 short sentence.",
      messages: [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: `Ping from Desktop Assistant SP-6 test for ${m.name} model.` }],
          timestamp: Date.now(),
        },
      ],
    };

    const start = Date.now();
    const stream = openAiStreamSimple(model, context, { apiKey: LLM_API_KEY });
    let text = "";
    for await (const event of stream) {
      if (event.type === "text_delta") {
        text += event.delta;
      }
    }
    const finalResult = await stream.result();
    const duration = Date.now() - start;

    log(`  -> Phản hồi (${duration}ms): "${text.trim()}"`);
    log(`  -> Token Usage: Input: ${finalResult.usage?.input}, Output: ${finalResult.usage?.output}, Total: ${finalResult.usage?.totalTokens}`);
    log(`  -> Stop reason: ${finalResult.stopReason}`);
  }

  log("\n[4] Phân tích đối chiếu lệnh CLI '/login' vs SDK Nhúng:");
  log("  - Bản chất của Pi:");
  log("    * Pi là phần mềm mã nguồn mở MIT do Mario Zechner & Armin Ronacher tạo ra.");
  log("    * Pi KHÔNG bán dịch vụ hay bán subscription (không có cái gọi là 'Pi Subscription').");
  log("    * Trên Pi CLI, '/login' là một lệnh interactive mở trình duyệt hoặc hiển thị device code");
  log("      để người dùng đăng nhập tài khoản Anthropic / GitHub / Google của chính họ.");
  log("  - Trên ứng dụng nhúng (Electron / Desktop Assistant):");
  log("    * KHÔNG có terminal shell để gõ '/login'.");
  log("    * Ứng dụng Desktop Assistant sẽ cung cấp giao diện Settings UI (hoặc màn hình onboarding),");
  log("      người dùng nhập API key hoặc thực hiện OAuth (SP-13) qua cửa sổ Electron.");
  log("    * Sau đó, Desktop Assistant lưu credential vào OS secure storage (SP-11) và truyền");
  log("      vào pi-agent SDK qua tham số apiKey hoặc customStreamFn.");

  log("\n================================================================================");
  log("KẾT LUẬN Q5 & KIẾN NGHỊ SỬA FR-AG-11:");
  log("1. Provider Layer của Pi hỗ trợ xuất sắc Custom Provider và OpenAI-compatible endpoints.");
  log("2. Không tồn tại 'Pi subscription'. Lời văn hiện tại trong FR-AG-11:");
  log("   'cấu hình provider theo đúng cơ chế providers của pi agents (subscription qua /login OAuth, API key...)'");
  log("   là do nhầm lẫn giữa affordance giao diện dòng lệnh (CLI interactive) với API của SDK nhúng.");
  log("3. KIẾN NGHỊ SỬA LỜI VĂN FR-AG-11:");
  log("   'App cung cấp UI cấu hình provider (hỗ trợ API key của các nhà cung cấp OpenAI, Anthropic, Google,");
  log("   hoặc custom endpoint tương thích OpenAI); credential lưu trong secure storage của OS (NFR-SEC-01)...'");
  log("================================================================================");

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, logLines.join("\n"), "utf-8");
  console.log(`\nSaved evidence log to ${logPath}`);
}

runQ5Test().catch((err) => {
  console.error("Q5 Test failed:", err);
  process.exit(1);
});
