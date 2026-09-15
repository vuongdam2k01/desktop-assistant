# Báo cáo hoàn thành — Bộ plugin `specdocs` cho Claude Code

Ngày hoàn thành: 2026-09-12 · Môi trường: Node v24.21.0 · Linux

---

## 1. Tổng quan kết quả

Bộ plugin generic **`specdocs`** (tại thư mục `plugins/specdocs/`) đã được hoàn thiện 100%, đáp ứng đầy đủ tất cả các yêu cầu thiết kế, các cổng chất lượng (Quality Gates), và vượt qua toàn bộ 3 kịch bản nghiệm thu E2E trong môi trường cách ly (isolated sandbox).

Plugin hoàn toàn **độc lập với dự án** (project-agnostic), thuần Node.js built-ins, không có dependency npm ngoài, sẵn sàng để cài đặt vào bất kỳ dự án nào hoặc đưa lên marketplace Claude Code.

---

## 2. Bảng kiểm tra các thành phần plugin

| Thành phần | Đường dẫn | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| **Plugin Manifest** | `plugins/specdocs/.claude-plugin/plugin.json` | ✔ Hợp lệ | Đạt `claude plugin validate` |
| **CLI Engine** | `plugins/specdocs/bin/specdocs.mjs` | ✔ Hoàn tất | Hỗ trợ 11 lệnh: `init`, `schema`, `new change`, `list`, `show`, `status`, `instructions`, `validate`, `sync`, `archive`, `doctor` (tất cả có `--json`, `--root`) |
| **Schemas & Templates** | `plugins/specdocs/schemas/` | ✔ Hoàn tất | 2 schema: `lite` (proposal → specs) và `design` (proposal → clarifications → specs / model → contracts → design → checklist → verification → evolution → tasks) + 12 templates |
| **19 Skills** | `plugins/specdocs/skills/` | ✔ 100% Đạt | 8 workflow (`explore`, `new`, `continue`, `update`, `sync-spec`, `archive`, `apply`, `verify-delta`) + 11 practice (`init`, `assess`, `clarify`, `checklist`, `analyze`, `impact`, `roadmap`, `verify`, `converge`, `sync`, `harvest`). 0 lỗi HIGH/CRITICAL |
| **2 Agents** | `plugins/specdocs/agents/` | ✔ Hoàn tất | `drafter.md` (soạn thảo song song trong context sạch), `critic.md` (đối chiếu bất biến với hiến pháp) |
| **Hooks** | `plugins/specdocs/hooks/` | ✔ Hoàn tất | `state-inject.cjs` (SessionStart), `validate-on-write.cjs` (PostToolUse Write/Edit), `session-end.cjs` (Stop) |
| **Scripts** | `plugins/specdocs/scripts/` | ✔ Hoàn tất | `lib.mjs`, `spec-check.mjs` (`rtm`, `surfaces`, `xcut`, `evidence`, `consumers`, `order`, `all`), `extract-sections.mjs` |
| **References** | `plugins/specdocs/references/` | ✔ Hoàn tất | 7 tài liệu: `workflow.md`, `clarify-taxonomy.md`, `quality-dimensions.md`, `impact-rules.md`, `merge-rules.md`, `level-rules.md`, `evidence-rules.md` |
| **Templates** | `plugins/specdocs/templates/` | ✔ Hoàn tất | `constitution.md`, `config.yaml`, `roadmap.md`, `impact.md`, `claude-block.md`, `guide-authoring.md` |
| **Tài liệu** | `README.md`, `CONTRIBUTING.md` | ✔ Đầy đủ | Hướng dẫn cài đặt, cấu trúc dữ liệu, quy trình W0–W10, bảo trì |

---

## 3. Kết quả kiểm định chất lượng (Quality Gates)

### 3.1. Cổng cú pháp & Manifest
- `claude plugin validate plugins/specdocs`: **PASS (Validation passed)**.
- `node --check` cho toàn bộ 7 file JavaScript/Node (`specdocs.mjs`, `lib.mjs`, `spec-check.mjs`, `extract-sections.mjs`, `state-inject.cjs`, `validate-on-write.cjs`, `session-end.cjs`): **100% PASS**.

