# specdocs — lô C: skills `converge`, `sync`, `harvest` + agents `drafter`, `critic`

Ngày: 2026-09-12 · Nhánh: dev · Không commit.

## File đã tạo

| File | Dòng | quick_validate | lint_cruft |
| --- | --- | --- | --- |
| `plugins/specdocs/skills/converge/SKILL.md` | 150 | valid | 0 finding |
| `plugins/specdocs/skills/sync/SKILL.md` | 135 | valid | 0 finding |
| `plugins/specdocs/skills/harvest/SKILL.md` | 164 | valid | 0 finding |
| `plugins/specdocs/agents/drafter.md` | 87 | — (agent) | 0 finding |
| `plugins/specdocs/agents/critic.md` | 101 | — (agent) | 0 finding |

Front-matter cả năm file parse bằng PyYAML; agent có `name` (chữ thường, không dấu hai
chấm), `description`, `tools`, `model`. Không file nào vượt 300 dòng.

## Đổi hướng giữa chừng (đã áp dụng)

Điều phối thông báo plugin không còn phụ thuộc engine ngoài. Đã viết lại toàn bộ theo:

- Lệnh: `node ${CLAUDE_PLUGIN_ROOT}/bin/specdocs.mjs <cmd>` (viết tắt `CLI` trong thân skill).
- `allowed-tools`: `Bash(node ${CLAUDE_PLUGIN_ROOT}/bin/*) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/*) Read Glob Grep Write Edit`.
- Dữ liệu dự án: `docs/spec/` — `config.yaml`, `constitution.md`, `capabilities/<cap>/…`,
  `changes/<name>/` (`.change.yaml`), `changes/archive/YYYY-MM-DD-<name>/`, `risks.md`.
- Handoff dùng tên mới: `/specdocs:new`, `/specdocs:continue`, `/specdocs:apply`,
  `/specdocs:sync-spec`, `/specdocs:archive`, `/specdocs:impact`, `/specdocs:roadmap`.
- Từ khoá engine cũ không xuất hiện ở bất kỳ file nào trong lô này (đã grep).

## Quyết định thiết kế đáng ghi

- **converge**: chỉ ghi một chỗ — phần nối vào cuối `tasks.md`. Nhánh sạch để file nguyên
  vẹn từng byte. Bốn loại khoảng cách `missing | partial | contradicts | unrequested`, bốn
  mức, task sinh từ vi phạm hiến pháp đứng đầu khối. Phạm vi quét code lấy từ `design.md`
  Structure + đường dẫn trong `tasks.md` + tìm theo từ khoá requirement.
- **sync**: năng lực đích của `contracts/*` lấy từ front-matter `owner`; của
  model/design/evolution/verification lấy từ năng lực duy nhất bị chạm, nhiều năng lực thì
  hỏi từng file. Bốn điều kiện chặn ghi hợp đồng: version không tăng, MAJOR thiếu
  `Migration`, đích `frozen` chưa duyệt, consumer cũ còn treo (giữ `<name>@<old>.md`).
  Xác nhận và ghi từng file một để dừng giữa chừng không mất phần đã duyệt.
- **harvest**: một tài liệu nguồn → đúng một change `req-NNN-<slug>`; bảng phân loại heading
  mặc định có sẵn, chỉ hỏi một câu khi quét xong mà không heading nào khớp. Mục không khớp
  được đếm thành `unmapped` trong bảng cuối. Schema `lite`/`design` chọn theo quy tắc rủi ro
  của `references/workflow.md`. Dò mã định danh trùng (`ADR-nn`, `SP-nn`, `FR-nn`, `RFC-nn`)
  và chỉ báo, không tự chọn bên.
- **drafter**: có mục "Hợp đồng người gọi phải cung cấp" (nhiệm vụ, file cần đọc, file được
  sửa, tiêu chí nghiệm thu); thiếu mục → `NEEDS_CONTEXT`.
- **critic**: chỉ đọc, một message, có bảng xung đột · ảnh hưởng hợp đồng (vỡ bây giờ / vỡ
  về sau theo `consumers`) · giả định kèm độ tin · ngã ba kèm khuyến nghị mặc định.

## Xử lý lint

`lint_cruft` bắt `pressure-density`/`emphasis-no-reason` trên các từ MUST/CRITICAL. Đã hạ
xuống bằng cách diễn đạt lại (bảng `contradicts` dùng "nguyên tắc ràng buộc") và đánh dấu
`cruft-lint-allow` trên đúng ba dòng nơi MUST/SHALL là từ khoá ngữ pháp của hiến pháp, hoặc
CRITICAL là thang mức chứ không phải nhấn mạnh. Kết quả cuối: 0 finding ở mọi mức.

## Phụ thuộc còn treo

- `scripts/spec-check.mjs` và `scripts/extract-sections.mjs` do agent khác viết. Cả ba skill
  gọi qua `node ${CLAUDE_PLUGIN_ROOT}/scripts/…` và có nhánh lùi khi script chưa có
  (harvest lùi về Glob+Grep để tách heading; sync và harvest bỏ qua bước kiểm và ghi rõ).
- `references/merge-rules.md` và `references/workflow.md` vẫn mô tả bố cục thư mục theo
  engine cũ. Skill `sync` trỏ tới `merge-rules.md` như tài liệu ràng buộc nhưng tự phát biểu
  bảng ánh xạ theo `docs/spec/capabilities/`. Hai file reference đó nằm ngoài phạm vi được
  phép sửa của lô này — cần một lượt cập nhật riêng, nếu không người đọc sẽ gặp hai bố cục
  thư mục khác nhau.
