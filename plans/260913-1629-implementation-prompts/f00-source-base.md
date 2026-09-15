# F0 — Dựng source base (monorepo)

Đọc trước: `plans/260913-1629-implementation-prompts/README.md` §1 (ràng buộc chung), §3, §4.

## Bối cảnh
Repo `/home/<user>/projects/desktop-assistant` chỉ có `docs/`, `spikes/`, `plugins/`, `plans/`; chưa có mã sản
phẩm. Đây là bước 0 của 24 tính năng trong `plans/reports/feature-map-260913-1606-implementation-features.md`
(đọc §1, §2, mục F0 ở §3, §4, §6). Sản phẩm: Electron desktop (Windows 10+, macOS 13+) với pet 2D Rive,
hệ agent trên pi agents SDK, trust chain (ledger SQLite append-only, undo bù trừ, approval gate ngoài LLM),
backend peer Fastify + PostgreSQL. Stack khoá theo ADR-001..009 tại `docs/raw-idea/prd-mvp.md` §14.2.

## Mục tiêu
Khung monorepo để F1..F24 có chỗ đứng, **không hành vi nghiệp vụ**: app rỗng chạy trên hai OS, backend trả
health, toolchain, CI, build check bắt buộc, composition root "một dòng đăng ký mỗi module".

## Tài liệu bắt buộc đọc
1. `docs/spec/constitution.md` (II, III, VI, VIII, Spec Persistence, Evidence Discipline); `docs/spec/roadmap.md`.
2. `docs/spec/capabilities/platform/spec.md`: "local store reached without compiling anything" (better-sqlite3
   thế hệ Node-API prebuilt, cấm thế hệ bind engine Electron — RISK-046); "native components loaded from files
   on disk" (asarUnpack `*.node`); "transparent regions render in every session" (`disableHardwareAcceleration`
   khi VM/RDP/headless); "no administrator elevation"; các cấm: suspend process khác, synthetic input, di
   chuyển pointer.
3. `docs/spec/capabilities/agent/spec.md`: "harness pinned to one package identity and one version".
4. `docs/spec/capabilities/pet/spec.md`: cấu hình cửa sổ pet. `docs/spec/capabilities/app/spec.md`: Dock presence
   macOS, đóng cửa sổ = về tray. `docs/spec/capabilities/backend/spec.md`: health kiểm tra DB, version check public.
   `docs/spec/capabilities/uix/spec.md`: mọi string qua tầng i18n vi/en.
5. Changes: `req-007-pi-sdk-harness` (pin; contracts `provider-profile`, `tool-wrapping`, `agent-session`),
   `req-013-sqlite-ledger` (design.md: native binding, packaging), `req-005-electron-rive-pet-render`
   (BrowserWindow config, contract `rive-state-machine`), `req-008-pet-window-os` + `req-023-macos-platform-baseline`
   (hai native module riêng; contract `window-integration-module`; `x64ArchFiles: "*.node"`; `app.setName`
   khoá `DesktopAssistant` — RISK-078), `req-016-signing-update` (electron-builder, `autoInstallOnAppQuit:false`,
   `verifyUpdateCodeSignature:true`), `req-020-backend-slice` (Fastify; contract `public-service-endpoints.openapi.yaml`),
   `req-002-gui-spike-harness`.
6. Spike seed: `spikes/SP-6-pi-sdk/REPORT.md` §6 (**identity + version chính xác của pi SDK**, không tự đoán) và
   §4; `spikes/SP-12-sqlite-ledger/REPORT.md` (+ `macos/`): better-sqlite3, asarUnpack, BOM (RISK-047), test
   runner cross-platform (RISK-048); `spikes/SP-3-electron-rive/`; `spikes/SP-7-pet-window-os/REPORT.md` §3.1
   (napi-rs `desktop-window-win32`) + `macos/`; `spikes/SP-16-signing-update/`; `spikes/SP-20-backend-slice/`;
   `spikes/SP-0-gui-harness/src/`.
