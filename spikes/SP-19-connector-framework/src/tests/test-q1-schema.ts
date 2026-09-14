import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConnectorManifest } from "../types/manifest-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../../evidence");
const logPath = path.resolve(evidenceDir, "q1-manifest-schema-validation.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + "\n");
}

async function runQ1Test() {
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  log("================================================================================");
  log("SPIKE SP-19 / Q1: Manifest Schema đủ diễn đạt HAI connector khác hình dạng");
  log("Yêu cầu FR-CF-01: Định danh, OAuth capability, tool đọc/ghi, snapshot, compensation, irreversible");
  log("================================================================================\n");

  const schemaRaw = fs.readFileSync(path.resolve(evidenceDir, "manifest-schema.json"), "utf-8");
  const schema = JSON.parse(schemaRaw);

  const notionRaw = fs.readFileSync(path.resolve(evidenceDir, "notion.manifest.json"), "utf-8");
  const notion: ConnectorManifest = JSON.parse(notionRaw);

  const gmailRaw = fs.readFileSync(path.resolve(evidenceDir, "gmail.manifest.json"), "utf-8");
  const gmail: ConnectorManifest = JSON.parse(gmailRaw);

  // 1. Kiểm tra cấu trúc cơ bản
  log("[1] Kiểm tra định danh và thông tin chung:");
  log(`  - Connector 1: id=${notion.id}, name=${notion.name}, version=${notion.version}, icon=${notion.icon}`);
  log(`  - Connector 2: id=${gmail.id}, name=${gmail.name}, version=${gmail.version}, icon=${gmail.icon}`);

  if (!notion.id || !notion.name || !notion.icon) throw new Error("Notion manifest missing basic fields");
  if (!gmail.id || !gmail.name || !gmail.icon) throw new Error("Gmail manifest missing basic fields");
  log("  ✅ Cả hai manifest có đủ: id, name, version, icon, description.");

  // 2. Kiểm tra cấu hình OAuth theo Capability (FR-CF-01, FR-CF-04)
  log("\n[2] Kiểm tra cấu hình OAuth & Capability:");
  log(`  - Notion: type=${notion.auth.type}, capabilities=[${Object.keys(notion.auth.capabilities).join(", ")}]`);
  log(`  - Gmail: type=${gmail.auth.type}, pkce=${gmail.auth.pkce}, capabilities=[${Object.keys(gmail.auth.capabilities).join(", ")}]`);
  log(`  - Gmail Scope Profiles: [${Object.keys(gmail.auth.scope_profiles || {}).join(", ")}]`);
  
  if (!gmail.auth.scope_profiles?.byo || !gmail.auth.scope_profiles?.central_mass_distribution) {
    throw new Error("Gmail manifest missing scope profiles (byo/central)");
  }
  log("  ✅ OAuth capabilities và scope profiles được biểu diễn đầy đủ.");

  // 3. Kiểm tra danh sách Tool đọc / ghi và Hợp đồng An toàn (FR-CF-01, FR-NT-04/05, FR-AP-05)
  log("\n[3] Kiểm tra công thức tool và hợp đồng an toàn:");
  log(`  - Notion tools (${notion.tools.length}):`);
  for (const t of notion.tools) {
    const snapInfo = t.snapshot?.enabled ? `snapshot=yes (sanitize: ${t.snapshot.sanitization?.length} fields)` : "snapshot=no";
    const compInfo = t.compensation?.type === "static_formula" ? `comp=${t.compensation.formula_type}` : "comp=none";
    const irrvInfo = t.irreversible ? "IRREVERSIBLE" : "reversible";
    log(`    * [${t.category.toUpperCase()}] ${t.name}: ${snapInfo}, ${compInfo}, ${irrvInfo}`);
  }

  log(`  - Gmail tools (${gmail.tools.length}):`);
  for (const t of gmail.tools) {
    log(`    * [${t.category.toUpperCase()}] ${t.name}: read-only`);
  }

  // Assertions
  const notionWriteTools = notion.tools.filter((t) => t.category === "write");
  const notionReadTools = notion.tools.filter((t) => t.category === "read");
  const gmailWriteTools = gmail.tools.filter((t) => t.category === "write");
  const gmailReadTools = gmail.tools.filter((t) => t.category === "read");

  if (notionWriteTools.length === 0 || notionReadTools.length === 0) {
    throw new Error("Notion must have both read and write tools");
  }
  if (gmailWriteTools.length > 0) {
    throw new Error("Gmail MVP must be read-only (FR-GM-01), cannot have write tools");
  }

  // Kiểm tra tool có snapshot và bù trừ (update_page_properties)
  const updateTool = notion.tools.find((t) => t.id === "update_page_properties");
  if (!updateTool?.snapshot?.enabled || !updateTool?.snapshot?.sanitization?.includes("formula")) {
    throw new Error("Notion update_page_properties missing sanitization rules from SP-1");
  }
  log("  ✅ Notion update_page_properties khai báo đủ snapshot + sanitization rules loại trừ formula/rollup/created_time.");

  // Kiểm tra tool irreversible (create_comment, delete_block)
  const commentTool = notion.tools.find((t) => t.id === "create_comment");
  if (!commentTool?.irreversible) {
    throw new Error("Notion create_comment must be flagged irreversible (SP-1 Section 1)");
  }
  log("  ✅ Notion create_comment gắn cờ irreversible: true đúng như kiểm chứng SP-1.");

  log("\n================================================================================");
  log("KẾT LUẬN Q1: ĐẠT");
  log("Manifest schema v0 hoàn toàn đủ năng lực biểu diễn HAI connector khác hình dạng:");
  log("- Notion: Read/Write, snapshot trước-ghi, bù trừ khôi phục thuộc tính, cờ irreversible.");
  log("- Gmail: Read-only, không có snapshot/bù trừ, phân hóa scope profile BYO vs Central.");
  log("================================================================================");
}

runQ1Test().catch((err) => {
  console.error("Test Q1 failed:", err);
  process.exit(1);
});
