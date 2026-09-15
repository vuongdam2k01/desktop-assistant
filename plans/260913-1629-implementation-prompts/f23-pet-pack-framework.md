# F23 — Pet pack framework

Đọc trước: README.md §1, §3, §4, §5 (Q-PACK-1/2 trùng OQ-3/OQ-4). Worktree `feat/f23-pet-pack-framework`.
Phụ thuộc: F13, F17, F22 merged. Sở hữu: `packages/pet-pack`; điểm nối: `renderer-app` settings pet, `renderer-pet`
loader, backend static built-in templates.

## Mục tiêu
"Pet pack" là đơn vị: manifest + `.riv` (≤5 MB) + persona spec có cấu trúc; hai nguồn (built-in templates read-only theo
release; account packs người dùng tạo, replicate); import validate atomic; resolver degrade per-capability về default;
persona composer cấp advisory layer cho pet-agent; Rive contract 2.0.0 (hai lớp) là interface khai báo.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` II (persona không được authorize), VII, Reserved By Design.
- `docs/spec/capabilities/pet/spec.md` (asset pipeline, two-layer, all text from pet-agent), `capabilities/sync/spec.md`
  (store declares conflict rule), `capabilities/app/spec.md` (settings pet).
- `docs/spec/changes/req-024-pet-pack-framework/` — `proposal.md`, `design.md` (Pack library, Import path, Pack resolver,
  Persona composer), `model.md`, `impact.md`, `clarifications.md`, `contracts/pet-pack-manifest.md/.schema.json`,
  `contracts/rive-state-machine.md/.schema.json/.set-state.schema.json` (2.0.0), `contracts/pet-pack-store.descriptor.json`,
  `contracts/pet-pack-store.sql`, `specs/app|backend|pet|sync/spec.md`.
- `docs/spec/changes/req-005-electron-rive-pet-render/`, `req-018-pet-liveness/` (những gì 2.0.0 hợp nhất).
- PRD `docs/raw-idea/prd-mvp.md` S-C2 (nhiều skin), OQ-3, OQ-4.
- Spike: `spikes/SP-3-electron-rive/REPORT.md` Q6 + `macos/REPORT.md` Q7 (swap), `spikes/SP-18-pet-liveness/REPORT.md`
  Q19/Q20.
- `docs/spec/risks.md`: RISK-027, 028, 083.

## Phạm vi (in)
- Pack format: thư mục/zip gồm `manifest.json` (identity, version, author, preview, capabilities khai: locomotion layer,
  work-status layer, ack lines languages…, contract target 2.0.0), `pet.riv`, `persona.json` (schema: name, languages,
  talkativeness, ack line set per language, bounded description).
- Import: validate manifest schema; validate `.riv` mở được và có artboard/machine/inputs theo contract 2.0.0 (phần
  thiếu → ghi capability thiếu, không fail nếu manifest không khai); validate persona; ack lines kiểm quy tắc "chỉ xác
  nhận đã nhận" (lexical); ≤5 MB; ghi atomic vào store (`pet-pack-store.sql`, descriptor conflict rule khai).
- Library: built-in templates (đóng gói theo release + tuỳ chọn tải từ backend static, read-only), account packs (F22
  replicate); active pack selection là config account-owned (LWW-preserve).
- Resolver: per-capability: pack thiếu locomotion → default locomotion; thiếu work-status → default; thiếu ack language
  → fallback language; shipped default là terminal fallback luôn có.
- Persona composer: cung cấp persona của pack active cho F13 pet-agent như advisory (system prompt fragment + ack line
  set); không đường nào từ persona tới F4/F1.
- Hot-swap: đổi pack → F17 reload `.riv` + rebind inputs không restart; F13 đổi persona cho job mới.
- Settings UI (F21 slot): danh sách pack, preview, chọn active, import file, xoá account pack.
- Default pack ship sẵn: hiện thực persona draft từ F13 + `.riv` placeholder F17 đúng format pack.

## Ngoài phạm vi
Pet 3D, marketplace, editor Rive, asset thật (content phase), pet memory.

## Tiêu chí hoàn thành
1. Mọi scenario req-024 specs có test pass.
2. Import pack hợp lệ/không hợp lệ/thiếu layer → kết quả đúng; pack >5 MB từ chối.
3. Đổi pack active → pet render mới + ack lines mới không restart; device thứ hai nhận pack qua F22.
4. Persona text không xuất hiện trong bất kỳ input của F4 (test).
5. Report nêu Q-PACK-1/2 chờ nội dung/design.
