# F16 — Undo pipeline (compensating actions)

Đọc trước: README.md §1, §3, §4. Worktree `feat/f16-undo-pipeline`. Phụ thuộc: F9, F8, F6 merged (F1, F2, F7).
Sở hữu: `packages/undo-pipeline`; điểm nối: `renderer-app` job detail (preview component khi F21 có).

## Mục tiêu
Undo cấp job = suy luận chuỗi bù trừ từ ledger, 4 pha: inversion → probe conflict → preview 3 nhóm → execute như
job mới `undo_of` với ledger riêng; irreversible là kết quả bình thường; conflict không ghi đè; narrowing khi
platform từ chối; recursive undo; disable khi 0 reversible.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` IV.
- `docs/spec/capabilities/undo/spec.md` — toàn bộ 14 requirement: compensating sequence inferred; irreversible normal
  outcome; reconcile current state before undoing (trash → restore trước; cannot return → not applicable nêu 2 khả
  năng; snapshot absent → not restorable); preview + confirm; own job own ledger; subset undo (Should) với cảnh báo
  phụ thuộc; refused when nothing compensable; unrecallable effect named; refused compensating action narrowed;
  reverse topological order; property payload diffing (không timestamp); three-way preview; recursive lineage; disabled
  when zero reversible; final sequential snapshot as baseline.
- `docs/spec/capabilities/connector/spec.md` — Notion compensation requirements (F9 cung cấp formula, exclusions,
  option id, status empty, option residue, creation leaves recoverable, notification).
- `docs/spec/capabilities/ledger/spec.md` — repeated modifications discrete snapshots; `capabilities/job/spec.md` —
  `undo_of`.
- `docs/spec/changes/req-010-undo-agent/` — `proposal.md`, `design.md` (Inversion Planner, Conflict Prober, Preview
  Generator, Undo Executor), `model.md`, `clarifications.md`, `contracts/undo-pipeline.md/.schema.json`,
  `contracts/undo-pipeline.execute.schema.json`, `specs/connector|ledger|undo/spec.md`.
- PRD `docs/raw-idea/prd-mvp.md` FR-UD-01..06, WF-4, US-3.2.
- Spike: `spikes/SP-9-undo-agent/REPORT.md` (100 % accuracy, 0 false-negative conflict, ≤5 probe < 1,5 s, RISK-038
  minute rounding, RISK-039), `spikes/SP-1-notion-compensation/evidence/compensation-matrix.md` §1, §3.
- `docs/spec/risks.md`: RISK-001, 020, 021, 023, 038, 039.

## Phạm vi (in)
- Inversion planner: đọc action records job (F1) → plan đảo thứ tự, child trước container; mỗi step: declared formula
  từ manifest (F7/F9) hoặc inferred (model role undo qua F6, strong) đánh dấu `inferred`; step không snapshot → not
  restorable.
- Conflict prober: per object, read live qua connector (F7 → F8 coordinator, read không lock) → diff properties với
  `snapshot_after` của record cuối chạm object (loại computed values) → clean / conflict / trash-recoverable /
  absent-or-unreachable; ≤5 probe song song; lỗi mạng/404 → conflict (fail-closed).
- Preview model: Reversible / Irreversible (lý do: manifest flag, no snapshot) / Conflict (expected vs live, không
  auto-overwrite); mỗi step kèm unrecallable effects; subset selection với cảnh báo phụ thuộc (create → update).
- Executor: tạo job mới `undo_of` (F2), mỗi compensating step là tool call qua F5 factory → F4 gate (undo write vẫn
  bị gate; blocklist vẫn áp) → F8 → adapter; conflict item chờ quyết định riêng của người dùng; 400 validation →
  narrowing bỏ phần bị từ chối, không bịa giá trị; trash → unarchive trước; đã absent → "already absent, succeeded in
  intent"; report cuối: restored / not restorable (reason) / unrecallable effects / needs manual.
- Undo availability: 0 reversible → disabled + explanation (payload cho UI); undo của undo job → forward compensation.
- Test: fixture ledger từ SP-9 + integration Notion test (F9): conflict trong cùng phút, trash, deleted, option rename,
  status empty, narrowing.

## Ngoài phạm vi
UI preview modal (F21 component dùng payload F16), cross-device undo ordering (F22), connector khác.

## Tiêu chí hoàn thành
1. Mọi scenario undo spec có test pass.
2. Third-party edit cùng phút → conflict (0 false negative); clean object → 0 false positive.
3. Undo job có ledger riêng, link hai chiều; undo của undo chạy được.
4. Job toàn comment → undo disabled với lời giải thích.
5. Report số đo probe latency và case không restorable đã phân loại đúng.