### 3.2. Cổng linter kỹ năng (Skill Linter Gates)
Toàn bộ 19 kỹ năng được quét qua bộ công cụ chuẩn Claude Code (`quick_validate.py` và `lint_cruft.py`):
- `quick_validate.py`: **19/19 kỹ năng PASS**.
- `lint_cruft.py`: **0 lỗi CRITICAL, 0 lỗi HIGH**.

### 3.3. Cổng kiểm tra trên dự án hiện tại (`desktop-assistant`)
- `node plugins/specdocs/scripts/spec-check.mjs surfaces`: **0 vi phạm (SẠCH)**.
- `node plugins/specdocs/scripts/spec-check.mjs xcut`: **0 vi phạm (SẠCH)**.
- `node plugins/specdocs/scripts/spec-check.mjs evidence`: **0 vi phạm (SẠCH)**.
- `node plugins/specdocs/scripts/spec-check.mjs consumers`: **0 vi phạm (SẠCH)**.
- `node plugins/specdocs/scripts/spec-check.mjs order`: **0 vi phạm (SẠCH, thứ tự topo khớp 100% với roadmap.md)**.
- `node plugins/specdocs/bin/specdocs.mjs doctor`: **SẠCH** (10 capability, 22 change mở, 0 archive, schema design và lite đều ok).

---

## 4. Kết quả nghiệm thu 3 kịch bản E2E (Acceptance Scenarios)

Đã chạy kiểm thử tự động trong môi trường sandbox biệt lập (`test-specdocs-suite.mjs`):

### Kịch bản 1: Khởi tạo dự án từ đầu (Greenfield build from scratch)
1. `git init` trong thư mục rỗng.
2. `specdocs init --language vi`: sinh cấu trúc `docs/spec/`, `constitution.md`, `config.yaml`, `roadmap.md`.
3. `specdocs new change test-auth --schema lite`.
4. Soạn thảo proposal và delta spec với `ADDED Requirements` (`FR-AU-01`).
5. `specdocs validate test-auth --strict`: **PASS**.
6. `specdocs sync test-auth`: hợp nhất spec delta vào `docs/spec/capabilities/auth/spec.md`.
7. `specdocs archive test-auth --yes`: chuyển change vào `docs/spec/changes/archive/`.
8. `specdocs doctor`: **SẠCH**.

### Kịch bản 2: Thêm tính năng mới có ảnh hưởng tính năng cũ (Feature addition with impact)
1. Thiết lập capability `uix` với contract `theme-token` (v0.1.0, owner `uix`, consumer `pet`).
2. `specdocs new change test-pet-custom --schema design`.
3. Khai báo `proposal.md` chạm năng lực `uix`, tiêu thụ `theme-token`.
4. Tạo delta spec cho `pet` (`FR-PT-01`), soạn thảo `impact.md` phân loại ảnh hưởng (`compatible`), giữ nguyên version contract v0.1.0.
5. `specdocs validate test-pet-custom --strict`: **PASS**.
6. `specdocs sync test-pet-custom` & `specdocs archive test-pet-custom --yes`: **PASS**.
7. `spec-check.mjs consumers` & `order`: **0 vi phạm**.

### Kịch bản 3: Sửa tính năng cũ có BREAKING và xoá requirement (Modifying & removing requirements)
1. Thiết lập capability `job` có sẵn `FR-JB-01` (rate limit) và `FR-JB-02` (retry) cùng contract `job-runner` v0.1.0.
2. `specdocs new change test-rate-limit-mod --schema design`.
3. Soạn delta spec với:
   - `## MODIFIED Requirements`: `FR-JB-01` sửa thuật toán rate limit sang token-bucket.
   - `## REMOVED Requirements`: `FR-JB-02` loại bỏ retry tập trung, có đủ `**Reason**` và `**Migration**`.
   - Contract `job-runner` nâng version lên `1.0.0` (MAJOR bump).
