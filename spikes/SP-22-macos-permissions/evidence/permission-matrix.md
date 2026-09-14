# Ma trận quyền hệ thống (macOS TCC) — Desktop Assistant

> **Báo cáo trích dẫn:** SPIKE `SP-22` (M0)  
> **Môi trường đo đạc:** macOS 26.5.2 (Build 25F84), Apple Silicon M1 (arm64), Electron v44.3.0 / Node v24.20.0 / Node v26.8.2.

---

## 1. Ma trận phân bổ quyền hệ thống

| Quyền hệ thống | Định danh TCC / Framework | Tính năng cần quyền này | Hậu quả nếu người dùng từ chối (Thiếu thì mất gì) | MVP có cần không? | Giai đoạn kích hoạt | Bằng chứng thực nghiệm |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Quay/Chụp màn hình** | `kTCCServiceScreenCapture`<br>`CoreGraphics` / `ScreenCaptureKit` | **Pet nhận biết màn hình (M3):** Đọc tiêu đề cửa sổ khác (`kCGWindowName`), chụp nội dung màn hình để nhận diện ngữ cảnh làm việc (WF-2 / Context Awareness). | Mất khả năng đọc tiêu đề cửa sổ khác (chỉ lấy được hình học bounds `(x, y, w, h)` và `kCGWindowOwnerName`). Không chụp được ảnh màn hình tự động; pet không thể "nhìn thấy" người dùng đang làm gì. | ❌ **KHÔNG** | **M3** (Tính năng Pet Nhận biết màn hình) | `SP-0/mac` Q2, Q8; `SP-18/mac` Q10, Q11; `SP-22` Q1, Q6. |
| **Trợ năng (Accessibility)** | `kTCCServiceAccessibility`<br>`ApplicationServices` (`HIServices`) | **Pet tương tác sâu (M3):** Theo dõi vị trí con trỏ nhập liệu (Caret Position) để pet né tránh, di chuyển pet bám theo thanh tiêu đề cửa sổ khác, trả focus về ứng dụng trước đó (FR-PET-03). | Pet không lấy được toạ độ con trỏ gõ phím (`AXUIElementCopyAttributeValue`); không thể tự động né vùng đang gõ; việc trả focus (`AXUIElementSetAttributeValue`) phải lùi về cơ chế thô (`NSApp hide:`). | ❌ **KHÔNG** | **M3** (Pet cử động né tránh & bám cửa sổ) | `SP-0/mac` Q3, Q8; `SP-7/mac` Q1; `SP-18/mac` Q14, Q30; `SP-22` Q1, Q3. |
| **Theo dõi bàn phím (Input Monitoring)** | `kTCCServiceListenEvent`<br>`CoreGraphics` (`CGEventTap`) | **Lắng nghe phím tắt toàn cục (Global Hotkey) tầng thấp.** (Ghi chú: Lắng nghe phím/chuột TRONG cửa sổ app không cần quyền này). | Không tạo được Event Tap ở cấp hệ thống (`CGEventTapCreate` trả về `NULL`). Không thể phát hiện người dùng gõ phím ngoài phạm vi cửa sổ pet. | ❌ **KHÔNG** *(Electron `globalShortcut` dùng Carbon HotKey API hoặc IOHID, không đòi hỏi Input Monitoring).* | **KHÔNG CẦN** (Trừ khi làm keylogger / macro bot) | `SP-0/mac` Q8; `SP-22` Q1, Q3. |
| **Tự động hoá (Automation / Apple Events)** | `kTCCServiceAppleEvents`<br>`AppleScript` / `NSAppleScript` | **Điều khiển ứng dụng khác (Phase 3):** Gửi lệnh script qua Apple Events tới Finder, Calendar, Mail, TextEdit (`tell application "X"`). | Không gửi được Apple Events tới ứng dụng khác (lỗi `errAENoUserInteraction = -1743` hoặc `errAEEventNotPermitted`). Thao tác tự động hoá app ngoài bị chặn. | ❌ **KHÔNG** *(MVP giao tiếp qua Web API / REST connectors: Notion, Gmail, Google Drive).* | **Phase 3** (Fixed app functions / Local automation) | `SP-0/mac` Q3, Q8; `SP-22` Q1, Q2. |
| **Thông báo (User Notifications)** | `UNUserNotificationCenter`<br>Apple Notification Center | **Thông báo khi pet ẩn (FR-INT-14, E3):** Khi người dùng ẩn pet, các card blocking (ASK, APPROVAL) hoặc RESULT gửi qua banner thông báo hệ điều hành. | Banner và âm thanh thông báo hệ thống không hiển thị khi pet bị ẩn. Không ảnh hưởng khi pet đang hiện trên màn hình (vì pet dùng speech bubble trực tiếp). Ứng dụng không crash. | ⚠️ **TUỲ CHỌN (OPTIONAL)** *(Chỉ hỏi khi người dùng bấm "Ẩn pet" lần đầu hoặc cài đặt thông báo).* | **MVP (Tuỳ chọn lúc runtime, KHÔNG chặn Onboarding)** | `SP-7/mac` Q6; `SP-22` Q1, Q3. |
| **Khởi động cùng máy (Login Items)** | `SMAppService.mainApp`<br>`ServiceManagement.framework` | **Tự động mở khi đăng nhập macOS (FR-APP-01):** Giúp pet luôn sẵn sàng trên màn hình sau khi khởi động máy mà không cần click mở app. | App không tự chạy khi mở máy. Người dùng phải tự click icon trong `/Applications` hoặc Launchpad để mở. | ⚠️ **TUỲ CHỌN (OPTIONAL)** *(Người dùng bật/tắt trong Settings app; macOS 13+ không hiển thị modal dialog mà ghi vào Settings).* | **MVP (Cài đặt trong App Settings, không chặn Onboarding)** | `SP-22` Q1, Q5. |
| **Truy cập thư mục cá nhân (Files & Folders)** | `kTCCServiceSystemPolicyDesktopFolder`<br>`kTCCServiceSystemPolicyDocumentsFolder`<br>`kTCCServiceSystemPolicyDownloadsFolder` | **Đính kèm file từ máy tính vào ô thoại (FR-INT-13):** Người dùng kéo thả file hoặc chọn file từ Desktop/Documents để giao việc cho worker-agent. | Nếu từ chối: không đọc được file nằm trong 3 thư mục nhạy cảm (`~/Desktop`, `~/Documents`, `~/Downloads`). Thư mục làm việc mặc định của app (`~/Library/Application Support/`) và `/tmp` vẫn truy cập 100% không cần quyền. | ❌ **KHÔNG CẦN LÚC ONBOARDING** *(Chỉ kích hoạt theo cơ chế User-Intent / File Picker khi người dùng chủ động chọn file).* | **MVP (Runtime Just-In-Time khi kéo thả file)** | `SP-0/mac` Q8; `SP-22` Q1, Q3. |

