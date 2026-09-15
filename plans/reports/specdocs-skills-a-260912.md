# specdocs — bốn skill W0–W2 (init, assess, clarify, checklist)

Ngày: 2026-09-12 · Plugin: `plugins/specdocs`

## File đã tạo

| File | Dòng |
| --- | --- |
| `plugins/specdocs/skills/init/SKILL.md` | 145 |
| `plugins/specdocs/skills/init/references/interview.md` | 124 |
| `plugins/specdocs/skills/assess/SKILL.md` | 154 |
| `plugins/specdocs/skills/clarify/SKILL.md` | 143 |
| `plugins/specdocs/skills/checklist/SKILL.md` | 126 |

Không sửa file nào khác trong repo.

## Nội dung

- **init** (W0, `disable-model-invocation: true`): `specdocs.mjs init --language`, `schema
  validate lite|design`, phỏng vấn `specdocs:` từng khoá với mặc định khảo sát từ repo, nháp
  hiến pháp `[DRAFT — confirm]` rồi confirm/edit/drop từng điều (trần ~8), khối `CLAUDE.md`
  giữa marker, `doctor`, mục idempotency dạng bảng. Phần dài (bảng khảo sát 9 khoá, 12 mục
  crosscutting, khuôn câu hỏi, quy trình hiến pháp, Sync Impact Report) tách ra
  `init/references/interview.md` để SKILL.md ngắn.
- **assess** (W1): bốn giai đoạn Intake / Define / Shape / Decide trong một skill, một đầu ra —
  vào `proposal.md` (4 mục) khi change đã có, ngược lại
  `docs/spec/explorations/<slug>-assessment.md`. Có constitution check, scorecard 6 tiêu chí,
  quy tắc hạ `go` xuống `needs-clarification` khi bằng chứng yếu, trần 3 câu hỏi.
- **clarify** (W2): quét 10 nhóm taxonomy, hàng đợi ≤5 câu theo Impact × Uncertainty, hỏi đúng
  một câu mỗi lượt theo khuôn §3, vá + lưu đĩa sau mỗi câu theo ánh xạ §4, kiểm §5,
  `validate <change> --json` cuối phiên.
- **checklist** (W2): ≤3 câu ý định động, sinh mục theo 9 chiều, ≥80% có truy vết, phủ 5 lớp
  kịch bản, mục rollback khi chạm trạng thái, append tiếp số CHK, để trống mọi ô, báo cáo đếm
  theo chiều.

Cả bốn theo thứ tự mục của CONTRIBUTING (purpose → Ranh giới → Đầu vào → Các bước → Đầu ra →
Guardrails → Handoff; `init` chèn thêm "Chạy lại (idempotency)" trước Guardrails). Đường dẫn và
template luôn lấy từ `status`/`instructions --json` (`existingOutputPaths` / `resolvedOutputPath`),
không đoán. Nội dung references không bị chép lại, chỉ trỏ bằng `${CLAUDE_PLUGIN_ROOT}/...`.

Đã áp dụng chỉ đạo đổi hướng: engine riêng `node ${CLAUDE_PLUGIN_ROOT}/bin/specdocs.mjs`, dữ
liệu ở `docs/spec/`, handoff sang `/specdocs:{explore,new,continue,update,archive}`, không còn
token của công cụ cũ (`grep -rli` trên bốn thư mục: không khớp).

## Validator

`python3 .claude/skills/ak-skill-creator/scripts/quick_validate.py <dir>` — cả bốn: `Skill is valid!`
(0 error, 0 warning). Description dài 271–328 ký tự, nằm trong dải khuyến nghị; tên thư mục khớp
`name`; không có link tới resource thiếu.

`python3 .claude/skills/ak-skill-creator/scripts/lint_cruft.py <dir>` — cả bốn: `high=0 medium=0
low=0`. (init quét 2 file gồm `references/interview.md`.)

`wc -l` — file dài nhất 154 dòng, dưới trần 300.

## Đã kiểm với engine

`node plugins/specdocs/bin/specdocs.mjs --help` xác nhận mọi lệnh được dùng đều tồn tại đúng
dạng: `init --language`, `schema validate <name>`, `new change <name> --schema`, `list --json`,
`status --change --json`, `instructions <artifact> --change --json`, `validate <change> --json`,
`doctor`.

## Cần chú ý

1. `references/` và `templates/` của plugin (`workflow.md`, `clarify-taxonomy.md`,
   `level-rules.md`, `evidence-rules.md`, `config.yaml`, `claude-block.md`, `constitution.md`)
   vẫn mô tả bố cục và công cụ cũ (`openspec/specs/`, `.openspec.yaml`, skill `openspec-*`). Bốn
   skill này trỏ vào chúng theo CONTRIBUTING, nên tới khi các file đó được đồng bộ sang
   `docs/spec/` + engine mới thì hướng dẫn sẽ lệch nhau. Việc đồng bộ nằm ngoài danh sách file
   được phép sửa của lượt này.
2. `allowed-tools` theo chỉ đạo không có tool lấy nội dung web, nên nhánh URL của `assess` chỉ
   xử lý được nội dung người dùng dán vào; skill ghi `[CHƯA KIỂM CHỨNG: chưa đọc được nội dung
   URL]` và xin dán. Nếu muốn `assess` tự fetch thì cần bổ sung tool vào front-matter.
3. `checklist` sinh đúng một file `checklists/requirements.md` theo schema `design` (spec-kit
   cho phép nhiều file theo chủ đề); trọng tâm đi vào nội dung mục chứ không thành file riêng.
