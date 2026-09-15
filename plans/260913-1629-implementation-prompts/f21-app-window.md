# F21 — Cửa sổ app: connectors, jobs & ledger, approval & settings, onboarding & account

Đọc trước: README.md §1, §3, §4, §5 (offline queue chờ làm rõ). Sở hữu: `apps/desktop/renderer-app`,
`apps/desktop/main/app-window`; điểm nối: IPC contracts. Chia **ba lát**, mỗi lát một worktree/PR:

| Lát | Worktree | Phụ thuộc |
| --- | --- | --- |
| A — shell, connectors, jobs & ledger | `feat/f21a-app-shell-jobs` | F2, F7 (F16 payload undo khi có) |
| B — approval, rules, settings | `feat/f21b-app-approval-settings` | F4, F6, F14, lát A |
| C — onboarding, account, devices, offline queue | `feat/f21c-app-onboarding-account` | F10, F19, F22, lát B |

## Mục tiêu
Cửa sổ quản trị React + TS + Tailwind, i18n vi/en, 4 khu vực (Connectors, Jobs, Approval, Settings), realtime từ Job
Manager, đọc ledger dạng câu, undo/cancel theo state, usage/cost, mode & rules & allowlist, provider profiles &
routing, onboarding đến 1 job mẫu, account/sync/devices/sign-out/xoá account, tray/quit, macOS Dock theo cửa sổ.

## Tài liệu bắt buộc đọc
- `docs/spec/capabilities/app/spec.md` — toàn bộ 15 requirement (4 areas; job list live; job detail full account +
  usage/cost; onboarding ends with one job; conversation history; closing is not quitting; delete account; device
  up-to-date state; device list + revoke; sign-out states what it destroys; BYO ordered steps + cost statement;
  offline queue durable/drain FIFO/idempotency/inspect-edit-cancel; zero-title; Dock presence; onboarding macOS no
  permission prompt).
- `docs/spec/capabilities/ledger/spec.md`: readable as plain language + raw; searchable/filterable; retention
  configurable + warned deletion. `capabilities/approval/spec.md`: mode off visible (banner); four decision levels
  allowlist viewable/editable; mode change binds later jobs. `capabilities/agent/spec.md`: provider settings (no
  interactive sign-in, defaults shown, capability refusal, suitability statement, unusable on this device).
  `capabilities/connector/spec.md`: state visible & reconnect; BYO route. `capabilities/uix/spec.md`: cards not
  duplicated into focused app window; approve/deny equivalent. `capabilities/sync/spec.md`: enrolled devices, sign-out
  erase, unreplicated work. `capabilities/platform/spec.md`: launch at login off by default.
- PRD `docs/raw-idea/prd-mvp.md` §8 WF-1, WF-4, WF-5, WF-6; §9 EPIC 5; §10.7 FR-APP-01..06; FR-BE-12; Phụ lục A.9.
- Changes: `req-022-account-sync/specs/app/spec.md`; `req-021-ask-user-offline/design.md`, `contracts/offline-queue.md/.schema.json/.sql`,
  `specs/app/spec.md`; `req-014/specs/app/spec.md`, `contracts/byo-setup-guide.*`; `req-017/specs/app/spec.md`;
  `req-016/specs/app/spec.md`; `req-023/specs/app/spec.md`; `req-001/contracts/localisation-resources.*`.
- Spike: `spikes/SP-21-ask-user-offline/REPORT.md` Q8–Q12 (offline queue), `spikes/SP-13-byo-oauth-google/REPORT.md` Q7,
  `spikes/SP-17-provider-matrix/REPORT.md` Q6, `spikes/SP-16-signing-update/REPORT.md` Q5, `spikes/SP-7-pet-window-os/macos/REPORT.md`
  Q7, `spikes/SP-22-macos-permissions/REPORT.md`.
- `docs/spec/risks.md`: RISK-015, 061, 064, 066, 075.

## Phạm vi (in)

**Lát A**: shell React + router + Tailwind + i18n; window lifecycle (đóng = tray; Quit/Restart xác nhận khi job
running; không cài update ngầm khi quit); macOS Dock Accessory↔Regular qua F18; Connectors area (catalogue từ registry
F7, state per connector, Connect/Reconnect/Disconnect, slot cho BYO component của F11, "unavailable on this device"
hook F22); Jobs list realtime (request, state, timing, compressed result, device, filter, pin waiting_approval, empty
state hướng dẫn, "may be behind" khi chưa replicate); Job detail (request + ảnh, result, ledger đọc được từng bước +
expand raw, cancel/undo theo state, undo preview modal 3 nhóm dùng payload F16, link undo↔original, usage per role +
total + cost hoặc "no price"/"not reported", running → incomplete); conversation history; ledger search/filter.

**Lát B**: Approval area (mode switch có xác nhận, banner khi off, hàng chờ approval/ask với 4 nút và ASK answer đồng
bộ với bubble, rules list + elicitation UI dùng F14 API: restatement, unsupported parts, sample results, confirm;
allowlist CRUD; job-scoped grants xem); Settings: pet (hide/show, liveness on/off, DND), notifications (RESULT timer
10–120 s), launch at login (off default), language, provider profiles (thêm/sửa/xoá, credential qua IPC chỉ present/
lastUpdated, custom endpoint, unit prices), routing table 6 role với capability refusal + suitability statement +
defaults preview, ledger retention + delete có cảnh báo.

**Lát C**: Onboarding WF-1 (Google Sign-In qua F10 → connect ≥1 (Notion chuẩn / Google BYO) → chọn mode mặc định `on`
→ gặp pet (persona F13) → 1 job mẫu thành công; mỗi bước tự retry không lặp bước trước; data policy disclosure; macOS
không prompt permission); Account area: sync state (current / working from own copy since… / unreplicated work), device
list + revoke (kể cả máy này → sign-out), sign-out (nêu phần chưa replicate, chờ hoặc xoá), delete account (nêu phạm vi,
provider cần tự thu hồi, offline device tự xoá khi quay lại); Offline command queue manager (xem/sửa/huỷ QUEUED_OFFLINE)
— **chỉ implement sau khi câu hỏi §5 README được làm rõ về mục đích drain**; SYSTEM card update-ready (F24 payload).

## Ngoài phạm vi
Logic nghiệp vụ của mọi module (chỉ gọi API/IPC), bubble (F19), replication (F22), publish update (F24).

## Tiêu chí hoàn thành (mỗi lát)
1. Mọi scenario app spec của lát có test (component + e2e Electron) pass.
2. Không string hardcode; switch vi/en không restart.
3. A: job list cập nhật không refresh; job detail ledger 100 % record hiển thị; undo preview đúng 3 nhóm.
4. B: đổi mode không ảnh hưởng job đang chạy; allowlist xoá → hỏi lại; gán model sai capability bị từ chối trong UI.
5. C: onboarding hoàn tất trên macOS wipe permission không prompt; revoke device → device kia biến mất không sign-in lại;
   sign-out với unreplicated work → xác nhận trước khi xoá.
