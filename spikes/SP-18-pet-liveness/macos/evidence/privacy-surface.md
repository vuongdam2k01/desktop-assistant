# Privacy Surface Analysis & Zero-Persistent Title Boundary on macOS

**Spike:** SP-18/mac — Pet như một thực thể sống trên desktop macOS  
**Deliverable:** 3. macos/evidence/privacy-surface.md  
**Scope:** Q16 — Phân tích bề mặt quyền riêng tư ở các cấp quyền macOS & Thiết kế bộ lọc Zero-Persistent Title  
**Input for:** Living Spec `capabilities/platform/spec.md` (NFR-SEC-02, RISK-056)  
**Date:** 2026-09-13

---

## 1. Bối cảnh & Nguy cơ riêng tư (Privacy Risks)

Khác với Windows (nơi việc lấy danh sách cửa sổ và tiêu đề chỉ tốn một lệnh gọi Win32 API `GetWindowTextW` không cần cấp phép), trên macOS Apple kiểm soát quyền riêng tư chặt chẽ thông qua hệ thống **Transparency, Consent, and Control (TCC)**.

Việc con pet có thể "nhận biết môi trường xung quanh" (Screen Awareness) tạo ra nguy cơ rò rỉ dữ liệu cá nhân (Personally Identifiable Information - PII) nghiêm trọng:
- Tiêu đề cửa sổ trình duyệt (Safari, Chrome) chứa URL nội bộ, truy vấn tìm kiếm, token phiên làm việc, mã hồ sơ bệnh án hoặc giao dịch ngân hàng.
- Tiêu đề cửa sổ soạn thảo (VS Code, TextEdit) chứa đường dẫn file nhạy cảm, bí mật kinh doanh (`.env`, `passwords.txt`, hợp đồng mua bán).
- Nếu dữ liệu này bị ghi lại vào SQLite Action Ledger hoặc gửi lên mô hình ngôn ngữ lớn (LLM), ứng dụng sẽ vi phạm trực tiếp nguyên tắc bảo mật **NFR-SEC-02** và phá vỡ cam kết tin cậy của sản phẩm.

---

## 2. Bề mặt đọc dữ liệu ở từng cấp quyền TCC trên macOS (Measured Empirical Surface)

Dưới đây là bảng liệt kê chính xác những gì tiến trình có thể đọc được từ môi trường desktop tại từng mức quyền:

| Mức quyền TCC | API tương ứng trên macOS | Dữ liệu ĐỌC ĐƯỢC từ môi trường | Dữ liệu BỊ CHẶN (Không đọc được) | Rủi ro riêng tư | Đánh giá chấp thuận |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mức 0: Không quyền**<br>*(0 Permissions)* | `NSWorkspace.frontmostApplication`<br>`CGWindowListCopyWindowInfo` | - Tên ứng dụng đang foreground (`localizedName`: "Safari", "Code")<br>- Bundle ID (`com.apple.Safari`)<br>- PID tiến trình<br>- Danh sách toạ độ hình học cửa sổ `Bounds(X, Y, W, H)`<br>- Window ID và Window Layer | - **Tiêu đề cửa sổ (`kCGWindowName`)** bị trả về `nil` / rỗng<br>- Nội dung bên trong cửa sổ<br>- Con trỏ chuột / phím gõ của người dùng<br>- Toạ độ con trỏ nhập liệu Caret | **RẤT THẤP**<br>Không thu thập bất kỳ nội dung văn bản cá nhân nào. | **MẶC ĐỊNH BẬT 100%**<br>Hoạt động ngay từ giây đầu tiên cài đặt, không cần xin quyền. |
| **Mức 1: Accessibility**<br>*(kTCCServiceAccessibility)* | `AXUIElementCreateSystemWide`<br>`AXUIElementCopyAttributeValue` | - Toạ độ con trỏ nhập liệu Caret Position `(X, Y, W, H)`<br>- Cấu trúc cây phần tử giao diện (UI Tree: Buttons, TextFields)<br>- Trạng thái bàn phím/chuột qua Event Tap<br>- Tiêu đề cửa sổ đang focused | - Pixel hình ảnh màn hình<br>- Cửa sổ của các ứng dụng bảo mật (nhập mật khẩu Keychain) | **TRUNG BÌNH – CAO**<br>Có thể đọc được text trong các trường nhập liệu nếu cố tình traverse UI Tree. | **CẦN THIẾT CHO TƯƠNG TÁC**<br>Đã được cấp phép trong SP-0/mac cho hạ tầng điều khiển desktop. |
| **Mức 2: Screen Recording**<br>*(kTCCServiceScreenCapture)* | `screencapture`<br>`CGWindowListCreateImage`<br>`ScreenCaptureKit` | - **TOÀN BỘ TIÊU ĐỀ CỬA SỔ (`kCGWindowName`)** của mọi app<br>- Toàn bộ pixel hình ảnh hiển thị trên toàn màn hình | - Các vùng cấm Protected Content (Apple TV DRM, Secure Input) | **CỰC KỲ CAO (CRITICAL)**<br>Nhìn thấy toàn bộ màn hình của người dùng. | **❌ BÁC BỎ ĐỐI VỚI PET**<br>Tuyệt đối không bắt người dùng cấp quyền quay màn hình chỉ để nuôi pet. |

