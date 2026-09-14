# Danh mục Mẫu Quy Tắc Phê Duyệt (Rule Patterns Catalog) — Input cho SP-8 Rule IR

> Tạo từ kết quả Spike SP-2 (11/09/2026).
> Đây là ĐẦU RA QUAN TRỌNG NHẤT của SP-2: danh sách các mẫu quy tắc bắt buộc mà kiến trúc Rule IR (SP-8) và Evaluator cứng phải diễn đạt được mà không cần đọc lại toàn bộ transcript.

---

## 1. Trục phân loại biểu thức điều kiện (Predicate Axes)

Dựa trên phân tích toàn bộ 20 quy tắc R-01..R-20 và các quyết định đã chốt của Product Owner (11/09/2026), Rule IR bắt buộc phải có các trường biểu diễn cho 7 trục điều kiện:

1. **Thao tác / Tool Call (`tool_pattern`)**:
   - Khớp danh sách tool: `archive_page`, `delete_block`, `update_page_properties`, `create_page`, `update_database`.
   - Khớp nhóm thao tác: `WRITE_TOOLS = {create_page, update_page_properties, archive_page, delete_block, update_database}`.
   - Thao tác ĐỌC (`query_database`, `get_page`, `search`) luôn được miễn trừ theo thiết kế (R-10).

2. **Đối tượng & Vùng tác động (`target_scope`)**:
   - `target.database_id == <id>`: Định danh database đích cụ thể (neo theo UUID, không neo theo tên chuỗi hiển thị).
   - `target.database_id in <list_of_ids>`: Nhóm database (ví dụ: database team R-06).
   - `target.id in <ancestor_ids>`: Phân cấp phân vùng (page con/database con nằm dưới một page gốc, ví dụ Q3 roadmap R-10).

3. **Thuộc tính thay đổi (`property_change` / `property_transition`)**:
   - `changed_properties contains <prop_name>`: Ví dụ `Due date in changed_properties` (R-02), `Assignee in changed_properties` (R-11).
   - `property_transition`: Chuyển đổi trạng thái cụ thể:
     * `Status.new == 'Done'` (chỉ chặn khi mark Done, R-05).
     * `Assignee.new != {current_user}` (chặn khi gán cho người khác, R-11).
     * `Assignee.new contains <boss_id>` (gán cho sếp).

4. **Thời gian máy (`temporal_condition`)**:
   - Đánh giá theo đồng hồ hệ thống (`local_time`, múi giờ máy người dùng UTC+7):
     * `local_time not in [08:00, 18:00)` (ngoài giờ làm việc, R-04).
     * `day_of_week in [Saturday, Sunday]` (cuối tuần chặn cả ngày theo quyết định PO, R-04).

5. **Quyền sở hữu / Tác giả (`ownership_condition`)**:
   - `target.created_by`: Người tạo đối tượng:
     * `target.created_by not in {current_user, app_bot}` (đối tượng không do người dùng hoặc bot của người dùng tạo, R-12; PO chốt bot = user).
     * `target.created_by in PM_USER_IDS` (task do PM Linh/Tuấn tạo, R-13).
   - `target.Assignee`: Người phụ trách:
     * `current_user in target.Assignee` (task gán cho tôi).
     * `Linh_id in target.Assignee` HOẶC `target.created_by == Linh_id` (R-08; PO chốt cả hai OR).

6. **Ngưỡng số lượng & Trạng thái tích luỹ (`threshold_condition`)**:
   - `job_cumulative_count(write_operations) > 5`: Tổng số thao tác ghi trong cùng 1 job vượt quá ngưỡng 5 (R-15 theo quyết định PO).
   - `job_cumulative_count(changed_property == 'Due date') > 3`: Đổi deadline quá 3 task trong cùng 1 job (R-16).
   - `calendar_day_count(create_page) >= 10`: Đếm xuyên job trong ngày lịch từ 00:00 (R-17, đòi hỏi bộ đếm bền trong SQLite ledger).

7. **Ngoại lệ dựa trên trạng thái Job / Ledger (`exception_predicate`)**:
   - `target.page_id in ledger[current_job].created_page_ids`: Ngoại lệ cho phép xoá/archive task nếu chính job hiện tại vừa tạo ra task đó (R-07).

---

## 2. Bảng Ma Trận 20 Mẫu Quy Tắc (R-01 .. R-20) cho SP-8

