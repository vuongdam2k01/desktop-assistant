# BẢNG MA TRẬN BÙ TRỪ NOTION CONNECTOR (COMPENSATION MATRIX)

> **Đầu ra bắt buộc của Spike SP-1** — Làm đầu vào trực tiếp cho đặc tả **Connector Manifest Schema (FR-CF-01)**, hợp đồng ghi trước-snapshot (FR-NT-04), công thức bù trừ (FR-NT-05), và cơ chế Undo-agent (FR-UD-01/02).  
> **Cơ sở thực chứng:** 100% kiểm chứng trên 3 workspace Notion thật (`spike-a-simple`, `spike-b-complex`, `spike-c-order`) thông qua HTTP REST API thô.

---

## 1. Ma trận bù trừ theo từng thao tác ghi (FR-NT-03)

| Thao tác ghi | Snapshot trước-ghi lấy gì | Công thức bù trừ tĩnh (Compensating Action) | Tỷ lệ khôi phục | Mất mát / Tác dụng phụ không hoàn nguyên | Reversible? | Điều kiện gắn cờ Irreversible / Conflict |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| **Tạo task (Create page)** | `null` (Page chưa tồn tại) | `PATCH /v1/pages/{page_id}`<br>`{"archived": true}` | **99%** | Page nằm trong Trash của Notion; ID UUID bị tiêu hao (không tái sử dụng); footprint trong Trash. | **CÓ** | Chỉ irreversible nếu người dùng xoá vĩnh viễn (empty trash) trên Notion UI. |
| **Cập nhật tiêu đề (Name / Title)** | Snapshot `properties.{Name}.title[].text.content` | `PATCH /v1/pages/{page_id}`<br>`{"properties": {"Name": {"title": [{"text": {"content": snapshot_val}}]}}}` | **100%** | `last_edited_time` và `last_edited_by` cập nhật sang thời điểm undo. | **CÓ** | Gắn Conflict nếu `last_edited_time` tại thời điểm undo khác với sau khi agent ghi (người khác đã sửa). |
| **Cập nhật trạng thái (`status`)** | Snapshot `properties.{Status}.status` (lưu cả `id` và `name`) | `PATCH /v1/pages/{page_id}`<br>`{"properties": {"Status": {"status": {"id": snapshot_id}}}}` | **100%** | `last_edited_time` và `last_edited_by` thay đổi.<br>*(Lưu ý: Không thể set null; set null sẽ tự rơi về default option của To-do group)*. | **CÓ** | Gắn Conflict nếu option bị xoá khỏi schema hoặc có người sửa đè. |
| **Cập nhật lựa chọn (`select`)** | Snapshot `properties.{Status}.select` (lưu cả `id` và `name`, hoặc `null`) | `PATCH /v1/pages/{page_id}`<br>`{"properties": {"Status": {"select": {"id": snapshot_id}}}}`<br>hoặc `{"select": null}` nếu ban đầu rỗng | **100%** | `last_edited_time` thay đổi.<br>Nếu thao tác ghi ban đầu đã tự sinh 1 option mới vào database schema, việc rollback chỉ gỡ option khỏi page chứ không xoá option khỏi database schema. | **CÓ** | Gắn Conflict nếu người dùng sửa đè hoặc xoá option. |
| **Cập nhật ngày / deadline (`date`)** | Snapshot `properties.{Due date}.date` (`start`, `end`, `time_zone`) | `PATCH /v1/pages/{page_id}`<br>`{"properties": {"Due date": {"date": snapshot_val}}}` | **100%** | `last_edited_time` thay đổi. Các formula phụ thuộc (ví dụ `Days left`) tự động tính lại 100%. | **CÓ** | Gắn Conflict nếu người khác đã sửa deadline giữa chừng. |
| **Cập nhật người phụ trách (`people` / Assignee)** | Snapshot `properties.{Assignee}.people[].id` | `PATCH /v1/pages/{page_id}`<br>`{"properties": {"Assignee": {"people": [{"id": uid}, ...]}}}` | **90%** *(Dữ liệu 100%, Side-effect 0%)* | Gỡ người dùng thành công trên database, NHƯNG **email / push notification** Notion đã gửi đến người được gán ban đầu KHÔNG THỂ thu hồi. | **CÓ CÓ ĐIỀU KIỆN** | Cần hiển thị cảnh báo người dùng: "Đã gỡ assignee nhưng thông báo đã được gửi qua email của Notion." |
| **Cập nhật nhãn (`multi_select`)** | Snapshot `properties.{Tags}.multi_select[].name` | `PATCH /v1/pages/{page_id}`<br>`{"properties": {"Tags": {"multi_select": snapshot_opts}}}` | **100%** | `last_edited_time` thay đổi. Option mới sinh ra trong schema (nếu có) vẫn nằm trong schema database. | **CÓ** | Gắn Conflict nếu có chỉnh sửa đồng thời. |
| **Cập nhật liên kết (`relation`)** | Snapshot `properties.{Project}.relation[].id` | `PATCH /v1/pages/{page_id}`<br>`{"properties": {"Project": {"relation": snapshot_rel_ids}}}` | **100%** | `last_edited_time` thay đổi. Mọi Rollup phụ thuộc (ví dụ `Project status`) tự động recompute ngay lập tức. | **CÓ** | Gắn Conflict nếu page liên kết đích đã bị xoá vĩnh viễn. |
| **Sắp xếp lại / Đổi thứ tự (Có cột `Order: number` - như C)** | Snapshot `properties.{Order}.number` của các task bị hoán đổi | `PATCH /v1/pages/{page_id}`<br>`{"properties": {"Order": {"number": snapshot_num}}}` | **100%** | `last_edited_time` thay đổi. | **CÓ** | Gắn Conflict nếu thứ tự đã bị bên thứ ba thay đổi trước khi undo. |
| **Sắp xếp lại / Đổi vị trí (Không có cột Order - như A)** | Không tồn tại thuộc tính thứ tự | **KHÔNG CÓ CÔNG THỨC** (Notion API không hỗ trợ thuộc tính manual position trong view) | **0%** | Không thể đổi vị trí tương đối qua API. | **IRREVERSIBLE / UNSUPPORTED** | **BUỘC GẮN CỜ UNSUPPORTED / IRREVERSIBLE** ngay tại bước phân tích schema. Báo người dùng database thiếu cột Order. |
| **Xóa / Đưa vào thùng rác (Archive page)** | Snapshot toàn bộ writeable properties + `archived: false` | `PATCH /v1/pages/{page_id}`<br>`{"archived": false}` | **100%** | Khôi phục 100% properties, blocks con, relations, rollups, formulas. Chỉ có `last_edited_time` cập nhật. | **CÓ** | Gắn cờ Irreversible nếu người dùng đã bấm Empty Trash trên Notion GUI (API trả về 404). |
| **Xóa vĩnh viễn (Permanent Delete)** | Không có endpoint API | Không thể khôi phục qua API | **0%** | Mất hoàn toàn dữ liệu. | **IRREVERSIBLE** | **BUỘC GẮN CỜ IRREVERSIBLE 100%**. |
| **Thêm bình luận (Create comment)** | `null` | Notion API không có `DELETE /v1/comments/:id` hay `PATCH /comments` | **0%** | Comment sẽ tồn tại vĩnh viễn trên page / block. | **IRREVERSIBLE** | **BUỘC GẮN CỜ IRREVERSIBLE 100%**. Phải cảnh báo người dùng trước khi ghi (FR-AP-05). |
| **Xoá block con (Archive child block)** | Snapshot `block_id`, `type`, nội dung block | `PATCH /v1/blocks/{block_id}`<br>`{"archived": false}` | **100%** | Block được khôi phục tại đúng vị trí trong page. | **CÓ** | Khôi phục được trừ khi page cha bị xoá vĩnh viễn. |