---

## 3. Quyết định sản phẩm đối với Q11: Quyền Screen Recording & Tiêu đề cửa sổ

Trong prompt của SP-18/mac:
> *"Q11. Lấy được TIÊU ĐỀ cửa sổ không, và nó đòi quyền nào? Nếu tiêu đề đòi quyền Screen Recording thì nêu rõ: bật tính năng này nghĩa là bắt người dùng cấp quyền quay màn hình cho một con pet. Đó là một quyết định sản phẩm, phải nêu thành đề xuất trong report chứ không tự quyết."*

### Đề xuất dứt khoát trình Product Owner:
1. **KHÔNG yêu cầu quyền Screen Recording (`kTCCServiceScreenCapture`) cho tính năng nhận diện ngữ cảnh của Pet.**
   - *Lý do 1 (Rào cản Onboarding):* Khi app yêu cầu quyền Screen Recording, macOS bật hộp thoại cảnh báo hệ thống: *"Desktop Assistant muốn ghi lại màn hình và âm thanh máy tính của bạn"*. Đây là rào cản tâm lý cực lớn đối với người dùng thử nghiệm closed beta.
   - *Lý do 2 (Cảnh báo phiền toái định kỳ trên macOS 15+):* Kể từ macOS 15 Sequoia, Apple hiển thị icon màu tím trên Menu bar và bật popup cảnh báo mỗi tháng một lần nhắc người dùng app đang ghi màn hình, gây cảm giác ứng dụng là phần mềm gián điệp.
   - *Lý do 3 (Không cần thiết):* Để con pet có thể "đậu" lên thanh tiêu đề, né tránh cửa sổ, hoặc đổi màu áo khi người dùng làm việc, pet chỉ cần:
     - Tên ứng dụng (`kCGWindowOwnerName`, ví dụ: `"Xcode"`, `"Safari"`, `"Notion"`).
     - Toạ độ hình học `Bounds(X, Y, W, H)`.
     Cả hai thông số này **hoàn toàn lấy được ở Mức 0 mà không cần bất kỳ quyền nào!**

---

## 4. Đặc tả Bộ lọc riêng tư Zero-Persistent Title trên macOS

Bản Windows đã chốt bộ lọc **Zero-Persistent Title** (ratified trong `req-018-pet-liveness` và `risks.md` RISK-056).

### Kết luận đối chiếu:
> **ÁP DỤNG NGUYÊN VẸN 100% TRÊN MACOS.**  
> Cơ chế lọc tại tầng RAM native của macOS thậm chí còn an toàn hơn Windows nhờ hàng rào TCC Mức 0 mặc định không trả về tiêu đề.

### Quy tắc triển khai bất biến (Invariants):
1. **Lọc sạch tại tầng Native trước khi vào JavaScript/Node.js:**
   - Trong module Objective-C/Swift (`liveness_helper`), chỉ trích xuất các trường:
     ```json
     {
       "windowId": 1234,
       "ownerName": "Google Chrome",
       "bundleId": "com.google.Chrome",
       "bounds": { "x": 100, "y": 100, "width": 1200, "height": 800 },
       "layer": 0
     }
     ```
   - Trường `kCGWindowName` (nếu có do app Antigravity tình cờ có quyền Screen Recording để chụp ảnh) **phải bị drop bỏ hoàn toàn khỏi bộ nhớ RAM native**, không bao giờ truyền qua IPC hay gán vào biến đối tượng trong Node.js.
2. **Cấm tuyệt đối ghi vào Ledger & Database:**
   - Không có bất kỳ cột hay trường nào trong schema SQLite Action Ledger được phép lưu trữ Window Title.
3. **Cấm tuyệt đối gửi lên LLM/Cloud:**
   - Context gửi cho Agent chỉ bao gồm: `"Active Application: Visual Studio Code"` kèm hình chữ nhật làm việc, không chứa tên file hay tiêu đề tài liệu.

---

## 5. Bảng tổng kết ranh giới tối thiểu đủ dùng (Minimal Viable Boundary)

| Tính năng của Pet | Thông tin tối thiểu cần thu thập | Quyền TCC cần thiết | Tác động riêng tư |
| :--- | :--- | :--- | :--- |
| **Phản ứng đổi trạng thái theo App** (ví dụ: ngủ khi mở game, chăm chỉ khi mở IDE) | `NSWorkspace.frontmostApplication.localizedName` | **0 permissions** | Không có rủi ro |
| **Đậu lên viền cửa sổ khác** | `CGWindowBounds` của Window ID mục tiêu | **0 permissions** | Không có rủi ro |
| **Né tránh chữ đang gõ** | Caret Coordinates `(X, Y)` từ Accessibility | **Accessibility** | An toàn (chỉ lấy toạ độ điểm ảnh, không đọc chuỗi gõ) |
| **Thẻ hội thoại Speech Bubble** | Toạ độ pet và `workArea` hiển thị | **0 permissions** | Không có rủi ro |