| Mã | Câu nói ví dụ từ corpus | Điều kiện logic Rule IR bắt buộc | Hành động IR | Độ khó biểu diễn | Khả năng biên dịch |
| --- | --- | --- | --- | --- | --- |
| **R-01** | *"xoá gì cũng phải hỏi tao trước"* | `tool in [archive_page, delete_block]` | `APPROVAL` | Dễ | CÓ |
| **R-02** | *"đụng đến deadline là phải báo"* | `tool == update_page_properties AND 'Due date' in changed_properties` (không áp cho create) | `APPROVAL` | Dễ | CÓ |
| **R-03** | *"đừng đụng vào database HR portal"* | `tool in WRITE_TOOLS AND target.database_id == HR_PORTAL_DB_ID` | `APPROVAL` | Dễ | CÓ |
| **R-04** | *"ngoài giờ làm việc đừng tự ý sửa gì"* | `tool in WRITE_TOOLS AND (local_time not in [08:00, 18:00) OR is_weekend(local_time))` | `APPROVAL` | Dễ | CÓ |
| **R-05** | *"status cứ update dont ask, except khi mark Done"* | `tool == update_page_properties AND Status.new == 'Done'` | `APPROVAL` | Dễ | CÓ |
| **R-06** | *"chỉ tạo task trong personal, cấm tạo vào team"* | `tool == create_page AND target.database_id in TEAM_DB_IDS` | `APPROVAL` | Dễ | CÓ |
| **R-07** | *"đừng archive task trừ khi chính mày vừa tạo trong lần chạy này"* | `tool == archive_page AND target.page_id not in ledger[current_job].created_pages` | `APPROVAL` | Khó (cần ledger job) | CÓ |
| **R-08** | *"task của Linh thì đừng đụng vào"* | `tool in WRITE_TOOLS AND ('Linh' in target.Assignee OR target.created_by == 'Linh')` | `APPROVAL` | Trung bình | MỘT PHẦN (ngoại lệ chat ngoài duyệt tay) |
| **R-09** | *"đừng bao giờ archive cả database"* | `tool == archive_database OR (tool == update_database AND archived == true)` | `DENY` (Hardline) | Dễ | CÓ |
| **R-10** | *"never touch the Q3 roadmap page and its children"* | `tool in WRITE_TOOLS AND ROADMAP_PAGE_ID in (target.id + target.ancestor_ids)` | `DENY` | Trung bình (cây phả hệ) | CÓ |
| **R-11** | *"đừng tự ý đổi assignee của người khác, nhất là gán cho sếp"* | `tool == update_page_properties AND Assignee in changed_properties AND Assignee.new != {current_user}` | `APPROVAL` | Trung bình | CÓ |
| **R-12** | *"task ko phải tao tạo thì đừng sửa"* | `tool in {update_page_properties, archive_page, delete_block} AND target.created_by not in {current_user, app_bot}` | `APPROVAL` | Trung bình (bot=user) | CÓ |
| **R-13** | *"for PM-created tasks, status only. nothing else"* | `target.created_by in PM_IDS AND (tool != update_page_properties OR changed_properties - {'Status'} != empty)` | `APPROVAL` | Trung bình | CÓ |
| **R-14** | *"task của tao thì làm gì cũng đc, còn lại thì hỏi"* | `tool in WRITE_TOOLS AND NOT (current_user in target.Assignee OR target.created_by in {current_user, app_bot})` | `APPROVAL` | Trung bình | CÓ |
| **R-15** | *"sửa nhiều quá thì hỏi tao, đừng tự làm 1 đống"* | `count_distinct(job_modified_pages) > 5` | `APPROVAL` | Trung bình (đếm job) | CÓ |
| **R-16** | *"changing deadline of more than 3 tasks at once → confirm"* | `tool == update_page_properties AND 'Due date' in changed_properties AND count_distinct(job_deadline_modified_pages) > 3` | `APPROVAL` | Trung bình (lũy kế job) | CÓ |
| **R-17** | *"dont let it create more than like 10 tasks a day"* | `tool == create_page AND count(ledger.created_pages, since=today_00_00) >= 10` | `APPROVAL` | Khó (bộ đếm bền ledger) | CÓ |
| **R-18** | *"đừng làm gì ngu ngốc"* | Không có vị từ kỹ thuật -> **TỪ CHỐI TẠO RULE IR CỨNG**. Gợi ý Smart Mode. | `UNSUPPORTED` | Rất khó (ngữ nghĩa mờ) | KHÔNG |
| **R-19** | *"cái gì quan trọng thì hỏi tao, còn lại tự xử"* | Chặn cứng phần định nghĩa: `tool in WRITE_TOOLS AND (Priority == 'High' OR Due_date <= today+3d)`. Phần cảm nhận mờ giao Smart Mode. | `APPROVAL` | Khó (rút gọn vị từ) | MỘT PHẦN |
| **R-20** | *"just make sure nothing breaks the sprint ok"* | Không có thuộc tính Sprint -> **TỪ CHỐI TẠO RULE IR CỨNG**. Gợi ý map sang Due date. | `UNSUPPORTED` | Rất khó (thiếu schema) | KHÔNG |