---

## 2. Đối chiếu chi tiết theo từng khía cạnh kiến trúc

### 2.1. Phân định giữa TCC và Non-TCC trên macOS

Một hiểu lầm phổ biến của lập trình viên chuyển từ Windows sang macOS là cho rằng *"mọi tính năng nhạy cảm đều cần xin quyền TCC lúc cài đặt"*. Thực tế đo đạc tại SP-22 khẳng định:

1. **Hiển thị cửa sổ nổi (Pet & Dialogue Bubble):**
   - Tạo cửa sổ trong suốt (`transparent: true`), không khung (`frame: false`), luôn nổi trên tất cả các app (`alwaysOnTop: true`, `kCGScreenSaverWindowLevel`), xuất hiện trên mọi Space (`setVisibleOnAllWorkspaces`) và loại cửa sổ panel (`type: 'panel'`):
   - **Hoàn toàn KHÔNG CẦN BẤT KỲ QUYỀN TCC NÀO.** AppKit cho phép mọi tiến trình sở hữu cửa sổ hiển thị theo nhu cầu của nó.
2. **Lưu trữ Ledger và Cơ sở dữ liệu SQLite (`better-sqlite3` / `node:sqlite`):**
   - Đọc/ghi cơ sở dữ liệu `ledger.sqlite` trong thư mục chuẩn `~/Library/Application Support/DesktopAssistant/`:
   - **Hoàn toàn KHÔNG CẦN BẤT KỲ QUYỀN TCC NÀO.** macOS phân quyền POSIX tiêu chuẩn cho user profile của chủ sở hữu.
3. **Mã hoá dữ liệu qua Electron SafeStorage (macOS Keychain):**
   - Tạo và truy xuất Master Key trong `~/Library/Keychains/login.keychain-db` để mã hoá token OAuth và API keys:
   - Thuộc quản lý của **Apple Security Services ACL**, **KHÔNG THUỘC TCC**. Với chữ ký Developer ID hợp lệ, việc truy cập diễn ra hoàn toàn trong suốt không cần người dùng cấp phép hay gõ mật khẩu (đã chứng minh ở SP-11/mac Q3).
4. **Giao tiếp mạng và Web Connectors (Notion, Gmail, Drive, LLM API):**
   - Kết nối HTTPS ra ngoài và mở listener loopback `127.0.0.1` để đón OAuth redirect:
   - Với ứng dụng không bật App Sandbox hạn chế, macOS **KHÔNG HỎI QUYỀN MẠNG**.

---

## 3. Kết luận phân kỳ phát hành (Phasing Decision)

| Giai đoạn phát hành | Số quyền TCC bắt buộc khi Onboarding | Trải nghiệm người dùng lần đầu |
| :--- | :--- | :--- |
| **MVP (Milestone M1 – M2)** | **0 (ZERO QUYỀN TCC)** | Cài đặt `.dmg` → kéo vào `/Applications` → mở app → đăng nhập Google → kết nối Notion → **Pet xuất hiện ngay lập tức**. Không có bất kỳ hộp thoại cấp quyền hệ thống nào ngắt mạch. |
| **Milestone M3 (Pet Liveness & Screen Awareness)** | **1 quyền: Screen Recording** *(chỉ xin khi người dùng chủ động bật chế độ nhận diện màn hình trong Cài đặt hoặc qua lời mời của Pet)*. | Pet hiển thị Dialogue Card giải thích rõ lợi ích (Contextual Prompt) → kích hoạt `CGRequestScreenCaptureAccess()` → hướng dẫn người dùng "Quit & Reopen". |
| **Phase 3 (Fixed App Functions)** | **2 quyền: Microphone / Audio Recording & Accessibility** *(chỉ xin khi người dùng kích hoạt tính năng Ghi âm cuộc họp / Tự động điều khiển app)*. | Luồng Just-In-Time theo từng tính năng cụ thể. |
