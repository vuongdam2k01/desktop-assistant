# F18 — Native window integration (Win32 napi-rs + macOS AppKit)

Đọc trước: README.md §1, §3, §4. Worktree `feat/f18-native-window-integration`. Phụ thuộc: F0 merged (F17 song song;
tích hợp khi cả hai merge). Sở hữu: `native/win32-window`, `native/macos-window`, `apps/desktop/main/window-integration`;
điểm nối: CI native jobs.

## Mục tiêu
Hai native module độc lập thực thi contract `window-integration-module@1.0.0`: Windows — no-activate topmost,
`SetWindowPos` không activate, `WM_NCHITTEST` per-pixel; macOS — NSPanel non-activating, `hitTest:` pixel, mọi
Space + over fullscreen, khôi phục activation app trước, activation policy Accessory↔Regular, loại khỏi screen
capture. Card window pre-warm. Không bao giờ chạm process/pointer/cửa sổ khác.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` II; `docs/spec/capabilities/platform/spec.md`: Windows native module; macOS native module
  (panel, hit-test, focus restoration; hai component riêng); cấm suspend/synthetic input/pointer; no elevation; native
  loaded from disk; update preserves signing identity (RISK-084 ad-hoc → prompt: tài liệu hoá cho dev).
- `docs/spec/capabilities/pet/spec.md`: per-pixel click-through (`HTTRANSPARENT`/`HTCLIENT`); card window HWND pre-warm
  + `WS_EX_NOACTIVATE|WS_EX_TOPMOST` + `SWP_NOACTIVATE`; bubble on macOS takes no focus (Electron đủ); returning focus
  requires native on macOS.
- `docs/spec/capabilities/uix/spec.md`: auto-expanded card never takes keyboard focus; withheld from screen sharing.
- `docs/spec/capabilities/app/spec.md`: Dock presence follows management window.
- `docs/spec/changes/req-008-pet-window-os/` — `proposal.md`, `design.md`, `model.md`, `contracts/native-window-manager.md/.schema.json`.
- `docs/spec/changes/req-023-macos-platform-baseline/` — `design.md`, `contracts/window-integration-module.md`
  (`capabilities()`), `specs/pet|platform|uix|app/spec.md`.
- `docs/spec/changes/req-002-gui-spike-harness/proposal.md` (cấm tuyệt đối).
- Spike: `spikes/SP-7-pet-window-os/REPORT.md` (Q1 10/10 với native, Q2 hit-test, §3.1 spec Rust module
  `desktop-window-win32`, RISK-033 pre-warm 30–50 ms) + `macos/REPORT.md` (Q1 Electron đủ cho no-focus, Q7 Dock,
  RISK-074 IPC latency → native hitTest, RISK-075 activation policy); `spikes/SP-18-pet-liveness/macos/REPORT.md`
  Q29 (sharingType), Q30 (focus restore cần native); `spikes/SP-0-gui-harness/REPORT.md` §4.
- `docs/spec/risks.md`: RISK-016, 018, 019, 033, 035, 057, 074, 075, 084, 089.

## Phạm vi (in)
- TS facade `window-integration` trong main: `capabilities()`, `applyNoActivateTopmost(hwnd|nsWindow)`,
  `moveWithoutActivate`, `enablePixelHitTest(getAlphaAt)`, `restorePreviousFocus`, `setActivationPolicy(mode)`,
  `excludeFromCapture`, `prewarmCardWindow`; chọn module theo `process.platform`; caller không branch OS ngoài facade.
- `native/win32-window` (Rust, napi-rs): extended style, `SetWindowPos(SWP_NOACTIVATE|SWP_NOZORDER…)`, subclass
  `WM_NCHITTEST` đọc alpha bitmap do renderer cung cấp (hoặc region) → `HTTRANSPARENT`/`HTCLIENT`; không API nào tới
  cửa sổ ngoài handle của app; prebuilt `.node` per arch; build trên Windows runner.
- `native/macos-window` (Swift/ObjC, napi hoặc node-addon-api): `NSPanel` nonactivating + `.canJoinAllSpaces` +
  `.fullScreenAuxiliary`, view `hitTest:` trả nil trên alpha 0, ghi nhớ frontmost app trước khi bubble mở → `activate`
  lại khi đóng (app đã đóng → không tự activate mình), `NSApp.setActivationPolicy(.accessory/.regular)`,
  `sharingType = .none`.
- Pre-warm card window hidden khi khởi động, reveal bằng move + show không activate.
- Test e2e (Playwright + script SP-0 gõ phím vào editor giả): 10/10 không rớt ký tự khi card bung trên Windows và
  macOS; click vùng alpha 0 xuyên xuống app dưới; click pet nhận; đóng bubble → editor active lại (macOS); Dock ẩn khi
  chỉ pet; screen capture (script) không thấy pet trên macOS.
- Lint/grep test: không dùng `SetCursorPos`, `SendInput`, `NtSuspendProcess`, `CGEventPost` tới cửa sổ ngoài, AppleScript
  keystroke trong mã sản phẩm.

## Ngoài phạm vi
Locomotion & privacy filter (F20 mở rộng native sau), bubble UI (F19), Rive (F17), ký số (F24).

## Tiêu chí hoàn thành
1. Mọi scenario pet/platform/uix/app spec thuộc F18 có test pass trên CI hai OS.
2. Typing test 10/10 hai OS; click-through per pixel; focus restore macOS.
3. `capabilities()` trả đúng per OS; facade không có `if (platform)` ngoài một chỗ.
4. Native `.node` extract khi đóng gói (build check F0 xanh); CI runner có toolchain.
5. Report nêu RISK-084 (dev chạy ad-hoc signing sẽ bị prompt Keychain — hướng xử lý ở F24).
