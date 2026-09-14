# SP-1 — Năng lực bù trừ (compensating action) của Notion

## 0. Kết luận
**ĐI CÓ ĐIỀU KIỆN** — Notion có năng lực bù trừ tĩnh hoàn hảo (100% độ toàn vẹn thuộc tính) cho các thao tác ghi dữ liệu cốt lõi (tạo task, sửa thuộc tính, archive/unarchive), nhưng có 4 điều kiện ràng buộc kiến trúc bắt buộc phải tuân thủ trong connector manifest (FR-CF-01):
1. **Sắp xếp lại vị trí (Reorder)**: Notion API không có thuộc tính thứ tự hiển thị native (manual row order) — thao tác đổi thứ tự chỉ khả thi khi schema database có sẵn cột số thứ tự kiểu `number` (như Workspace C); nếu không có (như Workspace A), phải gắn cờ `unsupported/irreversible` cho thao tác sắp xếp tự do.
2. **Lọc Snapshot (Sanitizer)**: Bắt buộc phải lọc bỏ các thuộc tính computed/read-only (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`) trước khi gửi payload bù trừ, nếu không Notion API sẽ trả về lỗi HTTP 400 validation error.
3. **Thao tác Comment**: Bắt buộc gắn cờ `irreversible` 100% vì Notion API không cung cấp endpoint xóa hay sửa comment.
4. **Side-effects người dùng (Assignee)**: Gán người vào task sẽ kích hoạt thông báo email/push của Notion không thể thu hồi khi undo.

---

## 1. Trả lời từng câu hỏi

### Q1 — Với TỪNG thao tác ghi (create page, update properties, archive): trước khi ghi, đọc lại được bao nhiêu chi tiết? Property nào KHÔNG đọc/ghi lại được đầy đủ (rollup, formula, relation, created_by, created_time)?
- **Độ chi tiết đọc được trước khi ghi:**
  - `create page`: Trước khi ghi, trang chưa tồn tại nên snapshot là `null`.
  - `update properties`: `GET /v1/pages/:id` đọc được **100%** toàn bộ cấu trúc trang gồm: `id`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`, `archived`, `parent`, `url`, `icon`, `cover`, và toàn bộ dictionary `properties`.
  - `archive page`: Đọc được trọn vẹn 100% properties và trạng thái `archived: false`.
- **Các thuộc tính KHÔNG thể ghi lại được (Read-only / Computed):**
  - `created_time`, `created_by`: Notion trả về HTTP 400 (`Couldn't find editable properties` hoặc `property that exists`).
  - `last_edited_time`, `last_edited_by`: Hệ thống tự động ghi đè theo thời điểm gọi và identity của caller.
  - `formula`: Trả về HTTP 400 validation error khi cố ghi PATCH vào property formula (`evidence/data/q6_complex_schema_results.json`). Giá trị formula tính toán tự động dựa trên các property phụ thuộc.
  - `rollup`: Trả về HTTP 400 validation error khi cố ghi PATCH (`evidence/data/q6_complex_schema_results.json`). Giá trị rollup tự động tổng hợp từ relation.
- **Các thuộc tính đọc và ghi lại được đầy đủ:**
  - `title`, `rich_text`, `number`, `select`, `status`, `multi_select`, `date`, `people`, `checkbox`, `url`, `email`, `phone_number`, và `relation`.
- **Dẫn chứng:**
  - Code: `spikes/SP-1-notion-compensation/src/test_q1_q2_roundtrip.py:34-80`
  - Dữ liệu: `spikes/SP-1-notion-compensation/evidence/data/q1_q2_roundtrip_results.json`
  - Log thô: `spikes/SP-1-notion-compensation/evidence/raw_logs/q1_patch_created_time*.json`, `q1_patch_created_by*.json`

---

### Q2 — Công thức bù trừ tĩnh có tồn tại cho từng thao tác không? create→archive, update→update về snapshot, archive→unarchive. Unarchive khôi phục 100% hay mất mát gì?
- **Công thức bù trừ tĩnh hoàn toàn tồn tại cho cả 3 thao tác cơ bản:**
  1. **`create page` → `archive page`**:
     - Thao tác bù trừ: `PATCH /v1/pages/:id` với `{"archived": true}` (HTTP 200).
     - Đánh giá: Trang được đưa vào Notion Trash. Về mặt logic nghiệp vụ đạt **99%** (trang biến mất khỏi database view), nhưng để lại footprint trong Trash và ID UUID đã bị sinh ra không thể thu hồi.
  2. **`update properties` → `update về snapshot`**:
     - Thao tác bù trừ: `PATCH /v1/pages/:id` với payload chứa các trường writeable đã lưu trong snapshot.
     - Đánh giá: **100% dữ liệu thuộc tính nghiệp vụ được khôi phục** (Name, Due date, Status, Relation... khớp tuyệt đối). Chỉ có metadata hệ thống thay đổi: `last_edited_time` và `last_edited_by` được cập nhật sang thời điểm và agent thực hiện undo.
  3. **`archive page` → `unarchive page`**:
     - Thao tác bù trừ: `PATCH /v1/pages/:id` với `{"archived": false}` (HTTP 200).
     - Khôi phục: **100% toàn vẹn**. Trang quay lại database ban đầu, toàn bộ thuộc tính được giữ nguyên 100%, và **toàn bộ block con (child blocks) nằm trong trang được khôi phục nguyên vẹn** (thực nghiệm xác nhận block con vẫn nguyên vị trí và nội dung).
- **Dẫn chứng:**
  - Code: `spikes/SP-1-notion-compensation/src/test_q1_q2_roundtrip.py:82-200`
  - Dữ liệu: `spikes/SP-1-notion-compensation/evidence/data/q1_q2_roundtrip_results.json`
  - Log thô: `evidence/raw_logs/q2_compensate_archive*.json`, `q2_compensate_update*.json`, `q2_do_unarchive*.json`

---

### Q3 — Thao tác nào BUỘC gắn cờ irreversible?
1. **Thêm bình luận (`create_comment`)**:
   - Notion REST API **hoàn toàn không hỗ trợ** endpoint xóa (`DELETE /v1/comments/:id`) hay cập nhật (`PATCH /v1/comments/:id`). Bình luận một khi đã gửi sẽ lưu vĩnh viễn trên trang. **BUỘC GẮN CỜ IRREVERSIBLE 100%**.
2. **Gán người phụ trách (`Assignee` / property `people`)**:
   - Dữ liệu thuộc tính trên database có thể gỡ về ban đầu (bù trừ được), nhưng Notion tự động gửi email thông báo và in-app notification ngay khi gán. Thông báo này không thể thu hồi. **GẮN CỜ REVERSIBLE CÓ TÁC DỤNG PHỤ KHÔNG THỂ THU HỒI**.
3. **Xóa vĩnh viễn trang (Permanent Delete)**:
   - Notion API không có endpoint hard-delete (chỉ archive). Tuy nhiên nếu người dùng bấm "Delete permanently" (dọn thùng rác) trên giao diện web/app của Notion, trang mất vĩnh viễn, API trả về 404 và không thể unarchive.
4. **Sắp xếp lại trang trong database không có cột thứ tự**:
   - Nếu người dùng yêu cầu "sắp xếp task này lên trước task kia" trong database kiểu Workspace A (không có cột số thứ tự), thao tác này **không được hỗ trợ** qua API, buộc gắn cờ `unsupported/irreversible`.
- **Dẫn chứng:**
  - Code: `spikes/SP-1-notion-compensation/src/test_q3_irreversible.py`
  - Dữ liệu: `spikes/SP-1-notion-compensation/evidence/data/q3_irreversible_results.json`
  - Log thô: `evidence/raw_logs/q3_create_comment*.json`

---

### Q4 — "Di chuyển / sắp xếp lại task" (FR-NT-03) ánh xạ vào cái gì? Notion không có thuộc tính thứ tự native — agent phát hiện cột thứ tự/ưu tiên bằng cách nào khi mỗi workspace một schema? So sánh A (không có Order) với C (có).
- **Bản chất ánh xạ:**
  - Notion API không có thuộc tính native nào biểu diễn thứ tự kéo thả (manual drag-and-drop order) trong database view. Thử nghiệm gửi `PATCH /pages/:id` với `position` bị từ chối bằng HTTP 400 (`body.position should be not present`).
  - Trong **Workspace C (có cột `Order: number`)**: Thao tác sắp xếp lại ánh xạ trực tiếp thành cập nhật giá trị số của property `Order` (`PATCH {"properties": {"Order": {"number": X}}}`). Bù trừ bằng cách ghi trả lại số thứ tự cũ từ snapshot (đạt 100% độ toàn vẹn).
  - Trong **Workspace A (không có cột Order)**: Thao tác sắp xếp tự do không thể thực hiện qua API. Thao tác di chuyển duy nhất khả thi là di chuyển giữa các cột trạng thái (bằng cách PATCH trường `Status`), hoặc sắp xếp theo `Due date`.
- **Chiến lược Agent tự động dò Schema:**
  - Agent thực hiện `GET /v1/databases/:id` và duyệt danh sách properties với bộ quy tắc heuristic:
    1. **Cột Thứ tự**: Tìm property kiểu `number` có tên khớp regex `/(order|thứ tự|stt|vị trí|rank|pos)/i`.
    2. **Cột Độ ưu tiên**: Tìm property kiểu `select` hoặc `status` có tên khớp regex `/(priority|ưu tiên|mức độ|độ ưu tiên|urgency)/i`.
    3. **Cột Trạng thái**: Tìm property kiểu `status` hoặc `select` có tên khớp regex `/(status|trạng thái|state|tiến độ)/i`.
  - **Quy tắc cho Connector Manifest (FR-CF-01)**: Nếu không tìm thấy cột thứ tự số, connector phải thông báo cho Agent rằng database không hỗ trợ sắp xếp vị trí tuỳ ý.
- **Dẫn chứng:**
  - Code: `spikes/SP-1-notion-compensation/src/test_q4_ordering.py`
  - Dữ liệu: `spikes/SP-1-notion-compensation/evidence/data/q4_ordering_results.json`
  - Log thô: `evidence/raw_logs/q4_patch_native_position*.json`, `q4_reorder_task1*.json`, `q4_undo_reorder1*.json`

---

### Q5 — Ngưỡng rate limit thật (FR-NT-06): bao nhiêu req/giây, hành vi khi burst, 429 có Retry-After không?
- **Ngưỡng thực tế kiểm chứng:**
  - Tốc độ trung bình công bố là 3 req/giây.
  - **Hành vi Burst (Token Bucket)**: Hệ thống Notion cho phép một lượng burst ngắn khá lớn: thử nghiệm burst 15 request và 60 request đồng thời qua 30 worker threads hoàn tất trong ~1.4 - 1.6 giây với 100% trả về HTTP 200 OK.
  - Khi tăng tải lên **100 requests song song** (50 workers), Notion kích hoạt rate limit: 69 request đầu thành công, 31 request sau trả về **HTTP 429 Too Many Requests**.
- **Đặc tả phản hồi HTTP 429 từ Notion API:**
  - Header: Notion **CÓ** trả về header chuẩn `Retry-After: <số giây>` (ví dụ ghi nhận giá trị `49` và `40` giây).
  - Body JSON: Trả về object lỗi rõ ràng:
    ```json
    {
      "object": "error",
      "status": 429,
      "code": "rate_limited",
      "message": "You have been rate limited. Please try again later.",
      "additional_data": {
        "rate_limit_reason": "public_api_request_rate_limit",
        "retry_after": "49"
      }
    }
    ```
- **Hành vi với HTTP 200 thông thường:**
  - Notion **HOÀN TOÀN KHÔNG** trả về các header `X-RateLimit-*` (Limit, Remaining, Reset) trên các response 200. Dung lượng quota còn lại là hoàn toàn mờ đục (opaque) đối với client cho tới khi chạm trần 429.
- **Phạm vi áp dụng giới hạn:**
  - Rate limit áp dụng độc lập theo từng **Integration Token / Bot**, không áp dụng theo IP client (thực nghiệm xác nhận: trong khi Token A đang bị khoá cooldown 429, Token B gọi từ cùng 1 máy vẫn trả về HTTP 200 bình thường).
- **Dẫn chứng:**
  - Code: `spikes/SP-1-notion-compensation/src/test_q5_rate_limit.py`, `src/test_q5_find_429.py`
  - Dữ liệu: `spikes/SP-1-notion-compensation/evidence/data/q5_rate_limit_results.json`
  - Log thô: `evidence/raw_logs/q5_burst_probe_*.json`

---

### Q6 — Schema lạ của workspace B (rollup, formula, relation) đọc/ghi khác gì? Ghi vào formula/rollup được không? Snapshot chúng thế nào?
- **Đọc:**
  - `relation`: Trả về danh sách object ID `[{"id": "uuid"}]`.
  - `rollup`: Trả về cấu trúc tổng hợp `{"type": "array", "array": [{"type": "select", "select": {...}}], "function": "show_original"}`.
  - `formula`: Trả về kết quả tính toán tức thì `{"type": "number", "number": 8}`.
- **Ghi:**
  - Ghi vào `relation`: Thành công 100% bằng cách truyền mảng ID: `{"Project": {"relation": [{"id": "<proj_id>"}]}}`.
  - Ghi trực tiếp vào `formula` hoặc `rollup`: Bị từ chối ngay lập tức bằng lỗi **HTTP 400 validation_error** (`Days left.title should be defined, instead was undefined`).
- **Tính phản ứng (Reactivity):**
  - Khi thay đổi `Project` (relation), trường rollup `Project status` tự động tính toán lại và trả về giá trị mới ngay trong response GET kế tiếp, **không có độ trễ**.
  - Tương tự, khi đổi `Due date`, công thức formula `Days left` tự động cập nhật giá trị mới ngay lập tức.
- **Phương pháp Snapshot và Lọc (Sanitization):**
  - Không được đưa raw properties vào payload bù trừ. Phải qua bộ lọc loại bỏ toàn bộ `formula` và `rollup`. Chỉ cần lưu snapshot của các trường gốc (`relation` và `Due date`), khi undo các trường gốc này thì `rollup` và `formula` sẽ tự động phục hồi về giá trị ban đầu.
- **Dẫn chứng:**
  - Code: `spikes/SP-1-notion-compensation/src/test_q6_complex_schema.py`
  - Dữ liệu: `spikes/SP-1-notion-compensation/evidence/data/q6_complex_schema_results.json`
  - Log thô: `evidence/raw_logs/q6_patch_formula*.json`, `q6_patch_rollup*.json`, `q6_test_sanitized_patch*.json`

---

### Q7 — Mã lỗi thực tế 401/403/404/409/429; phân biệt "page bị xoá" với "mất quyền" bằng cách nào (quan trọng với undo)?
- **Bảng mã lỗi thực tế thu thập từ API thô:**
  - **HTTP 400**: `code: "validation_error"` — Gửi UUID sai định dạng chuỗi hoặc body sai schema.
  - **HTTP 401**: `code: "unauthorized"`, `message: "API token is invalid."` — Token sai hoặc bị thu hồi (FR-NT-07).
  - **HTTP 403**: `code: "restricted_resource"`, `message: "Insufficient permissions for this endpoint."` — Bot gọi tính năng không được cấp capabilities.
  - **HTTP 404**: `code: "object_not_found"` — Trang không tồn tại hoặc bot không được share quyền.
  - **HTTP 429**: `code: "rate_limited"` — Kèm header `Retry-After: <giây>`.
- **Phân biệt "Page bị xoá" vs "Mất quyền" cho cơ chế Undo:**
  - **Trường hợp Page bị đưa vào thùng rác (Trash / Archived)**: Notion **KHÔNG** trả về 404! API trả về **HTTP 200 OK** với trường `"archived": true`. Đây là phát hiện quan trọng: Undo-agent có thể nhận diện trang đang trong thùng rác và tự động unarchive trước khi khôi phục snapshot!
  - **Trường hợp Page bị xoá vĩnh viễn (Permanent Delete) vs Bị gỡ quyền truy cập (Unshared)**: Notion cố tình bảo mật bằng cách trả về **cùng một mã HTTP 404 `object_not_found`** cho cả hai trường hợp. API không cung cấp thông tin phân biệt.
  - **Giải pháp cấp kiến trúc**: Dựa vào SQLite Ledger (FR-UD-02). Nếu một `page_id` đã từng được agent thao tác thành công và ghi vào ledger, nhưng khi undo lại nhận được 404, hệ thống đánh dấu là `OBJECT_UNAVAILABLE_OR_DELETED`, kích hoạt cờ CONFLICT, dừng việc bù trừ tự động và báo cho người dùng đưa ra quyết định.
- **Dẫn chứng:**
  - Code: `spikes/SP-1-notion-compensation/src/test_q7_error_codes.py`
  - Dữ liệu: `spikes/SP-1-notion-compensation/evidence/data/q7_error_codes_results.json`
  - Log thô: `evidence/raw_logs/q7_error_400*.json`, `q7_error_401*.json`, `q7_error_404*.json`, `q7_get_archived_page*.json`

---

### Q8 — Property kiểu `status` vs `select`: ghi và snapshot khác nhau ra sao?
- **Khác biệt về Schema:**
  - `status`: Có cấu trúc phân nhóm (Groups: `To-do`, `In progress`, `Complete`) và options mặc định do Notion tự tạo.
  - `select`: Danh sách options phẳng, không có nhóm.
- **Khác biệt khi ghi (Write behavior):**
  - **Ghi option hợp lệ**: Cả hai đều hỗ trợ ghi bằng `name` hoặc bằng `id` (HTTP 200).
  - **Ghi option không có trong schema**:
    - `select`: Notion **tự động thêm option mới** vào database schema trên giao diện (HTTP 200).
    - `status`: Notion **từ chối quyết liệt**, trả về HTTP 400 (`Invalid status option. Status option "..." does not exist`).
  - **Xoá giá trị (Set null)**:
    - `select`: Trở về `None` (rỗng hoàn toàn).
    - `status`: Notion **KHÔNG CHO PHÉP RỖNG**. Khi gửi `status: null`, Notion tự động đưa giá trị về option mặc định của nhóm To-do (`Not started`).
- **Khác biệt khi Snapshot & Undo:**
  - Để đảm bảo an toàn tuyệt đối khi khôi phục, snapshot của cả hai nên lưu cả `id` và `name`.
  - Khôi phục `status` phải ưu tiên dùng `id` để tránh sai lệch khi người dùng đổi tên nhãn trên UI.
  - Nếu thao tác ban đầu ghi 1 option mới vào `select`, khi undo thì option đó vẫn còn nằm trong database schema (tạo ra schema leak nhỏ).
- **Dẫn chứng:**
  - Code: `spikes/SP-1-notion-compensation/src/test_q8_status_vs_select.py`
  - Dữ liệu: `spikes/SP-1-notion-compensation/evidence/data/q8_status_vs_select_results.json`
  - Log thô: `evidence/raw_logs/q8_write_bad_status*.json`, `q8_null_status*.json`, `q8_undo_by_name*.json`

---

## 2. Tác động lên ADR / PRD
- **PRD FR-NT-03 (Thao tác ghi)**: Cần bổ sung làm rõ: Thao tác sắp xếp lại thứ tự task (reorder) phụ thuộc vào sự tồn tại của cột thứ tự kiểu `number` trong database schema. Nếu database không có cột này, thao tác đổi vị trí tương đối không được hỗ trợ qua API.
- **PRD FR-NT-06 (Rate Limit)**: Cập nhật thông số kỹ thuật thực tế: Hàng đợi request nên đặt tốc độ mục tiêu 2.5 req/s (dưới ngưỡng 3 req/s của Notion); cấu hình backoff phải ưu tiên đọc header `Retry-After` (đơn vị giây) khi nhận HTTP 429; không thể dựa vào header cảnh báo trước vì Notion không gửi `X-RateLimit-*` trên response 200.
- **PRD FR-CF-01 (Connector Manifest)**: Manifest cho Notion connector bắt buộc phải định nghĩa bộ quy tắc lọc (sanitization) loại bỏ các trường computed (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`) khi sinh payload bù trừ.
- **PRD FR-UD-01 & FR-UD-02 (Undo và Conflict)**: Xác nhận cơ chế phát hiện: Trang trong Trash trả về HTTP 200 (archived=true) -> Undo-agent tự động unarchive được; trang trả về HTTP 404 -> Gắn cờ CONFLICT vì trang đã bị xoá vĩnh viễn hoặc mất quyền.

---

## 3. Đầu vào cho tài liệu kỹ thuật
1. **File Ma trận bù trừ**: `spikes/SP-1-notion-compensation/evidence/compensation-matrix.md` là tài liệu tham chiếu chuẩn cho việc thiết kế schema connector manifest (FR-CF-01).
2. **Quy tắc trích xuất Snapshot**: Bảng ánh xạ kiểu dữ liệu Notion sang payload PATCH chuẩn trong `src/test_q6_complex_schema.py:sanitize_properties_for_snapshot`.
3. **Thuật toán nhận diện Schema**: Hàm regex phát hiện cột thứ tự, ưu tiên, và trạng thái trong `src/test_q4_ordering.py:detect_ordering_schema`.
4. **Chính sách Backoff Rate Limit**: Đọc `Retry-After` header -> `int(seconds)` -> sleep `seconds + 0.5s` jitter.

---

## 4. Rủi ro mới phát hiện
1. **Rò rỉ Schema từ `select` (Schema Option Leak)**: Khi agent tạo một task với nhãn select mới, option đó được thêm vĩnh viễn vào schema database. Khi undo, chỉ có giá trị trên trang được gỡ bỏ, option thừa vẫn tồn tại trong cài đặt database của người dùng.
2. **Hành vi ngầm của `status` khi null**: Không thể để trống thuộc tính `status`. Nếu snapshot ban đầu là rỗng (trước khi tạo) mà undo set null, trang sẽ mang trạng thái `Not started` chứ không phải null.
3. **Thiếu thông tin báo trước Rate Limit**: Không có headers đếm quota còn lại trên request 200; hệ thống chỉ biết mình chạm ngưỡng khi đã nhận 429. Do đó hàng đợi request ở client (FR-NT-06) là chốt chặn duy nhất ngăn chặn lỗi này.
4. **Tác dụng phụ ngoài phạm vi API (Out-of-band Side Effects)**: Gán `Assignee` kích hoạt email notification không thể thu hồi. Cần hiển thị minh bạch trong preview undo (FR-AP-05).

---

## 5. Chưa trả lời được + vì sao
- **Tạo trang cấp workspace (Workspace-level private page)**: Token sử dụng trong spike là Internal Integration (PRD §13.5). Như đã xác nhận trong `docs/spike-inputs.md`, Notion API từ chối tạo trang cấp workspace đối với Internal Integration (`creating workspace-level private pages is not supported`). Năng lực này được gắn nhãn: **CHƯA KIỂM CHỨNG — cần public integration qua OAuth**.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài
- **Python**: 3.14.4 (Linux x86_64)
- **HTTP Client**: `urllib.request` (chuẩn Python 3.14, gọi REST trực tiếp không dùng SDK) & `requests` 2.32.5
- **Notion API Version**: `2022-06-28`
- **Hệ điều hành**: Linux (Ubuntu 24.04 LTS kernel 6.6)
