# F19 — Ô thoại: composer, hệ card, hàng đợi ưu tiên

Đọc trước: README.md §1, §3, §4. Worktree `feat/f19-speech-bubble-cards`. Phụ thuộc: F13, F17, F18, F2, F4 merged
(F12 cho ASK thật; F6 cho SYSTEM provider card). Sở hữu: `packages/card-queue` (logic thuần), `apps/desktop/renderer-pet/bubble`,
`apps/desktop/main/bubble`; điểm nối: i18n resources.

## Mục tiêu
Ô thoại là cửa sổ nhìn vào **một** thông điệp: state machine HIDDEN → COMPOSER / CARD / BADGE; 7 loại card với
anatomy chuẩn; queue ưu tiên; auto-expand không cướp focus; composer text + ảnh có giới hạn và capability gate;
DND; OS notification chỉ khi pet ẩn; rebuild sau restart; đồng bộ hai chiều với cửa sổ app; placement trong work
area; ACK trước khi job tồn tại; SYSTEM card cho connector/provider/backend.

## Tài liệu bắt buộc đọc
- `docs/spec/capabilities/uix/spec.md` — toàn bộ (trừ "withheld from screen sharing" và "refused OS permission" đã ở
  F18/F20): one card at a time; seven types; state machine; auto-expanded never takes focus; fixed priority (ASK=APPROVAL
  FIFO > ERROR > RESULT > ACK/PROGRESS; replace non-blocking của cùng job; bung một lần cho một đợt); ASK anatomy;
  APPROVAL renders hook data without model rewording; four decision levels + confirm allowlist; dismissal per type;
  DND; composer limits (3 ảnh, 10 MB, ≥14 px, capability gate, draft từ device khác); approve/deny equivalent both
  surfaces (một quyết định); OS notifications only while hidden; queue rebuilt after restart; not duplicated into
  focused app window; every string via localisation; connector stopped → SYSTEM card update-not-accumulate; provider
  failure → SYSTEM card; ACK before job exists; backend disruption SYSTEM card + badge, auto-dismiss on drain;
  inquiry card options + timeout collapse; placed relative to pet inside work area; adaptive edge flipping.
- `docs/spec/capabilities/pet/spec.md`: clicking opens dialog promptly (≤500 ms focus; Esc trả focus); right-click
  menu; approval mode indicator; badge; visibility hidden carries state; ack < 200 ms.
- `docs/spec/capabilities/approval/spec.md`: request payload, refusal disclosure; `capabilities/agent/spec.md`: ask
  schema.
- PRD `docs/raw-idea/prd-mvp.md` §10.9 FR-INT-01..16, FR-PET-03..09, **Phụ lục A toàn bộ** (A.1–A.10 là nguồn chuẩn).
- Changes: `req-021-ask-user-offline/specs/uix/spec.md`, `contracts/ask-user.*`; `req-017-provider-matrix/specs/uix|pet/spec.md`;
  `req-008-pet-window-os/specs/uix/spec.md`; `req-018-pet-liveness/specs/uix/spec.md`; `req-014/specs/uix/spec.md`;
  `req-001/contracts/localisation-resources.*`.
- Spike: `spikes/SP-7-pet-window-os/REPORT.md` Q5 + §3.2 (placement), `spikes/SP-17-provider-matrix/evidence/system-cards.json`,
  `spikes/SP-21-ask-user-offline/REPORT.md` Q1, Q6, Q9, Q10, `spikes/SP-18-pet-liveness/REPORT.md` Q21.
- `docs/spec/risks.md`: RISK-005, 030, 031, 054, 055, 061.

## Phạm vi (in)
- `packages/card-queue`: model card 7 loại (schema theo A.2), queue với priority + replacement rule + one-expansion-per-
  burst + collapse timers + DND + per-type dismissal (ACK 5 s, RESULT 30 s config 10–120, blocking collapse 60 s) +
  rebuild từ job state/ledger (F2/F1) + SYSTEM card keyed `(kind, subject)` update-not-duplicate + auto-withdraw; test
  thuần không Electron.
- Main `bubble`: nguồn sự kiện (F2 job events, F4 approval requests, F12 ask, F13 notify/ack, F6 provider failure, F7
  connector state, backend disruption) → queue; IPC tới renderer-pet bubble và renderer-app (F21) — cả hai đọc cùng
  queue; quyết định approve/deny/answer đi qua Job Manager với khoá (bên sau nhận "đã xử lý"); OS notification khi pet
  ẩn (click mở app đúng ngữ cảnh); app window focused → không bung bubble (pet vẫn đổi animation).
- Renderer-pet `bubble`: state machine; COMPOSER (Enter/Shift+Enter/Esc, paste/drag ảnh, validate 3/10 MB/14 px,
  capability gate hỏi F6, gửi → ACK ngay từ F13 ack presenter); CARD anatomy chung (icon, job name rút gọn, Open in app,
  close/collapse) + thân theo loại; APPROVAL: object/before→after/rule render từ payload F4 **không qua model**, 4 nút,
  allowlist xác nhận phụ; ASK: 0–4 chip + free text + skip-and-cancel + phím 1–4 khi focused; ‹ › duyệt queue; badge
  count + màu blocking; right-click menu (Open app, DND, Hide, Quit, mode hiện hành → dẫn tới app); mode indicator.
- Placement: anchor theo pet bounds hiện tại (kể cả đang di chuyển), flip ngang/kẹp dọc trong work area của display
  chứa pet (thuật toán SP-7 §3.2), dùng F18 move không activate; auto-expand dùng card window pre-warm (F18); click vào
  card mới nhận focus; Esc/click ngoài → F18 restore focus.
- i18n: mọi string qua resources vi/en theo `localisation-resources` contract; text agent theo ngôn ngữ hội thoại.
- Test: unit queue (mọi scenario ưu tiên/replacement/DND/timer); e2e Electron: bung card khi gõ ở editor giả → 0 ký tự
  rớt (dựa F18); click pet ≤500 ms focus; hai surface quyết định cùng lúc → một record; restart giữa APPROVAL → card
  còn.

## Ngoài phạm vi
App window (F21), locomotion (F20), offline queue lưu trữ (F21), persona text (F13), OS permission card (F20).

## Tiêu chí hoàn thành
1. Mọi scenario uix spec thuộc F19 và pet spec (click/menu/badge) có test pass.
2. Không có LLM text nào trong phần dữ liệu APPROVAL (test render từ payload cố định).
3. E2E hai OS: auto-expand không cướp focus, composer nhận focus khi click, Esc trả focus.
4. Queue rebuild sau kill với 2 APPROVAL + 1 RESULT → đúng thứ tự.
5. Không string hardcode (lint i18n).
