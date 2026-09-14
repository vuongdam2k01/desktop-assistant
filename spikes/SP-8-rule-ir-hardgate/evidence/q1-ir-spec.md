# Đặc tả Kỹ thuật Rule IR v0 (Intermediate Representation Specification)

> **Mục tiêu:** Định nghĩa ngôn ngữ hình thức biểu diễn quy tắc đóng (closed), tiền định (deterministic), không dùng LLM tại thời điểm đánh giá, phục vụ cổng chặn cứng (Hard Gate) của Desktop Assistant.

---

## 1. Bản chất và Nguyên lý Thiết kế

1. **Đóng (Closed Schema):**
   - Chỉ hỗ trợ các node và toán tử định nghĩa tường minh trong JSON Schema (`src/ir/schema.json`).
   - Cấm biểu thức tự do (no `eval()`, no arbitrary JS code, no regex do LLM tự sinh tùy tiện).
2. **Tiền định (Deterministic):**
   - Cùng một bộ `(toolCallContext, sessionContext)` luôn trả về ĐÚNG MỘT kết quả (`ALLOW`, `APPROVAL_REQUIRED`, hoặc `DENY`).
   - Không chứa yếu tố ngẫu nhiên, không phụ thuộc nhiệt độ (temperature) hay context window của LLM.
3. **Phân cấp Ưu tiên (Precedence Hierarchy):**
   - **DENY (Priority >= 1000):** Hardline Blocklist (FR-AP-10), có hiệu lực trên mọi mode (kể cả `off`), không cho phép người dùng ấn duyệt.
   - **Active Job Approval:** Kiểm tra token duyệt theo ngữ cảnh hẹp `(jobId, ruleId, toolName, targetScope)`.
   - **APPROVAL (Priority 100):** Quy tắc người dùng và mẫu rủi ro tĩnh — dừng ở `waiting_approval` để chờ người dùng duyệt.
   - **Mode ON Blanket:** Mọi thao tác ghi chưa duyệt đều bị chặn nếu mode = `on`.
   - **ALLOW:** Cho phép thực thi tool.

---

## 2. 7 Trục Vị từ Biểu diễn (7 Predicate Axes)

Dựa trên kết quả SP-2 (`rule-patterns-for-ir.md`), IR v0 hỗ trợ đầy đủ 7 trục điều kiện:

### Trục 1: Thao tác / Tool Call (`tool`)
- `tool_name`: Khớp một tool hoặc mảng tool (ví dụ: `["archive_page", "delete_block"]` cho R-01; `WRITE_TOOLS` cho các thao tác ghi).
- `connector`: Khớp connector đích (`notion`, `gmail`, `system`).

### Trục 2: Vùng tác động (`target_scope`)
- `target_type`: `"database" | "page" | "block" | "schema" | "workspace"`.
- `database_id`: Neo theo UUID bất biến (`db-hr-portal-uuid-001` cho R-03; cấm neo theo tên chuỗi hiển thị). Hỗ trợ so sánh trực tiếp hoặc qua mảng `in`.
- `page_id`: ID trang cụ thể.
- `ancestor_ids`: Kiểm tra cây phả hệ cha-con (`contains` hoặc `contains_any`). Giải quyết bẫy phân cấp của R-10 (bảo vệ Roadmap và toàn bộ page con).

### Trục 3: Thuộc tính & Chuyển đổi trạng thái (`property`)
- `changed_properties`:
  - `contains`: Kiểm tra có sửa trường cụ thể hay không (ví dụ: `"Due date"` cho R-02; chuẩn hóa camelCase/lowercase như `dueDate`).
  - `not_empty_after_excluding`: Kiểm tra có sửa trường nào khác ngoài tập cho phép không (R-13: chỉ cho sửa Status).
- `property_transition`:
  - `property`: Tên trường (`Status`, `Assignee`, v.v.).
  - `to` / `to_in`: Giá trị chuyển tới (R-05: `Status == 'Done'`; A-15: `Status in ['Deleted', 'Archived']`).
  - `to_matches`: Biểu thức mẫu kiểm tra giá trị rác/ẩn task (A-15: `Title` đổi thành rác `/(?:^zzz|ignore|trash|deleted|bỏ)/i`).
- `remove_property`: Bắt thao tác xoá thuộc tính trong schema (A-09, A-16).

### Trục 4: Thời gian máy (`temporal`)
- `time_window`: `{ not_between: ["08:00", "18:00"] }` (R-04: ngoài giờ làm việc).
- `days_of_week`: `{ in: ["Saturday", "Sunday"] }` (R-04: cuối tuần chặn cả ngày).
- Đánh giá theo múi giờ máy người dùng (`Asia/Ho_Chi_Minh`).

### Trục 5: Quyền sở hữu & Tác giả (`ownership`)
- `created_by`: Người tạo đối tượng (bất biến):
  - `not_in: ["current_user", "app_bot"]` (R-12: task không do người dùng hoặc bot tạo).
  - `in: ["Linh", "user_linh"]` (R-08, R-13).
- `assignee`: Người phụ trách:
  - `contains: "Linh"` (R-08).
  - `not_equal_to_current_user: true` (R-11: gán cho người khác ngoài mình).

### Trục 6: Ngưỡng số lượng & Trạng thái tích luỹ (`threshold`)
- `metric`:
  - `job_cumulative_writes`: Tổng số thao tác ghi trong cùng job vượt ngưỡng > 5 (R-15, A-13).
  - `job_deadline_changes`: Số lần đổi deadline trong job > 3 (R-16).
  - `job_distinct_pages`: Số trang khác nhau bị tác động trong job (A-13).
  - `calendar_day_creates`: Số task tạo trong ngày lịch >= 10 (R-17).
- `operator`: `"gt" | "gte" | "eq"`.
- `value`: Giá trị số nguyên.

### Trục 7: Bất khả nghịch & Phân quyền
- `is_irreversible: true` (FR-AP-05: tự động gate mọi thao tác không hoàn tác được).
- `changes_permission: true` (tự động gate thay đổi quyền chia sẻ).

---

## 3. Cây Logic Đệ quy (Recursive AST)

Các vị từ lá có thể được lồng ghép không giới hạn qua 3 node logic:
- `{"kind": "and", "predicates": [...]}`
- `{"kind": "or", "predicates": [...]}`
- `{"kind": "not", "predicate": {...}}`

Đặc tả JSON Schema chuẩn mực lưu tại: [`src/ir/schema.json`](file:///home/<user>/projects/desktop-assistant/spikes/SP-8-rule-ir-hardgate/src/ir/schema.json).
TypeScript interface chuẩn mực lưu tại: [`src/ir/types.ts`](file:///home/<user>/projects/desktop-assistant/spikes/SP-8-rule-ir-hardgate/src/ir/types.ts).
