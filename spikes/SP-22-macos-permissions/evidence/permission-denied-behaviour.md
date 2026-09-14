# Đặc tả Hành vi khi Bị Từ Chối Quyền trên macOS (Permission Denied Behavior)

> **Báo cáo trích dẫn:** SPIKE `SP-22` (M0)  
> **Tham chiếu PRD:** Phụ lục A.2 (Hệ card — anatomy chuẩn loại `SYSTEM`), FR-INT-02, FR-INT-14, FR-APP-01, NFR-SEC-02  
> **Quy tắc thiết kế:**  
> 1. **Fail-safe & Graceful Degradation:** Thiếu bất kỳ quyền hệ thống nào cũng **TUYỆT ĐỐI KHÔNG ĐƯỢC CRASH APP** hay làm tê liệt vòng lặp giao việc cơ bản.  
> 2. **Phát hiện im lặng (Silent Preflight):** Sử dụng các API kiểm tra trạng thái quyền không bật hộp thoại trước khi chạm vào API nguy hiểm.  
> 3. **Hướng dẫn khắc phục 1-click:** Mọi thông báo lỗi loại `SYSTEM` đều có nút bấm mở trực tiếp trang cài đặt tương ứng trong System Settings qua URL scheme.

---

## 1. Bảng tổng hợp hành vi khi bị từ chối theo từng quyền

| Quyền hệ thống | API kiểm tra âm thầm (Preflight) | Tính năng bị tắt | Chế độ chạy dự phòng (Fallback) | SYSTEM Card phát sinh (Phụ lục A.2) | Deep Link mở System Settings | Cần Restart app sau khi bật? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Screen Recording** (`kTCCServiceScreenCapture`) | `CGPreflightScreenCaptureAccess()` | Nhận diện ngữ cảnh cửa sổ làm việc (M3); đọc tiêu đề cửa sổ khác (`kCGWindowName`). | Chế độ "Pet Không Nhận Biết Màn Hình" (Blind Pet): Pet vẫn cử động, nhận lệnh ô thoại, chạy job qua Notion/Gmail bình thường. | **SYS-CARD-SCR-01** (Mức Info/Warning, Non-blocking) | `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture` | **CÓ** (Bắt buộc "Quit & Reopen") |
| **Accessibility** (`kTCCServiceAccessibility`) | `AXIsProcessTrusted()` | Tự động né tránh vị trí con trỏ đang gõ phím (Caret Evasion); pet bám mép cửa sổ khác; khôi phục focus chính xác (FR-PET-03). | Pet di chuyển tự do hoặc đỗ ở mép màn hình; trả focus lùi về cơ chế `[NSApp hide:]`. | **SYS-CARD-ACC-01** (Mức Info, Non-blocking) | `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility` | **KHÔNG** (Có hiệu lực tức thì 0ms) |
| **User Notifications** (`UNUserNotificationCenter`) | `getNotificationSettings` $\rightarrow$ `status == Denied` | Banner và âm thanh thông báo hệ thống khi pet đang bị ẩn (FR-INT-14). | Thông báo dồn thành số đếm huy hiệu (badge number) trên khay Menu Bar Tray icon. | Hiển thị Banner trong App Settings (Không bung pop-up trên desktop). | `x-apple.systempreferences:com.apple.preference.notifications` | **KHÔNG** (Hiệu lực tức thì) |
| **Login Items** (`SMAppService.mainApp`) | `SMAppService.status == RequiresApproval` | Tự động khởi chạy khi người dùng đăng nhập macOS. | Người dùng mở app thủ công qua Spotlight / Launchpad / `/Applications`. | Hiển thị cảnh báo trong App Settings > General. | `x-apple.systempreferences:com.apple.preference.general?LoginItems` | **KHÔNG** (Hiệu lực tức thì) |
| **Files & Folders** (`~/Desktop`, `~/Documents`) | `access(path, R_OK) != 0` khi kéo thả file | Đọc trực tiếp file đính kèm từ 3 thư mục nhạy cảm bằng đường dẫn thô. | Kích hoạt hộp thoại chọn file chuẩn macOS (`dialog.showOpenDialog`) để lấy quyền qua User-Intent. | **SYS-CARD-FILE-01** (Mức Warning, Non-blocking) | `x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders` | **KHÔNG** (Hiệu lực tức thì) |
| **Keychain Access** (Security Framework ACL) | `safeStorage.isEncryptionAvailable() == false` hoặc lỗi `-128` | Giải mã Master Key để đọc token Notion, Google và API keys. | Toàn bộ worker-agent tạm dừng; không thể thực thi tool call ra ngoài. | **SYS-CARD-KEY-01** (Mức Error, Persistent Badge) | `Keychain Access.app` hoặc Đăng nhập lại để khôi phục | **KHÔNG** (Sau khi đăng nhập lại) |

---

## 2. Đặc tả Chi tiết SYSTEM Cards (Tuân thủ Phụ lục A.2)

