# F25 — Pi agent system mở rộng (req-025) — CHỜ SPEC, chưa implement

Đọc trước: README.md §1, §5. Trạng thái: `docs/spec/changes/req-025-pi-agent-system/` chỉ có `proposal.md`,
`clarifications.md`, `impact.md`, `specs/job/spec.md` stub; **thiếu** design, model, contracts, evolution. Không có
prompt implement cho tới khi spec hoàn tất.

## Việc cần làm trước (trong phiên specdocs, không phải phiên code)
1. Chạy `specdocs:continue req-025-pi-agent-system` cho tới khi đủ artifact; `specdocs:clarify` để chốt 4 câu hỏi:
   - Q1: mở catalogue 6 role thành registry (BREAKING `agent/contracts/role-routing@0.1.0` → 2.0.0) hay tái dùng slot.
   - Q2: browser/desktop capability packs thuộc MVP (specified-but-inactive) hay Phase 3.
   - Q3: capability packs có bao giờ là third-party.
   - Q4: approval của child job — kế thừa parent, đánh giá lúc tạo, hay độc lập từng call (constitution II gợi ý độc lập).
2. `specdocs:analyze` + `specdocs:critic` vì change chạm Principle I (delegation), II (hooks không authorize), External
   Content Is Data (mở rộng từ 2 lên 4 nguồn: rendered web, screen pixels).
3. Sau approve + sync, viết prompt implement theo mẫu các file f0x trong thư mục này.

## Ý định đã biết (để các tính năng khác không chặn đường)
- Role registry với descriptor (identity, instructions, model-tier ref, tool allowlist, delegation permission, skill
  preload) → **F6 để role key là string registry**, catalogue 6 role là dữ liệu.
- Skill package format (manifest, discovery, validation, on-demand load) → **F12 tách skill Notion ra file dữ liệu**.
- Context engine (assembly, token budget, reduction ladder, template deterministic).
- Lifecycle interception points (named hooks) chỉ observe/transform; gate + ledger vẫn app-layer fail-closed.
- Delegation = child job qua Job Manager (không control loop) → **F2 để chỗ parent/child relation**; **F5 để session có
  lineage**.
- Browser/desktop packs ship inactive sau activation condition đo được; redaction boundary cho mọi tool arg/result.
- Tham chiếu: `docs/spec/explorations/pi-agent-system-assessment.md`; OMP là reference pattern, không dependency
  (`spikes/SP-6-pi-sdk/REPORT.md` Q4, Q9).

## Điểm nối đã chuẩn bị ở các tính năng trước
| Tính năng | Để chỗ |
| --- | --- |
| F2 | `parent_job_id` nullable, completion rule hook |
| F5 | session `lineage`, role là string |
| F6 | routing registry key string, catalogue là dữ liệu khởi tạo |
| F12 | skill Notion là asset dữ liệu tách code |