7. `docs/spec/risks.md`: RISK-035, 046, 047, 048, 078, 080, 081, 082.

## Phạm vi (in)
**Monorepo & toolchain**: pnpm workspaces + Turborepo; TS strict; ESLint + Prettier; vitest; Node pin
(`.nvmrc`, `engines`); lockfile commit.

**Layout** (kebab-case):
- `apps/desktop`: `main/` (composition root `index.ts` một dòng/module), `preload/`, `renderer-pet/`,
  `renderer-app/` (React + TS + Tailwind, tầng i18n vi/en).
- `apps/backend`: Fastify + TS + PostgreSQL; composition root `src/app.ts` một dòng/plugin; migration framework;
  `docker-compose` Postgres dev; env qua biến môi trường.
- `packages/contracts`: types sinh từ `docs/spec/**/contracts/*.schema.json`, `*.openapi.yaml`, `*.sql`. Contract
  xuất hiện nhiều version (`connector-manifest` 0.1.0→1.1.0→1.2.0, `rive-state-machine` 0.1.0→2.0.0,
  `rule-representation` 0.1.0→1.0.0, `update-feed` req-016/req-023): sinh từ **version cao nhất**, ghi bảng
  contract → nguồn → version trong README package. Không sửa `docs/spec/`.
- `packages/` (trống, không tạo package rỗng thừa), `connectors/` (trống).
- `native/win32-window` (Rust, napi-rs, chỉ build trên Windows), `native/macos-window` (Swift/ObjC, chỉ macOS):
  skeleton export `capabilities()` theo contract `window-integration-module`, chưa logic.
- `tooling/`: script build check.

**Build check (fail, không warn)**: (a) harness pin — fail nếu lockfile resolve distribution tương tự tên của
pi SDK hoặc version lệch pin; (b) sqlite binding — fail nếu dependency là thế hệ compile theo engine Electron;
(c) packaging — fail nếu artefact không extract `*.node` ra file; (d) lint cấm BOM trong file cấu hình.

**App rỗng**: `app.setName('DesktopAssistant')`; cửa sổ pet `transparent:true, frame:false,
backgroundColor:'#00000000', hasShadow:false, backgroundThrottling:false`, always-on-top, placeholder trong
suốt; cửa sổ app React rỗng có switch vi/en; tray menu Mở app / Thoát; đóng app window = về tray;
`disableHardwareAcceleration` khi VM/RDP/headless; macOS activation policy Accessory ↔ Regular theo cửa sổ app.

**Backend**: `GET /v1/health` kiểm tra DB thật; `GET /v1/app/version` manifest tĩnh placeholder; logger có
redaction skeleton; rate-limit plugin để chỗ.

**CI**: GitHub Actions matrix ubuntu/windows/macos: install, lint, typecheck, test, build check; Windows runner
Rust + VS C++; macOS Xcode; job packaging unsigned upload artefact.

## Ngoài phạm vi
Ledger, job manager, credential store, gate, wrapping, routing, connector, agent, Rive asset thật, native logic,
ký số, auto-update, sync, UI nghiệp vụ.

## Tiêu chí hoàn thành
1. Máy sạch không C++ toolchain: `pnpm install && pnpm build && pnpm test` pass, không compile sqlite binding.
2. `pnpm dev`: pet window trong suốt always-on-top + app window (vi/en) + tray; đóng app không thoát; chạy
   dưới user không admin.
3. Backend dev với Postgres docker: `/v1/health` healthy; dừng DB → unhealthy.
4. Bốn build check có test chứng minh fail đúng lúc.
5. `packages/contracts` sinh types từ toàn bộ contract, có bảng version; `pnpm typecheck` pass.
6. CI xanh ba OS; artefact unsigned có `*.node` ngoài asar.
7. README gốc: layout, lệnh, cách thêm package cho tính năng tiếp theo, bảng "spec → nơi thực thi".
8. Report `plans/reports/`, kết thúc bằng câu hỏi chưa giải quyết.

Bắt đầu bằng đọc tài liệu, rồi trình plan.