### 2.1. Card SYS-CARD-SCR-01 — Quyền Xem Màn hình (Screen Recording) bị từ chối
- **Thời điểm hiển thị:** Khi người dùng bật tính năng Nhận biết màn hình trong Cài đặt (M3) nhưng bấm "Don't Allow" hoặc gạt tắt trong System Settings.
- **Cấu trúc dữ liệu Card (Anatomy):**
  ```json
  {
    "card_type": "SYSTEM",
    "id": "sys_card_scr_denied",
    "title": "Chưa có quyền xem màn hình",
    "body": "Pet không thể nhận diện cửa sổ bạn đang làm việc. Các tính năng giao việc bằng lệnh vẫn hoạt động bình thường.",
    "severity": "info",
    "blocking": false,
    "auto_dismiss": false,
    "persistent_badge": true,
    "action": {
      "label": "Mở Cài đặt Màn hình",
      "command": "open-system-settings",
      "target_url": "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    },
    "secondary_action": {
      "label": "Bỏ qua",
      "command": "dismiss"
    }
  }
  ```
- **Quy trình người dùng bật lại:**
  1. Người dùng bấm nút **"Mở Cài đặt Màn hình"** trên card.
  2. Ứng dụng gọi lệnh hệ thống:  
     `open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"`
  3. System Settings mở thẳng tới danh sách ứng dụng được phép ghi màn hình.
  4. Người dùng gạt công tắc của **Desktop Assistant** sang **ON**.
  5. macOS hiển thị hộp thoại: *"Desktop Assistant will not be able to record screen until it is quit."* kèm nút **[Quit & Reopen]**.
  6. Sau khi app mở lại, `CGPreflightScreenCaptureAccess()` trả về `true`, card tự động biến mất.

---

### 2.2. Card SYS-CARD-ACC-01 — Quyền Trợ năng (Accessibility) bị từ chối
- **Thời điểm hiển thị:** Khi người dùng bật tính năng "Pet né tránh con trỏ nhập liệu" nhưng macOS phát hiện `AXIsProcessTrusted() == false`.
- **Cấu trúc dữ liệu Card (Anatomy):**
  ```json
  {
    "card_type": "SYSTEM",
    "id": "sys_card_acc_denied",
    "title": "Chưa cấp quyền Trợ năng",
    "body": "Pet cần quyền Trợ năng để né tránh vùng bạn đang gõ phím. Bật quyền để tránh bị pet che khuất tầm nhìn.",
    "severity": "info",
    "blocking": false,
    "auto_dismiss": false,
    "persistent_badge": false,
    "action": {
      "label": "Mở Cài đặt Trợ năng",
      "command": "open-system-settings",
      "target_url": "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    }
  }
  ```
- **Quy trình người dùng bật lại:**
  1. Bấm **"Mở Cài đặt Trợ năng"** $\rightarrow$ macOS mở System Settings > Accessibility.
  2. Gạt công tắc Desktop Assistant sang **ON**.
  3. **Không cần khởi động lại app:** Vòng lặp timer của Pet Engine phát hiện `AXIsProcessTrusted() == true` ngay trong tích tắc và kích hoạt thuật toán né tránh ngay lập tức.

---

### 2.3. Card SYS-CARD-FILE-01 — Kéo thả file bị macOS chặn truy cập
- **Thời điểm hiển thị:** Người dùng kéo thả một file từ Desktop hoặc Documents vào ô thoại của Pet, nhưng macOS trả về lỗi cấp quyền truy cập file nhạy cảm.
- **Cấu trúc dữ liệu Card (Anatomy):**
  ```json
  {
    "card_type": "SYSTEM",
    "id": "sys_card_file_denied",
    "title": "Không thể đọc file đính kèm",
    "body": "macOS giới hạn quyền đọc file từ thư mục cá nhân. Vui lòng bấm nút dưới đây để chọn file qua hộp thoại an toàn.",
    "severity": "warning",
    "blocking": false,
    "auto_dismiss": false,
    "persistent_badge": false,
    "action": {
      "label": "Chọn file an toàn...",
      "command": "open-file-dialog"
    }
  }
  ```
- **Quy trình khắc phục:**
  1. Người dùng bấm **"Chọn file an toàn..."**.
  2. App mở hộp thoại chuẩn `dialog.showOpenDialog({ properties: ['openFile'] })`.
  3. Khi người dùng bấm Open trên hộp thoại hệ thống của macOS, hệ thống tự động cấp quyền truy cập an toàn (User-Intent Capability) cho file đó mà không cần bất kỳ quyền TCC đặc biệt nào.

---

### 2.4. Card SYS-CARD-KEY-01 — Lỗi Keychain Master Key (Từ SP-11/mac)
- **Thời điểm hiển thị:** Người dùng từ chối cấp quyền Keychain Access, hoặc Keychain bị hỏng do cài đặt đè bản build không cùng chữ ký mã hợp lệ.
- **Cấu trúc dữ liệu Card (Anatomy):**
  ```json
  {
    "card_type": "SYSTEM",
    "id": "sys_card_sec_keychain_fail",
    "title": "Lỗi khóa bảo mật Keychain",
    "body": "Không thể giải mã khóa bảo mật để kết nối dịch vụ. Vui lòng mở trang Kết nối để thiết lập lại.",
    "severity": "error",
    "blocking": false,
    "auto_dismiss": false,
    "persistent_badge": true,
    "action": {
      "label": "Mở Cài đặt Kết nối",
      "route": "/settings/connectors"
    }
  }
  ```