---

## 2. Quy tắc lọc Snapshot (Sanitization Rules) bắt buộc cho Manifest (FR-CF-01)

Khi lấy snapshot đối tượng từ `GET /v1/pages/{page_id}`, connector **TUYỆT ĐỐI KHÔNG** gửi nguyên vẹn object `properties` vào payload bù trừ `PATCH /v1/pages/{page_id}`. Nếu gửi nguyên vẹn, Notion API sẽ trả về lỗi **HTTP 400 validation_error**.

### Danh sách các trường READ-ONLY bắt buộc loại bỏ khỏi snapshot payload:
1. `formula` (Computed tự động từ biểu thức Notion).
2. `rollup` (Computed tự động từ quan hệ relation).
3. `created_time` (Thời điểm tạo trang — bất biến).
4. `created_by` (Người tạo trang — bất biến).
5. `last_edited_time` (Thời điểm sửa trang — hệ thống Notion tự sinh).
6. `last_edited_by` (Người sửa trang — hệ thống Notion tự gán token caller).

### Danh sách các trường WRITEABLE hợp lệ được đưa vào snapshot payload:
- `title` -> `{"title": [{"text": {"content": "..."}}]}`
- `rich_text` -> `{"rich_text": [{"text": {"content": "..."}}]}`
- `number` -> `{"number": 123}` hoặc `null`
- `select` -> `{"select": {"id": "..."}}` hoặc `{"select": {"name": "..."}}` hoặc `null`
- `status` -> `{"status": {"id": "..."}}` hoặc `{"status": {"name": "..."}}` *(Lưu ý: status không nhận null hoàn toàn mà fallback về default)*
- `multi_select` -> `{"multi_select": [{"name": "..."}, ...]}`
- `date` -> `{"date": {"start": "...", "end": "..."}}` hoặc `null`
- `people` -> `{"people": [{"id": "user_id"}, ...]}`
- `checkbox` -> `{"checkbox": true / false}`
- `url`, `email`, `phone_number` -> string hoặc `null`
- `relation` -> `{"relation": [{"id": "target_page_id"}, ...]}`