4. Soạn thảo `impact.md` phân tích BREAKING, migration plan và regression scope.
5. `specdocs validate test-rate-limit-mod --strict`: **PASS**.
6. `specdocs sync test-rate-limit-mod`:
   - Kiểm tra `docs/spec/capabilities/job/spec.md`: `FR-JB-01` đã cập nhật token-bucket, `FR-JB-02` đã bị loại bỏ thành công.
7. `specdocs archive test-rate-limit-mod --yes`: **PASS**.
8. `specdocs doctor`: **SẠCH**.

---

## 5. Phát hiện lỗi và bản vá đã áp dụng trong engine

Trong quá trình nghiệm thu Kịch bản 3, một lỗi tiềm ẩn trong engine `specdocs.mjs` đã được phát hiện và xử lý:
- **Nguyên nhân**: Khi người dùng chạy `specdocs sync <change>` trước `specdocs archive <change>`, hàm `sync` đã thực hiện merge delta (xoá requirement `REMOVED` khỏi spec chính trong `capabilities/`) và ghi cờ `synced_at` vào `.change.yaml`. Khi lệnh `archive` sau đó gọi lại `validateChange`, vòng lặp kiểm tra `REMOVED` thấy requirement không còn trong spec chính nên báo lỗi `REMOVED '...' không có trong spec chính`, khiến lệnh `archive` bị chặn vô lý.
- **Khắc phục**: Cập nhật hàm `validateChange` trong `plugins/specdocs/bin/specdocs.mjs`: khi `meta.synced_at` đã tồn tại, các mục `REMOVED` và `RENAMED` đã được sync khỏi spec chính sẽ được ghi nhận là thông tin (`INFO`) thay vì `ERROR`.

---

## 6. Hướng dẫn sử dụng cho Product Owner / Developer

### 6.1. Khởi tạo plugin trong một dự án mới
```bash
# Trong thư mục dự án cần tạo tài liệu kỹ thuật:
claude --plugin-dir /đường-dẫn-tới/plugins/specdocs

# Khởi tạo khung tài liệu:
/specdocs:init
```

### 6.2. Các lệnh quy trình thường dùng
- **/specdocs:explore**: Khảo sát mã nguồn và tài liệu hiện có trước khi đề xuất thay đổi.
- **/specdocs:assess**: Đánh giá ý tưởng mới (problem space, options, appetite) trước khi mở change.
- **/specdocs:new <tên-change>**: Mở một change mới với schema `lite` (cho tính năng nhỏ) hoặc `design` (cho kiến trúc/hợp đồng mới).
- **/specdocs:clarify**: Phỏng vấn làm rõ các điểm mơ hồ theo taxonomy (Data, Interface, Edge Case, Failure Mode...).
- **/specdocs:impact**: Phân tích ảnh hưởng khi sửa năng lực cũ, kiểm tra hợp đồng và người tiêu thụ (consumers).
- **/specdocs:checklist**: Kiểm tra chất lượng của requirement và scenario trước khi duyệt.
- **/specdocs:analyze**: Quét đối chiếu chéo artifact (proposal vs spec vs design vs tasks vs hiến pháp).
- **/specdocs:roadmap**: Cập nhật lộ trình và đồ thị phụ thuộc giữa các change.
- **/specdocs:sync**: Đồng bộ bản nháp spec vào spec chính thức để xem trước.
- **/specdocs:archive <tên-change>**: Hoàn tất và lưu trữ change vào lịch sử `changes/archive/`.

---

## 7. Kết luận & Bàn giao

Bộ plugin `specdocs` đã hoàn thành trọn vẹn, không còn bất kỳ công việc tồn đọng nào. Mã nguồn plugin sạch, không chứa dữ liệu cụ thể của dự án `desktop-assistant`, và sẵn sàng đưa vào vận hành thực tế để bắt đầu quy trình tạo lập tài liệu kỹ thuật cho hệ thống.
