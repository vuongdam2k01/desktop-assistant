# F9 — Notion connector (đọc + ghi + compensation matrix)

Đọc trước: README.md §1, §3, §4, §5 (Principle VIII, Notion review). Worktree `feat/f09-notion-connector`.
Phụ thuộc: F7, F8, F10 merged. Sở hữu: `connectors/notion`; điểm nối: connector registry (một dòng).

## Mục tiêu
Connector đầu tiên và duy nhất có ghi: manifest + adapter Notion, snapshot trước mọi write với exclusions,
compensation formula hoặc irreversible cho từng tool, rate 2,5 rps per authorisation, select/status theo id,
trash vs 404, reorder qua numeric order property. Đi qua OAuth client trung tâm của sản phẩm bằng broker F10.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` IV, VI, VIII.
- `docs/spec/capabilities/connector/spec.md` — 15 requirement Notion: connects with chosen workspace + default
  database; read operations; write operations (order property, unsupported, several candidates → ask, board column
  = property write); every write preceded by snapshot; each write declares compensation or irreversibility; request
  volume ≤ 2,5/s, Retry-After, no quota header; several databases; snapshot excludes 6 computed values; comment
  irreversible; choice property restored by option id; status cannot be restored to empty; option introduced
  outlives compensation; compensating creation states what it leaves; recoverably removed vs absent; pacing per
  authorisation; unmeasured capability declared absent (page-in-workspace).
- `docs/spec/capabilities/undo/spec.md` — inputs undo cần từ manifest (unrecallable effects, narrowing).
- `docs/spec/changes/req-003-notion-compensation/` — `proposal.md`, `design.md`, `model.md`, `evolution.md`,
  `clarifications.md` (Q-1 page-in-workspace), `contracts/notion-property-compensation.md/.schema.json`,
  `contracts/connector-manifest.*` (1.1.0).
- `docs/spec/changes/req-019-connector-framework/contracts/*`, `req-015-concurrency-coordinator/contracts/coordination-declaration.*`
  (khai resources cho mỗi write tool).
- `docs/raw-idea/prd-mvp.md` §13.1, §13.5 (Notion security review; **không** dùng internal token thay OAuth —
  Principle VIII).
- Spike: `spikes/SP-1-notion-compensation/REPORT.md` (Q1 exclusions, Q2 create→archive, Q3 comment/assign notify,
  Q4 ordering, Q5 rate limit, Q6 sanitization, Q7 trash/404, Q8 select/status), `evidence/compensation-matrix.md`,
  `evidence/data/*.json`; `spikes/SP-9-undo-agent/REPORT.md` (conflict payload diff); `spikes/SP-19-connector-framework/`
  (Notion manifest fixture).
- `docs/spec/risks.md`: RISK-001, 020, 021, 022, 023, 039.

## Phạm vi (in)
- Manifest `connectors/notion/manifest.json` theo 1.2.0: identity, OAuth config (central client qua broker), scope
  profile, tools:
  - read: `query_database`, `retrieve_page`, `retrieve_database_schema`, `search` (nếu spike đo), không resources.
  - write: `create_task` (compensation: archive; leaves recoverable + id không reclaim), `update_properties`
    (snapshot properties trừ formula/rollup/created_time/created_by/last_edited_time/last_edited_by; restore theo id
    cho select/status; status empty → default; select option mới tồn lại), `archive_page`/`unarchive_page`,
    `reorder` (chỉ khi numeric order property; nhiều ứng viên → ask), `add_comment` (`irreversible`), `assign_person`
    (unrecallable effect: notification). Mỗi write khai `is_reversible`, snapshot method, formula, exclusions,
    resources (`page_id`, `database_id` normalise bỏ dấu gạch), reconciliation (read back), unrecallable effects.
  - không khai tool page-in-workspace.
- Adapter 4 ops: `execute` (HTTP Notion API, map lỗi 401/403/404/409/429 → connector error codes; 404 → absent-or-
  unreachable, không khẳng định deleted; 200+archived → recoverable), `snapshot`, `status` (hỏi platform), `revoke`
  (Notion không có endpoint → khai không có; báo removed-only).
- Rate policy khai trong manifest 2,5 rps per authorisation; coordinator F8 thi hành; Retry-After tôn trọng.
- Compensation payload builder: từ snapshot, loại computed, narrowing khi 400 validation_error (F16 gọi).
- Workspace + default database chọn tường minh khi connect (dữ liệu lưu qua F3 metadata); không default → agent hỏi.
- Test tích hợp chạy với workspace Notion test thật qua OAuth (credential từ env CI, không commit) cho toàn bộ
  compensation matrix; unit test với fixture ghi lại từ `evidence/`.

## Ngoài phạm vi
Undo pipeline (F16), UI, Gmail/Drive (F11), tool page ngoài database (UNVERIFIED).

## Tiêu chí hoàn thành
1. Mọi scenario Notion trong connector spec có test pass (unit + integration thật).
2. Manifest validate qua loader F7; thêm connector không đổi core (diff = 0 ngoài `connectors/notion` + 1 dòng registry).
3. Compensation matrix SP-1 tái hiện: create→archive, update→restore theo id, status empty → default báo đúng,
   option mới tồn lại báo đúng, comment irreversible, assign notify khai báo.
4. 100 request đồng thời → không job fail; 429 chờ đúng Retry-After.
5. Report nêu RISK-039 kiểm lại với OAuth token thật và trạng thái nộp Notion security review.
