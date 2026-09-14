import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "@earendil-works/pi-agent-core";
import { ToolGenerator } from "../generator/tool-generator.js";
import { NotionAdapter } from "../adapters/notion-adapter.js";
import { createModel, customStreamFn, loadNotionFixtures, NOTION_TOKEN_A } from "../client.js";
import type { ConnectorManifest } from "../types/manifest-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../../evidence");
const logPath = path.resolve(evidenceDir, "q2-tool-generation.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + "\n");
}

async function runQ2Test() {
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  log("================================================================================");
  log("SPIKE SP-19 / Q2: Sinh tool động từ manifest & đăng ký vào harness pi");
  log("Mục tiêu: Chứng minh Agent gọi được tool sinh tự động mà không cần code đặc thù.");
  log("================================================================================\n");

  // 1. Đọc manifest Notion
  const notionRaw = fs.readFileSync(path.resolve(evidenceDir, "notion.manifest.json"), "utf-8");
  const manifest: ConnectorManifest = JSON.parse(notionRaw);

  // 2. Khởi tạo adapter với token thật
  const adapter = new NotionAdapter({ accessToken: NOTION_TOKEN_A });

  // 3. Sinh tool động qua ToolGenerator
  log(`[1] Đang sinh tool từ manifest '${manifest.id}' (${manifest.tools.length} tool khai báo)...`);
  const generatedTools = ToolGenerator.generateTools(manifest, adapter);

  log(`  -> Đã sinh thành công ${generatedTools.length} AgentTool cho harness Pi:`);
  for (const t of generatedTools) {
    log(`     * Tool: "${t.name}" | Label: "${t.label}"`);
  }

  if (generatedTools.length !== manifest.tools.length) {
    throw new Error(`Tool generation mismatch: expected ${manifest.tools.length}, got ${generatedTools.length}`);
  }

  // 4. Đăng ký trực tiếp vào Pi Agent
  const fixtures = loadNotionFixtures();
  const dbId = fixtures?.workspaces?.A?.databases?.[0]?.id || "3d8c0043-56ec-81cf-a480-e9e679285df6";
  const model = createModel();

  log(`\n[2] Khởi tạo Pi Agent với ${generatedTools.length} tool sinh động (Model: ${model.id})...`);
  const agent = new Agent({
    streamFn: customStreamFn,
    initialState: {
      model,
      systemPrompt: "You are a helpful assistant with access to Notion tools. Only use tools provided.",
      tools: generatedTools,
    },
  });

  let toolExecutedName = "";
  let toolParamsUsed: any = null;
  let executionSuccess = false;

  agent.subscribe((event) => {
    if (event.type === "tool_execution_start") {
      toolExecutedName = event.toolName;
      toolParamsUsed = (event as any).params;
      log(`  ⚡ [Event] Pi Agent bắt đầu gọi tool sinh động: ${event.toolName}`);
    }
    if (event.type === "tool_execution_end") {
      executionSuccess = !(event as any).error;
      log(`  ✅ [Event] Pi Agent hoàn tất gọi tool: ${event.toolName}, success=${executionSuccess}`);
    }
  });

  const prompt = `Hãy truy vấn danh sách task trong database có id "${dbId}". Trả về số lượng task tìm thấy.`;
  log(`\n[3] Gửi prompt tới Agent: "${prompt}"`);

  await agent.prompt(prompt);

  const messages = agent.state.messages;
  const lastMsg = messages[messages.length - 1];
  const responseText =
    lastMsg && lastMsg.role === "assistant"
      ? lastMsg.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join(" ")
      : "";

  log(`\n[4] Phản hồi cuối cùng từ Agent:\n${responseText.trim()}`);

  log(`\n[5] Kiểm tra thực tế:`);
  log(`  - Tool được gọi: "${toolExecutedName}"`);
  log(`  - Params truyền vào: ${JSON.stringify(toolParamsUsed)}`);
  log(`  - Thực thi thành công: ${executionSuccess}`);

  if (toolExecutedName !== "notion_query_database") {
    throw new Error(`Expected agent to call notion_query_database, but got '${toolExecutedName}'`);
  }
  if (!executionSuccess) {
    throw new Error("Tool execution failed unexpectedly");
  }

  log("\n================================================================================");
  log("KẾT LUẬN Q2: ĐẠT 100%");
  log("1. Tool sinh động từ manifest đăng ký vào Pi harness chạy hoàn hảo.");
  log("2. Pi Agent phân tích schema tham số (TypeBox), tự động điền database_id hợp lệ,");
  log("   và gọi tool trực tiếp mà KHÔNG cần một dòng code đặc thù nào trong harness.");
  log("================================================================================");
}

runQ2Test().catch((err) => {
  console.error("Test Q2 failed:", err);
  process.exit(1);
});
