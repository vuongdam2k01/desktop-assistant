# specdocs — nhóm skill B (analyze, impact, roadmap, verify)

Ngày: 2026-09-12 · Phạm vi: 4 file SKILL.md trong `plugins/specdocs/skills/`.

## Đã tạo

| Skill | Dòng | W | Ghi gì |
| --- | --- | --- | --- |
| `analyze` | 203 | W2/W9 | Không ghi (chỉ báo cáo khi người dùng yêu cầu) |
| `impact` | 162 | W3 | `impact.md`, vá `verification.md` Regression scope, vá proposal What Changes |
| `roadmap` | 142 | W5 | `docs/spec/roadmap.md` |
| `verify` | 161 | W6 | `plans/reports/verify-<change>-<date>.md` hoặc `<changeRoot>/verify-report.md`; tick Definition of done |

Cấu trúc mỗi file theo CONTRIBUTING.md: đoạn mục đích → Ranh giới → Đầu vào → Các bước → Đầu ra →
Guardrails → bảng Handoff. Thân tiếng Việt, từ khoá cấu trúc tiếng Anh. Không tạo file phụ nào.

## Nguồn port

- `analyze`: spec-kit `analyze.md` — sáu lượt phát hiện A–F, heuristic severity, trần 50 phát hiện,
  ID ổn định, báo cáo compact. Bỏ toàn bộ phần extension hook và đường dẫn của spec-kit; ánh xạ
  kho kiểm kê sang ngữ pháp Requirement/Scenario, model/INV, contract có version, cluster.
- `roadmap`: spec-kit `spec-of-specs.md` — ID bất biến, cột intent + scope boundary, sắp theo phụ
  thuộc. Bổ sung: trạng thái suy từ artifact, cạnh contract producer→consumer, change khởi tạo.
- `verify`: bọc kiểm delta của `/specdocs:verify-delta` (ba chiều Completeness/Correctness/
  Coherence) và thêm chiều Regression theo `references/impact-rules.md`.

## Áp dụng hướng đổi giữa chừng

Cả bốn file đã viết lại theo engine riêng của plugin:

- Mọi lệnh CLI là `node ${CLAUDE_PLUGIN_ROOT}/bin/specdocs.mjs <cmd>`; mỗi file khai một lần dạng
  đầy đủ rồi viết tắt `specdocs` trong phần còn lại.
- Dữ liệu dự án: `docs/spec/{config.yaml,constitution.md,capabilities/<cap>/,changes/<tên>/,
  changes/archive/<ngày>-<tên>/,roadmap.md}`; metadata change là `.change.yaml`.
- Handoff chỉ trỏ skill của plugin: `explore, new, continue, update, sync-spec, archive, apply,
  verify-delta, clarify, checklist, impact, roadmap, verify, sync, converge`.
- `grep -i openspec` trên bốn file: 0 kết quả.

## Suy biến khi thiếu script

`spec-check.mjs` (rtm, consumers, order, all) được gọi kèm `--json`. Mỗi chỗ gọi đều có nhánh dự
phòng đọc file trực tiếp, và bắt buộc nói rõ trong báo cáo rằng phần đó làm thủ công.

## Kiểm

`quick_validate.py`: 4/4 "Skill is valid!" (0 error, 0 warning).
`lint_cruft.py`: high=0 ở cả bốn. Còn medium `emphasis-no-reason`/`pressure-density` ở `analyze`
(4) và `verify` (2) — do các từ CRITICAL/MUST trong bảng severity và rubric, là nội dung cần thiết.

## Chưa giải quyết

- `bin/specdocs.mjs` chưa tồn tại; chưa chạy thử được lệnh nào.
- Cờ `--strict` mới chỉ dùng ở `validate --all`; chưa rõ `validate <change>` có nhận không.
- `/specdocs:sync` (model/design/contracts/evolution) và `/specdocs:sync-spec` (delta spec) được
  coi là hai skill khác nhau trong bảng Handoff.
