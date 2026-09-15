# F17 — Pet rendering (Electron + Rive)

Đọc trước: README.md §1, §3, §4, §5 (Q-OQ-4 dùng placeholder). Worktree `feat/f17-pet-rendering`. Phụ thuộc: F0 merged.
Sở hữu: `apps/desktop/renderer-pet` (trừ `bubble/` của F19), `apps/desktop/main/pet-window`.

## Mục tiêu
Cửa sổ pet trong suốt luôn nổi, Rive runtime nạp `.riv` từ disk, state machine **hai lớp** (locomotion × work
status) theo contract 2.0.0, ≥30 fps dưới tải, transparency sạch, vị trí nhớ qua phiên, multi-display an toàn,
hot-swap asset, soak 8 h.

## Tài liệu bắt buộc đọc
- `docs/spec/capabilities/pet/spec.md`: always on top & freely positioned (restart, fullscreen foreground, saved
  position off-screen); animation reflects system state (5 work states, input 0–4, blend 150–250 ms, ưu tiên
  waiting_approval); visibility user-controlled (tray, không dừng job); holds relative position across display
  changes; frame rate under load; runs 8 h; rendering engine ≥30 fps + zero halo; asset pipeline Uint8Array + runtime
  swap; restore bounds safely (bottom-right primary; per-monitor DPI); two-layer animation state machine.
- `docs/spec/capabilities/platform/spec.md`: transparent regions in every session (`disableHardwareAcceleration`).
- `docs/spec/changes/req-005-electron-rive-pet-render/` — `proposal.md`, `design.md`, `model.md`,
  `contracts/rive-state-machine.md/.schema.json/.set-state.schema.json` (0.1.0 lịch sử).
- `docs/spec/changes/req-024-pet-pack-framework/contracts/rive-state-machine.*` (**2.0.0** — hai lớp; dùng version này),
  `req-018-pet-liveness/design.md` (two-layer orthogonality; locomotion controller thuộc F20 nhưng input layer phải
  có sẵn).
- `docs/spec/changes/req-008-pet-window-os/design.md` (multi-display algorithm §3.2 của SP-7), `req-023` (RISK-082 idle
  fps).
- PRD `docs/raw-idea/prd-mvp.md` FR-PET-01, 02, 07; NFR-PF-01, 04; NFR-RL-04; NFR-CP-02; ADR-002.
- Spike: `spikes/SP-3-electron-rive/REPORT.md` (Q1 60 fps, Q2 transition 2,9–15,1 ms, Q3 pixel alpha, Q6 buffer load) và
  `macos/REPORT.md` (Q7 swap, RISK-082 390 MB idle, RISK-083 deprecation → dùng stateMachine API), `spikes/SP-7-pet-window-os/REPORT.md`
  Q4/Q5 (bounds), `spikes/SP-18-pet-liveness/REPORT.md` Q19/Q20.
- `docs/spec/risks.md`: RISK-003, 027, 028, 082, 083.

## Phạm vi (in)
- Pet window (main): BrowserWindow theo config đo (transparent, frame false, `#00000000`, hasShadow false,
  backgroundThrottling false, alwaysOnTop screen-saver level, skipTaskbar, không resizable); lưu/khôi phục bounds
  (device-local, không replicate); kiểm tra bounds giao work area nào → không → bottom-right primary; DPI normalise;
  display-removed/scale-changed handlers.
- Renderer-pet: Rive web runtime (version pin, dùng `stateMachines` API không `animations`); nạp `.riv` qua IPC đọc
  file → Uint8Array; state machine contract 2.0.0: artboard, machine name, input locomotion (standing/walking/dragged/
  falling) + input work status (idle/receiving/working/waiting_approval/has_result), blend; `setState(layer, value)`
  IPC theo `set-state.schema.json`; work status derive từ Job Manager events (F2) với rule ưu tiên; hot-swap khi nhận
  tín hiệu reload.
- Idle policy: sau 60 s không tương tác giảm về 30 fps hoặc pause RAF (ghi số đo RAM).
- Placeholder `.riv` (nhân vật đơn giản, <500 KB) đúng contract 2.0.0 cho tới khi OQ-4 chốt; tài liệu designer/dev
  interface (contract) trong README package.
- Tray toggle hide/show pet (job không đổi; badge state giữ — badge render thuộc F19, F17 để slot).
- Test: unit state mapping; e2e Electron (Playwright) chụp alpha boundary (SP-3 pixel matrix); benchmark fps dưới stress
  CPU (script SP-3) trên CI Windows/macOS (ghi số); soak 8 h chạy nền nightly, đọc lại sau (không chờ trong phiên).

## Ngoài phạm vi
Native no-activate/hit-test (F18), locomotion logic & caret (F20), bubble/card (F19), pack import (F23), asset thật.

## Tiêu chí hoàn thành
1. Mọi scenario pet spec thuộc F17 có test pass.
2. fps ≥ 30 ở 100 % CPU trên Windows và macOS CI (số đo); alpha boundary không halo.
3. Kéo pet, restart → đúng vị trí; tháo display phụ → về primary; scale đổi → không lệch.
4. Hot-swap `.riv` không restart.
5. Soak 8 h nightly: process sống, RSS không tăng đơn điệu (báo cáo đọc lại phiên sau).
6. Report nêu OQ-4 chờ chốt và số đo RAM idle.
