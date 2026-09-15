# F14 — Rule elicitation (hội thoại đúc kết quy tắc phê duyệt)

Đọc trước: README.md §1, §3, §4. Worktree `feat/f14-rule-elicitation`. Phụ thuộc: F4, F6 merged (F21-B cho UI sau).
Sở hữu: `packages/rule-elicitation`; điểm nối: `renderer-app` approval area (component, khi F21-B có).

## Mục tiêu
Từ ý định thô của người dùng, hội thoại ≤4 lượt, lượt 3 còn mơ hồ → diễn giải fail-closed an toàn nhất; compile ra
Rule IR (F4) + advisory prompt fragment + restatement có cấu trúc; phần không compile được nói rõ, không hạ cấp;
sau compile chạy sample must-block/must-allow; chỉ hiệu lực sau xác nhận; role pin strong model.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` II, V.
- `docs/spec/capabilities/approval/spec.md`: "Rules are elicited in conversation and compiled before they bind";
  "A description that cannot be compiled is reported, not downgraded"; "Compiled rules are tested and the result
  is shown"; "Elicited deletion rules expand to both page archival and block deletion"; "Elicited container
  protection inherits across descendant hierarchy"; "Rules address a target by connector-declared type and
  immutable identifier".
- `docs/spec/capabilities/agent/spec.md`: rule-elicitation role pinned strong; assignment departing from measured
  result.
- `docs/spec/changes/req-004-rule-elicitation/` — `proposal.md`, `design.md`, `model.md`, `clarifications.md`,
  `contracts/rule-elicitation.md/.schema.json`, `contracts/rule-elicitation.turn.schema.json`, `specs/agent|approval/spec.md`.
- `docs/spec/changes/req-009-rule-ir-hardgate/contracts/rule-representation.*` (target compile).
- PRD `docs/raw-idea/prd-mvp.md` FR-AP-02, FR-AP-04, FR-AP-06, WF-5, US-4.1.
- Spike: `spikes/SP-2-rule-elicitation/REPORT.md` (Q1 100 % hội tụ 4,35 lượt, Q2 case R-01 delete vocabulary, R-10
  ancestor, Q3 cheap 25 % silent downgrade, R-17/R-19), corpus 40 transcript + 20 rule tại `spikes/fixtures/`
  (frozen — regression gate, không sửa).
- `docs/spec/risks.md`: RISK-002, 024, 025, 026.

## Phạm vi (in)
- Elicitation session (F5 session, role rule-elicitation từ F6; F6 đã cấm cheap trong profile ship sẵn): state
  machine turn 1..4; mỗi turn hỏi về timing/scope/exceptions còn thiếu; turn 3 mơ hồ → fail-closed synthesis; turn 4
  chỉ xác nhận.
- Compiler: output `{ruleIR (validate F4 schema), advisoryFragment, restatement{conditions→blockedActions},
  unsupportedParts[]}`; "delete/xoá/remove" → cả `archive_page` + `delete_block`; container → `ancestor_ids`
  inclusion; target theo immutable id + type từ manifest (F7) không theo tên; subjective ("important") → proxy khách
  quan + báo unsupported + gợi ý smart mode.
- Sample runner: sau compile chạy tập sample must-block/must-allow qua F4 evaluator (không model) → kết quả hiện
  trước xác nhận.
- Confirm → lưu rule vào catalogue F4 với trạng thái confirmed; trước đó draft không bind.
- Prompt corpus test: chạy 20 rule fixture → 100 % hội tụ ≤4 lượt, 0 silent downgrade (so với ground truth), số lượt
  trung bình ghi report.
- API cho UI (F21-B): start/answer/confirm/cancel; hiển thị restatement + sample results + unsupported parts.

## Ngoài phạm vi
UI area (F21-B, chỉ component), evaluator (F4), bulk import/edit rule.

## Tiêu chí hoàn thành
1. Mọi scenario approval spec thuộc F14 có test pass.
2. Corpus 20 rule: 100 % hội tụ, 0 silent downgrade, không turn thứ 5.
3. Rule chưa confirm không ảnh hưởng verdict F4 (test).
4. Gán cheap model cho role bị F6 từ chối (test tích hợp).
5. Report ghi số lượt trung bình so với 4,35 của SP-2.
