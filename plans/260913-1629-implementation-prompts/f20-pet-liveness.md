# F20 — Pet liveness: di chuyển, tránh caret, privacy filter (Should)

Đọc trước: README.md §1, §3, §4. Worktree `feat/f20-pet-liveness`. Phụ thuộc: F17, F18, F19 merged.
Sở hữu: `packages/pet-liveness`, phần privacy filter trong `native/win32-window` và `native/macos-window`; điểm nối:
`renderer-pet`.

## Mục tiêu
Pet di chuyển và phản ứng theo hoạt động người dùng bằng kiến trúc cặp cửa sổ nhỏ: locomotion 60 fps không
activate, tránh caret 150 px, lớp locomotion trong Rive; ngữ cảnh màn hình chỉ là category + geometry, **không
title nào** vượt qua FFI, vào SQLite, ledger, replication hay prompt; macOS không cần Screen Recording;
permission bị từ chối → feature rút lui + SYSTEM card một lần.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` VII (privacy boundary), External Content Is Data.
- `docs/spec/capabilities/pet/spec.md`: "Pet locomotion and screen context awareness with caret avoidance" (150 px,
  10 ms, 60 fps, 0 keystroke rớt); "Two-layer animation state machine".
- `docs/spec/capabilities/platform/spec.md`: "Native privacy filter strips raw window titles before memory dispatch"
  (categories EDITOR/BROWSER/TERMINAL/DOCUMENT/OTHER, `{category, bounds}`); "core behaviour requires no OS privacy
  permission"; "pointer never moved"; "third-party processes never suspended".
- `docs/spec/capabilities/app/spec.md`: "Zero-persistent window title privacy boundary".
- `docs/spec/capabilities/uix/spec.md`: "Dialogue card adheres to adaptive edge flipping relative to moving pet";
  "A refused operating-system permission degrades one feature and explains it".
- `docs/spec/changes/req-018-pet-liveness/` — `proposal.md`, `design.md` (Arch A, LocomotionController decay 0.92,
  snap <40 px, caret monitor, privacy filter), `model.md`, `contracts/privacy-filter.md/.schema.json`,
  `specs/app|pet|platform|uix/spec.md`.
- `docs/spec/changes/req-023-macos-platform-baseline/` (Level 0 geometry + app name; Level 1 Accessibility chỉ cho caret;
  RISK-088 không Screen Recording), `req-002` (cấm).
- Spike: `spikes/SP-18-pet-liveness/REPORT.md` (Q14–Q17 caret/locomotion, Q15 privacy, Q19–Q21, Arch A vs B) và
  `macos/REPORT.md` (Q29, Q30, RISK-088/089), `spikes/SP-22-macos-permissions/REPORT.md` (đọc trạng thái permission
  không prompt).
- `docs/spec/risks.md`: RISK-056, 057, 082, 088, 089.

## Phạm vi (in)
- Native (mở rộng F18 module, cùng contract): `enumerateForeground()` → chỉ `{category, bounds, appIdentity?}`; phân loại
  bằng pattern cục bộ trong native; **raw title được huỷ trong native trước khi trả**; caret position: Windows qua
  UI Automation/GetGUIThreadInfo, macOS qua Accessibility (Level 1) — nếu quyền không có → trả "unavailable" không prompt
  lặp; không Screen Recording.
- `packages/pet-liveness`: LocomotionController (waypoint, decay 0.92/frame, boundary collision theo display work area,
  edge snap <40 px, dragged theo cursor <10 ms → nhả → falling/standing), caret-evasion (buffer 150 px, detect ≤10 ms,
  di chuyển ra ngoài không rớt keystroke), scheduler 60 fps dùng F18 `moveWithoutActivate`, đặt input layer locomotion
  Rive (F17) đồng thời với work-status layer; chính sách "không chiếm vùng tương tác"; tắt/bật trong settings.
- Permission handling: kiểm tra trạng thái không prompt; từ chối → feature caret-evasion rút lui, SYSTEM card một lần
  (F19) với hướng dẫn, không tái xuất sau dismiss; cấp sau → bật lại không cần reconfigure.
- Bảo đảm privacy: audit test grep payload IPC, ledger, replication packet, prompt context → không title; lint cấm import
  API lấy title trong TS.
- Card placement theo pet đang di chuyển (F19 đã nhận bounds stream; F20 phát stream).
- Test e2e: gõ 25 ms/keystroke trong editor giả khi pet di chuyển → 100 % ký tự; pet cách caret <150 px → né trong
  buffer; kéo pet → dragged <10 ms; fps 60 khi đổi work status.

## Ngoài phạm vi
Pack asset (F23), animation asset thật, bubble (F19).

## Tiêu chí hoàn thành
1. Mọi scenario pet/platform/app/uix spec thuộc F20 có test pass hai OS.
2. Không title string vượt FFI (test fuzz với cửa sổ có title nhạy cảm giả).
3. macOS: chạy đầy đủ không Screen Recording; từ chối Accessibility → chỉ caret-evasion tắt, còn lại chạy.
4. Typing test 100 % khi pet di chuyển.
5. Report ghi số đo fps/latency và trạng thái permission trên máy test.
