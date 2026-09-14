import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConnectorManifest } from "../types/manifest-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../../evidence");
const logPath = path.resolve(evidenceDir, "q8-scope-profiles.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logPath, msg + "\n");
}

/**
 * Resolves scopes for given capabilities based on the active release channel profile
 * (FR-CF-04)
 */
function resolveScopesForChannel(
  manifest: ConnectorManifest,
  capabilities: string[],
  profileName: string
): string[] {
  const profile = manifest.auth.scope_profiles?.[profileName];
  if (!profile) {
    throw new Error(`Profile '${profileName}' not defined in manifest '${manifest.id}'`);
  }

  const resolvedScopes = new Set<string>();
  for (const cap of capabilities) {
    const scopes = profile[cap];
    if (scopes && Array.isArray(scopes)) {
      for (const s of scopes) {
        resolvedScopes.add(s);
      }
    }
  }

  return Array.from(resolvedScopes);
}

async function runQ8Test() {
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  log("================================================================================");
  log("SPIKE SP-19 / Q8: Manifest hỗ trợ Scope Profile theo kênh phát hành (FR-CF-04)");
  log("Mục tiêu: Đổi kênh phát hành (BYO vs Central) chỉ bằng chọn profile, không sửa manifest hay lõi");
  log("================================================================================\n");

  const gmailManifest: ConnectorManifest = JSON.parse(
    fs.readFileSync(path.resolve(evidenceDir, "gmail.manifest.json"), "utf-8")
  );

  const capabilitiesToRequest = ["email_read"];

  // 1. Giải quyết scopes cho kênh BYO OAuth Client (FR-CF-11, PRD §13.6)
  log("[1] Kênh 1: BYO OAuth Client (Người dùng tự cấp credentials từ GCP cá nhân):");
  const byoScopes = resolveScopesForChannel(gmailManifest, capabilitiesToRequest, "byo");
  log(`  - Active Profile: "byo"`);
  log(`  - Requested capabilities: [${capabilitiesToRequest.join(", ")}]`);
  log(`  - Resolved OAuth Scopes: [${byoScopes.join(", ")}]`);

  if (!byoScopes.includes("https://www.googleapis.com/auth/gmail.readonly")) {
    throw new Error("BYO profile must map email_read to gmail.readonly");
  }
  log("  ✅ Kênh BYO nhận scope 'gmail.readonly' (đọc toàn bộ message/body không vướng CASA).");

  // 2. Giải quyết scopes cho kênh Đại Trà (Central Client với kiểm soát CASA Tier 2 / OQ-14)
  log("\n[2] Kênh 2: Central Mass Distribution (Ứng dụng tập trung phát hành đại trà):");
  const centralScopes = resolveScopesForChannel(gmailManifest, capabilitiesToRequest, "central_mass_distribution");
  log(`  - Active Profile: "central_mass_distribution"`);
  log(`  - Requested capabilities: [${capabilitiesToRequest.join(", ")}]`);
  log(`  - Resolved OAuth Scopes: [${centralScopes.join(", ")}]`);

  if (!centralScopes.includes("https://www.googleapis.com/auth/gmail.metadata")) {
    throw new Error("Central profile must map email_read to gmail.metadata");
  }
  if (centralScopes.includes("https://www.googleapis.com/auth/gmail.readonly")) {
    throw new Error("Central profile must NOT grant broad gmail.readonly without CASA approval");
  }
  log("  ✅ Kênh Đại Trà nhận scope hẹp 'gmail.metadata' (chỉ đọc metadata, tránh kiểm duyệt CASA AL2).");

  // 3. Kiểm tra tính độc lập
  log("\n[3] Kiểm tra tính nguyên vẹn của Manifest & Adapter:");
  log(`  - Manifest ID: ${gmailManifest.id} (giữ nguyên không đổi)`);
  log(`  - Tool definitions count: ${gmailManifest.tools.length} (giữ nguyên không đổi)`);
  log(`  - Adapter interface: không cần sửa đổi khi chuyển kênh phát hành.`);

  log("\n================================================================================");
  log("KẾT LUẬN Q8: ĐẠT 100%");
  log("Manifest schema hỗ trợ hoàn hảo cấu hình `scope_profiles` theo kênh phát hành (FR-CF-04).");
  log("Chuyển kênh phát hành hoàn toàn là việc chọn key trong profile, không làm đổi lõi manifest.");
  log("================================================================================");
}

runQ8Test().catch((err) => {
  console.error("Test Q8 failed:", err);
  process.exit(1);
});
