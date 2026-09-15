# F4 — Approval gate: Rule IR, evaluator, hardline blocklist, mode, quyết định

Đọc trước: README.md §1, §3, §4, §5 (Q-OQ-2). Worktree `feat/f04-approval-gate`. Phụ thuộc: F1 merged.
Sở hữu: `packages/approval-gate`.

## Mục tiêu
Cổng phê duyệt chạy ở tầng ứng dụng, deterministic, không chạm model: Rule IR đóng, evaluator thuần, hardline
blocklist, ba mode, tầng tĩnh của smart, bốn mức quyết định với scoped grant, allowlist, count từ ledger,
fail-closed, held-call suspension durable, re-check before-state khi approve muộn.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` II (NON-NEGOTIABLE), External Content Is Data.
- `docs/spec/capabilities/approval/spec.md` — toàn bộ **trừ** hai requirement thuộc F14 (elicitation, uncompilable)
  và ba thuộc F15 (risk judge fail-closed, untrusted content, Tier 1 static: phần Tier 1 **thuộc F4**). Đặc biệt:
  mode on/smart/off; blocklist không tắt được; hook decides not prompt; four decision levels; off visible; unattended
  never approves; irreversible requires approval; request states what will change; unanswered pauses; mode change
  binds later jobs; closed expression tree; target by type + immutable id + ancestors; normalise field; per-field
  constraint; counts from account ledger; strictest wins; fails closed; hardline never offered; refusal disclosed in
  later questions; held call suspends durably; denied returns as refusal; declarations from manifest never call;
  Tier 1 blocks non-user-owned and >5.
- `docs/spec/changes/req-009-rule-ir-hardgate/` — `proposal.md`, `design.md`, `model.md`, `clarifications.md`
  (session 2026-09-12: strictest wins, off strictness, counts, disclosure), `contracts/rule-representation.md/.schema.json/.sql`
  (v1.0.0 frozen), `contracts/gate-evaluation.md/.asyncapi.yaml`.
- `docs/spec/changes/req-019-connector-framework/specs/approval/spec.md` (irreversible default),
  `req-007-pi-sdk-harness/specs/approval/spec.md` (pause/resume), `req-015-concurrency-coordinator/clarifications.md`
  Q-1 (approval ngoài exclusive span), `req-001-mvp-product-definition/contracts/rule-representation.*` (0.1.0 lịch sử).
- Spike: `spikes/SP-8-rule-ir-hardgate/` (Rule IR v0 schema + TS type + evaluator thuần + 20 case adversarial —
  seed chính; REPORT Q1, Q2, Q3, Q5 case A-13/A-14/A-15/A-19/A-20; p99 0,48 ms), `spikes/SP-10-risk-judge/REPORT.md`
  Q6 (Tier 1 created_by, >5), `spikes/SP-6-pi-sdk/REPORT.md` Q3.
- `docs/spec/risks.md`: RISK-008, 026, 036, 037, 041.

## Phạm vi (in)
- Rule catalogue store (bảng theo `rule-representation.sql`, trong ledger file hoặc file cấu hình theo design) với
  validation schema khi load; catalogue lỗi → **mọi write bị từ chối** cho tới khi sửa.
- Evaluator `evaluate(callContext, catalogue, jobMode, grants) → verdict {allow | hold | refuse, rules[]}`: 8 predicate
  kinds (tool identity, target scope, field change, ownership, accumulated count, time of day, irreversibility,
  permission change) + and/or/not; normalise tên field; extract nested; pattern per field; ancestor chain; **không
  đọc** text model sinh; deterministic (test chạy 2 lần cùng verdict).
- Call context builder: đọc khai báo (writes? irreversible? permission change? snapshot readable?) **từ manifest**
  (F7 contract), không từ arguments.
- Hardline blocklist (manifest hệ thống trong package): bulk delete/archive cấp database/root, ngoài scope, thao
  tác lên approval config/ledger; đánh giá trước mode; không bao giờ hold.
- Mode semantics: on (mọi write hold), smart (Tier 1 tĩnh: irreversible/snapshot unreadable, delete/archive, bulk
  >5, permission, `created_by != user_self`, rule người dùng → hold; không khớp → gọi hook Tier 2 do F15 cắm, khi
  chưa cắm → hold), off (không chờ; rule refuse của user vẫn refuse; ghi "matched, did not stop").
- Decision API: approve-once, approve-type-in-job (tuple job+rule+tool+scope, hết khi job kết thúc), allowlist
  vĩnh viễn (CRUD; không vượt refuse/hold), deny; mọi quyết định → ledger decision record (F1); khoá chống double
  decision (bên sau nhận "đã xử lý").
- Counts đọc từ ledger account (F1 query), không từ memory.
- Held call: gọi F5 hook để transcript durable + job `waiting_approval` (F2) trước khi phát request; timeout 30 phút
  cấu hình → pause; resume → đánh giá lại; approve muộn → so before-state hiện tại với intent record (F8 re-acquire)
  → khác thì refuse ghi lý do.
- Refusal object trả về agent (operation + rule); disclosure state per job cho F12/F19 đính vào câu hỏi.
- Approval request payload: operation, target, before→after dự kiến (hoặc "không tính được"), rule(s), objects
  affected (không chỉ count).
- Regression: port 20 case adversarial SP-8 + case corpus mới cho strictest-wins, off strictness, ledger counts.

## Ngoài phạm vi
Elicitation (F14), risk judge Tier 2 (F15), UI card (F19/F21), wrapping (F5 — F4 chỉ export hàm).

## Tiêu chí hoàn thành
1. Mọi scenario approval spec thuộc F4 có test pass; 20 case SP-8: 0 lọt.
2. Evaluator p99 < 1 ms trên corpus (ghi số đo); không import bất kỳ client model nào (lint rule).
3. Catalogue hỏng → mọi write refuse toàn cục; catalogue rỗng hợp lệ → chỉ blocklist + mode.
4. Allowlist không vượt rule refuse; scoped grant không áp cho object khác; grant hết khi job xong.
5. Report ghi rõ Q-OQ-2 được implement theo "có" và các điểm UNVERIFIED (off strictness, ledger counts latency).