---

## 3. Phân tích Ranh giới Cái KHÔNG biểu diễn được (Boundary of Uncompilability)

Theo FR-AP-04 và các bài học từ SP-2:

1. **Khái niệm mang tính đánh giá cảm tính / chủ quan (R-18 - "ngu ngốc", "hợp lý", "nguy hiểm")**:
   - *Lý do không biểu diễn được:* Rule IR là hệ thống deterministic không dùng LLM khi đánh giá ở hard gate. Khái niệm như "ngu ngốc" không có trường tương ứng trong payload tool call.
   - *Hành vi chuẩn của Elicitation Agent:* Phải từ chối tạo rule confirmed, cảnh báo rõ cho người dùng, và điều hướng: "Hệ thống chặn cứng không thể nhận diện hành vi 'ngu ngốc'. Để phòng ngừa rủi ro tổng quát, bạn có thể bật chế độ Smart Mode (LLM Risk Judge) hoặc thiết lập các quy tắc cụ thể (như cấm xoá, giới hạn số lượng)".
   - *Lỗi nghiêm trọng cần cấm:* Tuyệt đối không âm thầm hạ cấp bằng cách thêm dòng "Hãy cẩn thận, đừng làm gì ngu ngốc" vào system prompt của worker agent rồi báo cho người dùng là đã thiết lập xong.

2. **Khái niệm phụ thuộc vào ngữ cảnh ngoài hệ thống (R-08 - "trừ khi Linh nhắn qua tin nhắn ngoài")**:
   - *Lý do không biểu diễn được:* Desktop Assistant tương tác Notion không có quyền đọc tin nhắn Slack/Zalo cá nhân của người dùng với Linh tại thời điểm chạy tool call.
   - *Hành vi chuẩn của Elicitation Agent:* Giải thích rằng ngoại lệ này không tự động nhận biết được; quy tắc sẽ chặn cứng mọi hành vi sửa task của Linh, và khi bot dừng hỏi phê duyệt, người dùng sẽ tự bấm Approve nếu đã có tin nhắn của Linh.

3. **Thuộc tính không tồn tại trong Schema của Workspace (R-20 - "Sprint")**:
   - *Lý do không biểu diễn được:* Cả 3 workspace Notion (A, B, C) đều không có thuộc tính kiểu `Sprint` hay `Iteration`.
   - *Hành vi chuẩn của Elicitation Agent:* Thông báo workspace hiện tại không có thuộc tính Sprint. Không được tự ý bịa ra trường "Sprint" trong IR. Hướng dẫn người dùng chọn thuộc tính thay thế (ví dụ: Due date trong tuần này, hoặc Priority High).

---

## 4. Khuyến nghị kiến trúc Rule IR cho SP-8

1. **Cấu trúc JSON Schema đóng (Closed Deterministic Schema)**:
   - Một rule IR gồm: `id`, `name`, `action` (`APPROVAL` | `DENY`), `priority`, `predicate`.
   - `predicate` là cây biểu thức logic đệ quy gồm:
     * Logic nodes: `{"and": [...]}`, `{"or": [...]}`, `{"not": ...}`
     * Comparison nodes: `{"field": "...", "operator": "eq"|"in"|"contains"|"gt"|"gte", "value": ...}`
     * Ledger query nodes: `{"ledger_counter": "job_modified_pages", "operator": "gt", "value": 5}`
2. **Không phụ thuộc LLM tại Runtime**:
   - Evaluator của SP-8 phải chạy hoàn toàn bằng TypeScript / regex / so sánh logic thuần túy (<1ms) để đảm bảo độ trễ không làm chậm vòng lặp agent (NFR-RL).
3. **Hai cổng hành động phân biệt rõ rệt**:
   - `APPROVAL`: Treo tool call, kích hoạt Card phê duyệt trên UI Pet/Electron để người dùng bấm (Allow / Deny).
   - `DENY`: Hardline blocklist (FR-AP-10) từ chối lập tức, ghi lỗi vào ledger, không hiển thị nút Allow cho người dùng.
