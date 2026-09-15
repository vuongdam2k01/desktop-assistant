# F15 — Risk judge (tầng 2 của smart mode)

Đọc trước: README.md §1, §3, §4. Worktree `feat/f15-risk-judge`. Phụ thuộc: F4, F6 merged.
Sở hữu: `packages/risk-judge`; điểm nối: hook Tier 2 trong `approval-gate`.

## Mục tiêu
Khi tầng tĩnh không khớp trong smart mode, một model call đánh giá rủi ro: auto-approve (ghi lý do), auto-reject
(agent tự điều chỉnh), escalate (hold). Timeout 10 s; mọi lỗi mạng/provider/JSON → ESCALATE_USER; nội dung
connector là dữ liệu không tin cậy; keyword giả metadata → escalate; default cheap model.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` II, External Content Is Data.
- `docs/spec/capabilities/approval/spec.md`: "Approval mode smart evaluates in two tiers" (judge uncertain/unavailable
  → escalate; auto-approval recorded with reason); "The risk judge call fails closed upon any network, provider, or
  timeout failure"; "Untrusted environment content in tool arguments is isolated from risk judge evaluation";
  "Static Tier 1 strictly blocks non-user-owned objects before consulting the risk judge" (Tier 1 ở F4 — F15 chỉ
  được gọi khi Tier 1 đã cho qua).
- `docs/spec/capabilities/agent/spec.md`: "The risk-judge role resolves to the cheap model tier by default".
- `docs/spec/capabilities/ledger/spec.md`: "Automatic decision is distinguishable".
- `docs/spec/changes/req-011-risk-judge/` — `proposal.md`, `design.md` (SmartApprovalCoordinator, Tier2RiskJudgeClient,
  FailClosedHandler), `model.md`, `clarifications.md`, `contracts/risk-judge.md/.schema.json`,
  `contracts/risk-judge.request.schema.json`, `specs/agent|approval/spec.md`.
- PRD `docs/raw-idea/prd-mvp.md` FR-AP-01(b).
- Spike: `spikes/SP-10-risk-judge/REPORT.md` (Q1 P50 3.154 ms, Q3 0 % false-allow/60, Q4 fail-closed 4 kịch bản, Q5
  case W-13/W-25, Q6 Tier 1), fixtures 60 trial.
- `docs/spec/risks.md`: RISK-040, 041.

## Phạm vi (in)
- Hook `tier2Evaluate(callContext) → {verdict: AUTO_APPROVE | AUTO_REJECT | ESCALATE_USER, reason, isFallback}` cắm vào
  F4 smart mode sau Tier 1.
- Request builder theo `risk-judge.request.schema.json`: operation, target, before→after dự kiến, manifest
  declarations; mọi text từ connector (title, description, comment) bọc là "untrusted environment data"; pre-filter
  keyword giả metadata (`ledger:`, `reversible=true`, `approved by owner`, `auto-approved`, `pre-approved`…) → escalate
  ngay hoặc chuyển strong model theo config.
- Client gọi F6 role risk-judge với `AbortSignal` 10 s; parse JSON strict theo `risk-judge.schema.json`; lỗi bất kỳ →
  ESCALATE_USER + isFallback + log diagnostic.
- Verdict → F4: AUTO_APPROVE → allow + decision record "automatic" với reason (F1); AUTO_REJECT → refuse result cho
  agent; ESCALATE → hold (approval card).
- Test: port 60 trial SP-10 với model test endpoint; 4 kịch bản lỗi (ECONNREFUSED, blackhole timeout, HTTP 401, HTTP
  404/400, malformed JSON) → 100 % ESCALATE; W-13/W-25 → escalate.

## Ngoài phạm vi
Tier 1 tĩnh (F4), UI card (F19), học từ quyết định người dùng.

## Tiêu chí hoàn thành
1. Mọi scenario approval spec thuộc F15 có test pass.
2. 60 trial: 0 % strict false-allow trên dangerous, 100 % auto-approve trên safe; P50 latency ghi số.
3. Không có đường nào từ verdict judge tới `allow` bỏ qua F4 (judge chỉ trả về F4; F4 quyết định cuối).
4. Report nêu số đo và cấu hình strong-model override.