---

## 3. Quy tắc xử lý Conflict và Trạng thái bất khả kháng (FR-UD-02)

| Mã HTTP / Trạng thái | Ý nghĩa thực tế từ kiểm chứng API | Hành vi xử lý của Undo-Agent |
| :--- | :--- | :--- |
| **HTTP 200** kèm `archived: true` | Page đang nằm trong thùng rác Notion Trash. | Tự động gọi `PATCH {"archived": false}` để mở lại page, sau đó áp dụng snapshot bù trừ. |
| **HTTP 404** `object_not_found` | Page đã bị xoá vĩnh viễn (dọn rác GUI) HOẶC bot bị thu hồi quyền truy cập trang. | Đánh dấu **CONFLICT**: Không thể khôi phục. Báo người dùng trang không còn tồn tại hoặc đã mất quyền. |
| **HTTP 401** `unauthorized` | Token OAuth hết hạn hoặc bị thu hồi (FR-NT-07). | Chuyển job sang `failed`. Yêu cầu kết nối lại Notion. |
| **HTTP 400** `validation_error` | Payload snapshot không hợp lệ (ví dụ chứa trường read-only hoặc option status không tồn tại). | Lỗi logic connector: Fallback sang undo từng trường độc lập, ghi log lỗi. |
| **HTTP 429** `rate_limited` | Chạm trần rate limit (burst quá 60 req hoặc quá 3 req/s liên tục). | Đọc header `Retry-After` (đơn vị: giây), chờ đúng số giây ghi trong header + 0.5s jitter rồi retry. |
| **Khác biệt `last_edited_time`** | `page.last_edited_time` hiện tại mới hơn thời điểm agent thực hiện lệnh ban đầu. | Đánh dấu **CONFLICT**: Người dùng hoặc bot khác đã chỉnh sửa task sau khi agent chạy. Hỏi người dùng có muốn ghi đè không. |
