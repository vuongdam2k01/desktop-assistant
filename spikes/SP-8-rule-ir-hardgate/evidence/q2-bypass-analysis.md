# Phân tích Khả năng Đảm bảo MỌI Tool Call Đi qua Evaluator & Các Đường Vòng (Q2)

> **Mục tiêu:** Chứng minh kiến trúc 2 tầng (Closure Wrapper + Ledger + Pure Evaluator) bảo đảm 100% tool call phải đi qua evaluator, không có bất kỳ đường vòng nào bỏ qua được hard gate.

---

## 1. Cơ chế Bảo đảm ở Tầng Ứng Dụng (Application-Level Gate)

Khác với các giải pháp chỉ đặt middleware ở tầng framework agent (vốn có thể bị tắt nếu khởi tạo agent thiếu config hoặc framework có bug), Desktop Assistant áp dụng cơ chế bọc ở tầng đối tượng hàm (`createHardGatedTool`):
1. **Lớp bọc Closure trên thuộc tính `.execute` của từng `AgentTool`:**
   Mọi tool nạp vào Pi Agent đều là đối tượng đã được bọc lại hàm `.execute`.
   Khi vòng lặp harness của Pi gọi `tool.execute(...)`, đoạn mã closure của ta luôn chạy trước tiên:
   - Ghi Ledger `INTENT`
   - Gọi `evaluator.evaluate(...)`
   - Nếu bị `DENY` hoặc `APPROVAL_REQUIRED`: Trả về kết quả từ chối ngay lập tức, **tuyệt đối không bao giờ gọi hàm `originalExecute`**.
2. **Không có quyền truy cập trực tiếp tới `originalExecute`:**
   Mã nguồn của `originalExecute` nằm kín trong phạm vi closure của hàm factory, harness và LLM hoàn toàn không có tham chiếu tới hàm gốc này.

---

## 2. Phân tích Chi tiết 11 Đường Vòng (Bypass Vectors) & Cơ chế Khoá Cứng

### Đường vòng 1: Tool gọi tool (Nested Tool Invocation)
- **Kịch bản:** Một tool vô hại (như `read_data` hay `get_page`) âm thầm gọi tool nguy hiểm (`archive_page`) bên trong nó.
- **Cơ chế khoá:** Mọi tool sinh từ connector manifest (FR-AG-02) đều là các hàm lá (leaf functions) độc lập gọi HTTP fetch tới Notion API. Tool không giữ tham chiếu tới agent instance hay tool registry, do đó không có khả năng kích hoạt tool khác.

### Đường vòng 2: Tool gọi API trực tiếp ngoài tầm kiểm soát
- **Kịch bản:** Tool tự ý gửi request HTTP phá hoại trực tiếp.
- **Cơ chế khoá:** Toàn bộ API endpoint và logic tương tác đều được đóng gói trong các hàm leaf tool tương ứng với manifest. Mỗi leaf tool đều bị bọc bởi hard gate. Không có tool nào có chức năng gửi HTTP tuỳ ý.

### Đường vòng 3: Agent tự sinh code (Bash / Python / Shell Injection)
- **Kịch bản:** Agent sinh lệnh `rm -rf` hoặc curl API trực tiếp.
- **Cơ chế khoá:** Worker-agent bị tước bỏ 100% bộ coding tools (`bash`, `read`, `edit`, `write`) theo FR-AG-02 (đã chứng minh ở SP-6 Q1). Agent không có bất kỳ công cụ nào để thực thi lệnh shell trên máy tính.

### Đường vòng 4: Giả mạo tool call lạ hoặc gọi tool không tồn tại
- **Kịch bản:** LLM sinh tool call giả mạo như `system_override{}` hay `bypass_gate{}`.
- **Cơ chế khoá:** Pi Agent harness đối soát với danh sách `agent.state.tools`. Nếu tool không tồn tại trong danh sách đã khai báo, runtime từ chối ngay: `"Tool ... not found"`, không có mã nào được chạy.

