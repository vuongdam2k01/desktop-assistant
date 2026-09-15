# F24 — Đóng gói, ký số, auto-update

Đọc trước: README.md §1, §3, §4, §5 (**mua chứng chỉ trước**). Worktree `feat/f24-packaging-signing-update`.
Phụ thuộc: F18, F21 merged (F10 feed đã có). Sở hữu: `tooling/release`, `apps/desktop/main/updater`, cấu hình
electron-builder, CI release workflow; điểm nối: `renderer-app` update card payload.

## Điều kiện trước
Cloud signing Windows (Azure Trusted Signing hoặc SSL.com eSigner) và Apple Developer Program (Developer ID
Application) phải sẵn sàng; credential đưa vào CI secret manager, không bao giờ vào repo. Nếu chưa có, làm toàn bộ
pipeline với identity test/self-signed ở nhánh riêng và **không** publish qua feed; ghi trạng thái procurement trong
report.

## Mục tiêu
electron-builder đóng gói NSIS (Windows) và zip+dmg per-arch (macOS); ký Authenticode SHA-256 + RFC 3161 trong CI;
Apple Developer ID + hardened runtime + notarization; identity không đổi giữa các bản; feed per OS/arch tĩnh trên
backend; updater kiểm định kỳ, tải nền, `autoInstallOnAppQuit:false`, hoãn khi job running, `verifyUpdateCodeSignature`.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` VIII (auto-update là luồng chính thức, dùng từ người dùng đầu tiên).
- `docs/spec/capabilities/platform/spec.md`: packages and signs releases with cloud Authenticode; update lifecycle
  background + job-aware; native loaded from files on disk; macOS signed with Developer ID and notarised; update
  preserves signing identity; local store without compiling.
- `docs/spec/capabilities/backend/spec.md`: version checks + static manifest (Range 206); manifest per OS/arch;
  package format rejected at publication. `capabilities/app/spec.md`: closing is not quitting + no silent install.
- `docs/spec/changes/req-016-signing-update/` — `proposal.md`, `design.md` (CI signing, Update Coordinator, Job Lock
  Guard), `model.md`, `contracts/update-feed.md/.openapi.yaml/.schema.json`, `specs/app|backend|platform/spec.md`.
- `docs/spec/changes/req-023-macos-platform-baseline/` — `design.md`, `contracts/update-feed.*` (per OS/arch),
  `specs/platform|backend|app/spec.md`; `req-012` (Keychain binding), `req-011/012 macos risks`.
- PRD `docs/raw-idea/prd-mvp.md` ADR-009, FR-APP-06, FR-BE-09.
- Spike: `spikes/SP-16-signing-update/REPORT.md` (Q1 ký CI, Q3 feed tĩnh + SHA-512, Q4 WinVerifyTrust, Q5 quit behaviour,
  RISK-051/052/053) + `macos/REPORT.md` (Q4 zip vs dmg, Gatekeeper Sequoia RISK-086, identity RISK-087),
  `spikes/SP-11-secure-storage/macos/REPORT.md` Q3, `spikes/SP-12-sqlite-ledger/macos/REPORT.md` (`x64ArchFiles`),
  `spikes/SP-22-macos-permissions/REPORT.md` §4.
- `docs/spec/risks.md`: RISK-035, 051, 052, 053, 077, 080, 084, 086, 087.

## Phạm vi (in)
- electron-builder config: appId cố định, productName `DesktopAssistant`, `asarUnpack` native, NSIS (perMachine false, không
  cần elevation), mac `hardenedRuntime`, entitlements tối thiểu, `notarize`, target zip (updater) + dmg (tải tay), per-arch
  (x64, arm64) — universal chỉ nếu `x64ArchFiles: "*.node"`; `autoInstallOnAppQuit:false`, `verifyUpdateCodeSignature:true`,
  publish `generic` tới feed backend `/updates/{os}/{arch}/`.
- CI release workflow: build matrix Windows/macOS, ký qua cloud signing (Windows) + `codesign`/`notarytool` (macOS) với
  secrets, check identity không đổi so với bản trước (script so sánh subject/Team ID), publish latest.yml + blockmap +
  installer/zip; gate: publication rejected nếu format không cài được bởi updater của OS đó; secret scan.
- Updater (main `updater`): check định kỳ (cấu hình), download nền, sự kiện → SYSTEM card "update ready: restart /
  postpone" (F19 payload); Job Lock Guard hỏi F2 jobs `running` → hoãn, cảnh báo; `quitAndInstall` chỉ sau xác nhận;
  version check unreachable → tiếp tục chạy + báo.
- Dev/test identity: tài liệu hoá RISK-084 (ad-hoc signing prompt Keychain) và cách dùng named certificate local.
- Uninstall hook Windows/macOS gọi erasure F3 (platform spec "credentials removed on uninstall").
- Test: e2e update loop trên CI (v1 → v2 signed) hai OS; tampered installer → WinVerifyTrust từ chối, xoá payload;
  update khi job running → hoãn; identity mismatch → pipeline fail.

## Ngoài phạm vi
Telemetry (ADR-008 hoãn), store distribution, delta update ngoài blockmap.

## Tiêu chí hoàn thành
1. Mọi scenario platform/backend/app spec thuộc F24 có test pass.
2. Update loop hai OS xanh với identity thật (hoặc test identity ghi rõ chưa distributable).
3. macOS: sau update, Keychain credential đọc không prompt (F3 test), TCC giữ.
4. Job running → không restart tự động; xác nhận → cài.
5. Report: trạng thái chứng chỉ/Apple program, RISK-051 hướng dẫn người dùng bản đầu.