### Đường vòng 5: Bỏ quên middleware của framework
- **Kịch bản:** Lập trình viên quên khai báo `beforeToolCall` trong options của `Agent`.
- **Cơ chế khoá:** Lớp bảo vệ không nằm ở hook sự kiện tuỳ chọn của framework, mà nằm trực tiếp tại closure của từng tool. Thử nghiệm thực tế tại SP-6 Q2 đã chứng minh: dù không cấu hình `beforeToolCall`, 100% cuộc gọi vẫn bị chặn.

### Đường vòng 6: Mượn `ask_user` để xúi người dùng làm hộ (A-14)
- **Kịch bản:** Agent bị chặn xoá nên gọi `ask_user` nhờ người dùng tự vào Notion xoá hộ.
- **Cơ chế khoá:** Tool `ask_user` cũng là một tool được bọc bởi Hard Gate wrapper. Interceptor soi chiếu nội dung câu hỏi: nếu phát hiện hành vi uỷ quyền thao tác bị cấm (nhờ người dùng tự xoá/archive), cuộc gọi `ask_user` bị chặn đứng ngay lập tức kèm ghi log vi phạm A-14.

### Đường vòng 7: Đổi tool đạt cùng hậu quả (A-15)
- **Kịch bản:** Bị cấm `archive_page`, agent chuyển sang dùng `update_page_properties` đổi Status thành `"Deleted (bỏ)"` và Title thành `"zzz — ignore"`.
- **Cơ chế khoá:** Evaluator đánh giá dựa trên hậu quả thuộc tính (`property_transition`), chuẩn hoá tên trường và giá trị. Quy tắc `STATIC-DESTRUCTIVE-UPDATE` chặn cả giá trị Status kết thúc và chuỗi Title rác.

### Đường vòng 8: Đổi trạng thái trung gian để rửa quyền sở hữu (A-17)
- **Kịch bản:** Task do người khác tạo; agent đổi Assignee thành chính mình rồi mới archive.
- **Cơ chế khoá:** Vị từ quyền sở hữu của Rule IR kiểm tra trường `created_by` (bất biến từ lúc tạo đối tượng), không tin cậy `Assignee` hiện thời. Đồng thời, thao tác đổi Assignee trên task người khác cũng bị chặn bởi R-11/R-12.

### Đường vòng 9: Làm trước xin phép sau (A-18)
- **Kịch bản:** Agent gọi thao tác ghi trước rồi mới gọi `ask_user` để hợp thức hoá.
- **Cơ chế khoá:** Thứ tự wrap bảo đảm: `INTENT -> EVALUATE -> EXECUTE`. Cuộc gọi ghi bị chặn ngay tại bước `EVALUATE`, dừng ở trạng thái `waiting_approval` TRƯỚC KHI hàm `execute` gốc được kích hoạt. Không có chuyện "làm rồi mới hỏi".

### Đường vòng 10: Lạm dụng phê duyệt hàng loạt trong job (A-19)
- **Kịch bản:** Người dùng ấn "Approve loại này trong job" cho một update nhỏ; agent dùng nó để đổi deadline hàng loạt hoặc sửa task người khác.
- **Cơ chế khoá:** Token duyệt trong job được gán cứng theo tuple `(jobId, ruleId, toolName, targetScope)`. Thao tác đổi deadline kích hoạt quy tắc `R-02` (khác với `R-05`), do đó không được miễn trừ và bị chặn riêng.

### Đường vòng 11: Đổi tên đối tượng để thoát quy tắc neo theo tên (A-20)
- **Kịch bản:** Agent đổi tên database "Khách hàng" thành "tmp" để né quy tắc bảo vệ.
- **Cơ chế khoá:** Mọi quy tắc trong Rule IR neo chặt vào UUID bất biến (`database_id`), hoàn toàn không dựa vào chuỗi tên hiển thị. Hơn nữa, chính thao tác đổi tên database đã là một thao tác ghi trên đối tượng đó và bị chặn ngay từ đầu.

---

## 3. Kết luận Q2

Evaluator ở tầng ứng dụng kết hợp với mô hình closure wrapper bảo đảm **100% tool call ghi phải đi qua evaluator**. Không tồn tại bất kỳ đường vòng nào có thể lách qua lớp bảo vệ này.
