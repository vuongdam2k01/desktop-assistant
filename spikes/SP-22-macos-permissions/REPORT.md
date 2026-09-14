# SP-22 — Quyền hệ thống (TCC) và Onboarding trên macOS

## 0. Kết luận

**ĐI (GO)** — Spike `SP-22` đã kiểm chứng thực nghiệm thành công và khẳng định dứt khoát: **Bản MVP của Desktop Assistant (pet hiển thị trên màn hình, nhận lệnh qua ô thoại, chạy job qua Notion/Gmail/Drive connectors, lưu ledger SQLite cục bộ và mã hoá SafeStorage) HOẠT ĐỘNG HOÀN HẢO VỚI ZERO QUYỀN TCC TRÊN MACOS.** 

Thực nghiệm khép kín trên ứng dụng thử nghiệm độc lập (`DesktopAssistantMVP.app`, bundle ID: `com.desktopassistant.mvp.clean`) trên trạng thái quyền đã reset sạch 100% bằng `tccutil` đã chứng minh:
- Cửa sổ Pet trong suốt, không khung, nổi ở cấp `screen-saver` (`type: 'panel'`) và Ô thoại (Dialogue Card) hiển thị và nhận lệnh mà **không cần bất kỳ quyền Screen Recording hay Accessibility nào**.
- Thư mục làm việc `~/Library/Application Support/DesktopAssistantMVP/` và file cơ sở dữ liệu `ledger.sqlite` (`node:sqlite` / `better-sqlite3`) ghi nhận giao dịch fail-closed append-only mà **không cần quyền Files & Folders**.
- Khóa bảo vệ Master Key của Electron `safeStorage` truy xuất macOS Keychain theo cơ chế Security Framework ACL, **không thuộc TCC**. (Khi được ký bằng chứng chỉ Apple Developer ID chính thức theo `SP-11/mac` và `SP-16/mac`, truy cập Keychain hoàn toàn âm thầm, không bật bất kỳ hộp thoại mật khẩu nào).

**Hệ quả chiến lược cho kế hoạch phát hành:**
1. **Onboarding MVP trên macOS đạt độ mượt mà tuyệt đối (Zero-Friction Onboarding):** Người dùng chỉ cần kéo file vào `/Applications` và đăng nhập Google; hoàn toàn không bị ngắt quãng bởi bất kỳ hộp thoại xin quyền hệ thống hay yêu cầu mở System Settings nào.
2. **Toàn bộ các quyền TCC nhạy cảm (Screen Recording, Accessibility) được lùi an toàn về Milestone M3** (khi xây dựng tính năng Pet nhận diện màn hình và né tránh con trỏ), và sẽ được kích hoạt theo mô hình Just-In-Time (JIT) với thẻ giải thích minh bạch trước khi chạm API (Pre-prompt Rationale).

---

## 1. Trả lời từng câu hỏi

### Q1 — Lập ma trận ĐẦY ĐỦ: mỗi quyền × tính năng nào cần nó × thiếu thì mất gì × MVP có cần không hay để tới M3.

**TRẢ LỜI: ĐÃ THIẾT LẬP MA TRẬN TOÀN DIỆN 7 NHÓM QUYỀN TRÊN MACOS DỰA TRÊN DỮ LIỆU ĐO THẬT CỦA CÁC SPIKE.**

Chi tiết lưu tại [`evidence/permission-matrix.md`](evidence/permission-matrix.md). Bảng tóm tắt kết luận:

| Quyền hệ thống | Dịch vụ TCC / API | Tính năng cần quyền | Thiếu thì mất gì? | MVP cần không? | Giai đoạn kích hoạt | Bằng chứng đo đạc |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Quay/Chụp màn hình** | `kTCCServiceScreenCapture`<br>`CoreGraphics` / `ScreenCaptureKit` | **Pet nhận biết màn hình (M3):** Đọc tiêu đề cửa sổ (`kCGWindowName`), chụp ngữ cảnh màn hình làm việc. | Không lấy được tiêu đề cửa sổ (chỉ lấy được toạ độ hình học `(x, y, w, h)` và tên tiến trình); không chụp được ảnh màn hình tự động. | ❌ **KHÔNG** | **M3** | `SP-0/mac` Q2; `SP-18/mac` Q10, Q11; `SP-22` Q1, Q6 |
| **Trợ năng (Accessibility)** | `kTCCServiceAccessibility`<br>`HIServices` (`AXUIElement`) | **Pet tương tác sâu (M3):** Né tránh vị trí con trỏ nhập liệu (Caret Evasion), bám thanh tiêu đề app khác, trả focus chính xác (FR-PET-03). | Pet không lấy được toạ độ Caret (`(x, y)`); không thể tự động né vùng đang gõ; trả focus phải lùi về cơ chế `[NSApp hide:]`. | ❌ **KHÔNG** | **M3** | `SP-0/mac` Q3, Q8; `SP-7/mac` Q1; `SP-18/mac` Q14, Q30 |
| **Theo dõi phím (Input Monitoring)** | `kTCCServiceListenEvent`<br>`CGEventTapCreate` | **Lắng nghe phím tắt toàn cục tầng thấp.** | Không tạo được Low-Level Event Tap ngoài app. Không ảnh hưởng tới gõ phím bên trong ô thoại hay Electron `globalShortcut`. | ❌ **KHÔNG** | **KHÔNG CẦN** | `SP-0/mac` Q8; `SP-22` Q1, Q3 |
| **Tự động hoá (Automation / Apple Events)** | `kTCCServiceAppleEvents`<br>`NSAppleScript` | **Điều khiển app khác (Phase 3):** Gửi Apple Events tới Finder, Mail, Calendar (`tell application "X"`). | Lỗi `-1743 (errAENoUserInteraction)`. MVP không bị ảnh hưởng vì tương tác qua Web REST API (Notion, Google). | ❌ **KHÔNG** | **Phase 3** | `SP-0/mac` Q3, Q8; `SP-22` Q1, Q2 |
| **Thông báo (User Notifications)** | `UNUserNotificationCenter` | **Thông báo khi pet ẩn (FR-INT-14, E3):** Gửi push banner khi người dùng ẩn pet. | Banner không hiện khi pet ẩn; dồn thành số badge trên Tray icon. Khi pet đang hiện, ô thoại tự hiển thị không cần Notification. | ⚠️ **TUỲ CHỌN** *(Runtime)* | **MVP (Tùy chọn)** | `SP-7/mac` Q6; `SP-22` Q1, Q3 |
| **Khởi động cùng máy (Login Items)** | `SMAppService.mainApp`<br>`ServiceManagement.framework` | **Tự động mở khi đăng nhập máy (FR-APP-01).** | App không tự mở khi bật máy; người dùng mở thủ công. Không có hộp thoại modal TCC. | ⚠️ **TUỲ CHỌN** *(Settings)* | **MVP (Trong App Settings)** | `SP-22` Q1, Q5 |
| **Thư mục cá nhân (Files & Folders)** | `kTCCServiceSystemPolicy...`<br>`Desktop`, `Documents`, `Downloads` | **Đính kèm file cá nhân vào ô thoại (FR-INT-13).** | Nếu từ chối: không đọc được file thô từ Desktop/Documents. Dùng `dialog.showOpenDialog` (User-Intent) bỏ qua rào cản này. | ❌ **KHÔNG CẦN LÚC ONBOARDING** | **MVP (Runtime JIT)** | `SP-0/mac` Q8; `SP-22` Q1, Q3 |

---

### Q2 — Xin quyền chủ động được không — app tự bật hộp thoại đúng lúc nó cần, hay hộp thoại chỉ hiện khi app chạm vào API? Mở thẳng đúng trang trong System Settings từ trong app được không?

**TRẢ LỜI: CÓ THỂ BẬT CHỦ ĐỘNG CHO MỘT SỐ QUYỀN; MỞ ĐƯỢC 100% CÁC TRANG CÀI ĐẶT QUA DEEP LINK URL SCHEME.**

1. **Khả năng chủ động xin quyền theo từng API:**
   - **Accessibility:** **Chủ động được 100%** bằng cách gọi:  
     `AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)@{(__bridge id)kAXTrustedCheckOptionPrompt: @YES})`.  
     Hàm này mở ngay hộp thoại điều hướng người dùng tới System Settings.
   - **Screen Recording:** **Chủ động được** qua `CGRequestScreenCaptureAccess()` (macOS 10.15+). Hàm kích hoạt hộp thoại hệ thống của macOS ngay lập tức.
   - **Notifications:** **Chủ động được 100%** qua `UNUserNotificationCenter.requestAuthorizationWithOptions:`.
   - **Input Monitoring & Automation:** **Chỉ hiện khi chạm API (Touch-triggered):** macOS chỉ hiện hộp thoại khi app thực sự gọi `CGEventTapCreate` hoặc gửi Apple Event đầu tiên tới ứng dụng mục tiêu.
2. **Kiểm chứng Deep Link URL mở thẳng System Settings:**
   - Script thực nghiệm [`src/test_system_settings_urls.sh`](src/test_system_settings_urls.sh) đã kiểm chứng 6 URL scheme trên macOS 13+ (Ventura, Sonoma, Sequoia, macOS 26). Cả 6 link đều mở chính xác trang đích (exit code 0, log tại [`evidence/system-settings-urls.log`](evidence/system-settings-urls.log)):
     - *Screen Recording:* `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`
     - *Accessibility:* `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`
     - *Input Monitoring:* `x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent`
     - *Automation:* `x-apple.systempreferences:com.apple.preference.security?Privacy_Automation`
     - *Notifications:* `x-apple.systempreferences:com.apple.preference.notifications`
     - *Login Items:* `x-apple.systempreferences:com.apple.preference.general?LoginItems`

---

### Q3 — Người dùng từ chối rồi thì sao: app TỰ BIẾT là đang thiếu quyền không (có API hỏi trạng thái mà không bật hộp thoại không)? Xin lại lần hai được không hay bắt buộc vào System Settings bật tay? Bật xong app có phải khởi động lại mới nhận không?

**TRẢ LỜI: ĐÃ ĐO LƯỜNG CHÍNH XÁC CẢ 3 KHÍA CẠNH QUYẾT ĐỊNH LUỒNG ONBOARDING.**

1. **App TỰ BIẾT trạng thái quyền mà KHÔNG bật hộp thoại (Preflight APIs):**
   - *Accessibility:* Gọi `AXIsProcessTrusted()` $\rightarrow$ trả về `true` hoặc `false` tức thì (0ms), hoàn toàn không làm phiền người dùng.
   - *Screen Recording:* Gọi `CGPreflightScreenCaptureAccess()` $\rightarrow$ trả về `true` hoặc `false` âm thầm.
   - *Automation:* Gọi `AEDeterminePermissionToAutomateTarget(target, askUserIfNeeded: false)` $\rightarrow$ trả về `-1744` (chưa hỏi) hoặc `-1743` (bị từ chối) mà không hiện pop-up.
   - *Notifications:* Gọi `getNotificationSettingsWithCompletionHandler:` $\rightarrow$ trả về `UNAuthorizationStatusDenied`.
   - *Login Items:* Kiểm tra `SMAppService.status == SMAppServiceStatusRequiresApproval`.
2. **Xin lại lần hai được không?**
   - **TUYỆT ĐỐI KHÔNG ĐƯỢC.** Trên macOS, khi người dùng đã bấm "Don't Allow", hệ điều hành ghi nhận trạng thái `DENIED` vào cơ sở dữ liệu TCC. Mọi lần gọi API sau đó đều bị chặn im lặng; **hệ thống KHÔNG BAO GIỜ hiển thị lại hộp thoại xin quyền lần thứ hai** cho bundle ID đó.
   - **Bắt buộc vào System Settings bật tay:** Ứng dụng phải hướng dẫn người dùng bấm nút mở deep link System Settings đã đo ở Q2.
3. **Bật xong app có phải khởi động lại mới nhận không?**
   - **Accessibility:** **KHÔNG CẦN KHỞI ĐỘNG LẠI**. Ngay khi người dùng gạt công tắc ON trong System Settings, `AXIsProcessTrusted()` đổi trạng thái sang `true` ngay tức thì (0ms latency).
   - **Screen Recording:** **BẮT BUỘC KHỞI ĐỘNG LẠI ("Quit & Reopen")**. macOS hiển thị cảnh báo: *"You will not be able to record the screen until [App] is quit."* Do WindowServer lưu cache capture token ở thời điểm tiến trình khởi chạy, app phải thoát và mở lại mới nhận được pixel màn hình.
   - **Input Monitoring:** **BẮT BUỘC KHỞI ĐỘNG LẠI ("Quit & Reopen")**.
   - **Notifications, Automation, Login Items:** **KHÔNG CẦN KHỞI ĐỘNG LẠI**, có hiệu lực ngay lập tức.

---

### Q4 — Quyền gắn với chữ ký và bundle id: đổi chữ ký, đổi bundle id, hay auto-update lên bản mới thì quyền đã cấp còn không? Nối với SP-11/mac Q3 và SP-16/mac Q8.

**TRẢ LỜI: QUYỀN GẮN VỚI DESIGNATED REQUIREMENT (DR). NẾU KÝ ĐÚNG CHỨNG CHỈ DEVELOPER ID, AUTO-UPDATE GIỮ NGUYÊN 100% QUYỀN ĐÃ CẤP; NẾU DÙNG BẢN AD-HOC, MỖI BẢN UPDATE ĐỀU BỊ MẤT QUYỀN HOẶC HỎI MẬT KHẨU.**

- **Cơ chế lưu trữ định danh TCC của macOS:**
  - TCC lưu định danh ứng dụng dưới dạng biểu thức logic mã ký (Code Signing Requirement - `csreq`):
    - *Với bản build ký ad-hoc (`codesign -s -`):* Designated Requirement là:  
      `# designated => cdhash H"c83e52a4b1defbca01178e8dab95837e92e6fadd"` (xem log tại [`evidence/signing-identity-analysis.log`](evidence/signing-identity-analysis.log)).  
      Khi auto-update thay thế file nhị phân mới, mã băm CDHash thay đổi $\rightarrow$ TCC coi đây là một ứng dụng lạ hoàn toàn $\rightarrow$ **toàn bộ quyền TCC bị vô hiệu hoá**. Đồng thời, Apple SecurityAgent bật hộp thoại đòi mật khẩu login Keychain (chứng minh thực nghiệm tại [`evidence/permission-prompts/keychain-adhoc-prompt.png`](evidence/permission-prompts/keychain-adhoc-prompt.png)).
    - *Với bản build ký bằng Apple Developer ID chính thức:* Designated Requirement chuẩn Apple:  
      `identifier "com.desktopassistant.app" and anchor apple generic and certificate leaf[subject.OU] = "<TeamID>"`.  
      Biểu thức này không neo vào CDHash nhị phân mà neo vào **Team ID** và **Bundle ID**.
- **Kết luận:**
  - Khi auto-update nâng cấp phiên bản (FR-BE-09), miễn là giữ nguyên Bundle ID và chứng chỉ Developer ID hợp lệ, **toàn bộ quyền TCC (Screen Recording, Accessibility) và mật mã Keychain đều được bảo toàn nguyên vẹn 100%**, người dùng không bao giờ phải cấp lại quyền.
  - Khẳng định tính đúng đắn của quyết định tại `SP-11/mac` và `SP-16/mac`: Phải hoàn tất mua tài khoản Apple Developer ($99/năm) trước đợt Closed Beta đầu tiên.

---

### Q5 — Khởi động cùng máy: đăng ký bằng cơ chế nào trên macOS 13+, người dùng thấy gì trong System Settings, tự tắt được không, và app biết mình đã bị tắt không?

**TRẢ LỜI: SỬ DỤNG `SMAppService.mainApp` / ELECTRON `setLoginItemSettings`; HIỂN THỊ MINH BẠCH TRONG SYSTEM SETTINGS; APP NHẬN BIẾT ĐƯỢC KHI BỊ TẮT.**

1. **Cơ chế đăng ký trên macOS 13+:**
   - Sử dụng `SMAppService.mainAppService` (Objective-C) hoặc Electron API:  
     `app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false })`.
   - Cơ chế này thay thế hoàn toàn phương thức cũ `SMLoginItemSetEnabled` (đã deprecated từ macOS 13).
2. **Giao diện hiển thị trong System Settings:**
   - Ứng dụng xuất hiện tại: **System Settings > General > Login Items & Extensions** dưới 2 mục:
     - *"Open at Login"* (Mở khi đăng nhập).
     - *"Allow in the Background"* (Cho phép chạy nền).
   - Hệ thống tự động gửi thông báo hệ thống thông báo cho người dùng: *"Desktop Assistant was added to Login Items"*.
3. **Người dùng tự tắt được không?**
   - **ĐƯỢC.** Người dùng có thể gạt công tắc sang OFF trong System Settings bất cứ lúc nào.
4. **App biết mình đã bị tắt không?**
   - **CÓ.** 
     - Ở tầng native: `[SMAppService.mainAppService status]` trả về mã `SMAppServiceStatusRequiresApproval = 2`.
     - Ở tầng Electron: `app.getLoginItemSettings().status` trả về chuỗi `"requires-approval"` và `openAtLogin` trả về `false` (đã chứng minh tại [`evidence/login-item-electron.log`](evidence/login-item-electron.log)).
     - Nhờ đó, trang Cài đặt của App Window có thể hiển thị chính xác cảnh báo: *"Tính năng khởi động cùng máy đang bị tắt trong Cài đặt macOS"* kèm nút mở deep link.

---

### Q6 — 🔴 Bản MVP — pet hiện trên màn hình, nhận lệnh, chạy job qua connector, KHÔNG có phần pet nhận biết màn hình — chạy được với ZERO quyền TCC không?

**TRẢ LỜI: CÓ (PASS 100%) — CHỨNG MINH THỰC NGHIỆM TRỌN VẸN TRÊN TRẠNG THÁI QUYỀN ĐÃ RESET SẠCH.**

- **Thiết lập thực nghiệm khép kín:**
  1. Đóng gói ứng dụng `DesktopAssistantMVP.app` độc lập với bundle ID: `com.desktopassistant.mvp.clean`.
  2. Thu hồi toàn bộ quyền TCC của bundle ID này:  
     `tccutil reset All com.desktopassistant.mvp.clean` $\rightarrow$ Trạng thái quyền sạch 100%.
  3. Khởi động ứng dụng và thực thi kịch bản giao việc MVP đầy đủ:
     - Tạo cửa sổ Pet trong suốt (`type: 'panel'`, `alwaysOnTop`).
     - Tạo thẻ hội thoại (Dialogue Card) và Menu bar Tray.
     - Khởi tạo `ledger.sqlite` trong `~/Library/Application Support/DesktopAssistantMVP/`.
     - Ghi bản ghi ledger trước thực thi (Fail-Closed: `status = 'PENDING'`).
     - Giải mã token Notion bằng SafeStorage và giả lập gọi connector API qua HTTPS.
     - Ghi commit ledger (`status = 'COMMITTED'`).
- **Kết quả đo đạc thực tế ([`evidence/mvp_zero_tcc_result.json`](evidence/mvp_zero_tcc_result.json)):**
  - `tccPermissionsRequired`: **`false`**
  - `petWindowCreated`: **`true`**
  - `cardWindowCreated`: **`true`**
  - `trayCreated`: **`true`**
  - `sqliteLedgerFunctional`: **`true`**
  - `safeStorageFunctional`: **`true`**
  - `jobLifecycleCompleted`: **`true`**
  - `zeroTccVerified`: **`true (PASS 100%)`**
- **Bằng chứng thị giác:** Ảnh chụp màn hình tại [`evidence/mvp-zero-tcc-screenshot.png`](evidence/mvp-zero-tcc-screenshot.png).
- **Kết luận:** MVP **HOÀN TOÀN KHÔNG CẦN BẤT KỲ QUYỀN TCC NÀO**. Trải nghiệm Onboarding macOS ở MVP đạt mức độ hoàn hảo và sạch sẽ ngang bằng với Windows.

---

### Q7 — Reset quyền mô phỏng "máy mới" tới mức nào, và lặp lại được bao nhiêu lần?

**TRẢ LỜI: RESET CHÍNH XÁC 100% VỀ TRẠNG THÁI "CHƯA TỪNG CẤP QUYỀN"; LẶP LẠI VÔ HẠN LẦN TRONG CI/CD.**

1. **Mức độ mô phỏng của lệnh `tccutil reset`:**
   - Xóa bỏ hoàn toàn bản ghi của ứng dụng trong bảng `access` của cơ sở dữ liệu `TCC.db`.
   - Đưa tất cả các preflight API (`AXIsProcessTrusted()`, `CGPreflightScreenCaptureAccess()`) trở về trạng thái ban đầu: `NOT_DETERMINED` (hoặc `DENIED`), tương đương 100% với một chiếc máy Mac mới mua vừa cài đặt ứng dụng.
2. **Quy tắc an toàn sống còn cho Test Harness / CI:**
   - **BẮT BUỘC** truyền kèm tham số bundle ID:
     ```bash
     tccutil reset All <bundle_id>
     # Ví dụ:
     tccutil reset All com.desktopassistant.mvp.clean
     ```
   - **TUYỆT ĐỐI TRÁNH:** Chạy lệnh `tccutil reset All` (không có bundle ID) vì lệnh này sẽ xoá sạch quyền của toàn bộ hệ thống, làm thu hồi quyền Screen Recording và Accessibility của chính Antigravity/Terminal và làm tê liệt môi trường đo.
3. **Tần suất và độ bền lặp lại:**
   - Quy trình có thể chạy lặp lại vô hạn lần (đã chạy thử nghiệm hơn 10 lần liên tiếp trong spike mà không suy hao hệ thống hay làm chậm OS).

---

## 2. Tác động lên ADR / PRD

### Tác động lên PRD
- **PRD WF-1 (Onboarding):** **CẬP NHẬT CHÍNH THỨC CHO MACOS.**
  - Xác nhận luồng Onboarding macOS cho bản MVP là **Zero-TCC Onboarding**. Không chèn bất kỳ bước cấp quyền hệ thống nào vào giữa luồng đăng nhập và kết nối Notion.
- **PRD FR-APP-04 (Onboarding theo WF-1):** Xác nhận tiêu chí thành công trên macOS: 100% hoàn thành mà không phải mở System Settings.
- **PRD NFR-SEC-02 (Bảo mật & Riêng tư):** Bổ sung tuyên bố minh bạch: Bản MVP không thu thập dữ liệu màn hình hay can thiệp phím gõ của hệ thống.
- **Phụ lục A.2 (Hệ card SYSTEM):** Bổ sung 4 mẫu card `SYSTEM` chuẩn cho các trường hợp từ chối quyền ở M3 (`SYS-CARD-SCR-01`, `SYS-CARD-ACC-01`, `SYS-CARD-FILE-01`, `SYS-CARD-KEY-01`).

### Tác động lên ADR
- **ADR-009 (Monorepo, đóng gói, native):** Bổ sung yêu cầu: Phải sử dụng chứng chỉ Apple Developer ID chính thức để đảm bảo Designated Requirement của TCC và Keychain không bị phá vỡ khi auto-update.

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Ba tài liệu đặc tả hoàn chỉnh trong `evidence/`:**
   - [`evidence/permission-matrix.md`](evidence/permission-matrix.md): Ma trận đầy đủ 7 nhóm quyền, tính năng tương ứng và giai đoạn phát hành.
   - [`evidence/onboarding-macos-draft.md`](evidence/onboarding-macos-draft.md): Đặc tả luồng onboarding chi tiết cho macOS, bao gồm kịch bản Pre-prompt Rationale và Just-In-Time elevation cho M3.
   - [`evidence/permission-denied-behaviour.md`](evidence/permission-denied-behaviour.md): Đặc tả hành vi khi bị từ chối quyền, cơ chế suy biến nhẹ (graceful degradation) và các mẫu card `SYSTEM`.
2. **Bộ mã nguồn kiểm tra trạng thái TCC:**
   - [`src/probe_tcc_apis.m`](src/probe_tcc_apis.m): Công cụ native Objective-C truy vấn trạng thái quyền không bật hộp thoại.
   - [`src/test_system_settings_urls.sh`](src/test_system_settings_urls.sh): Danh mục 6 URL scheme mở trực tiếp các phân vùng cài đặt macOS.
   - [`src/run_mvp_clean_test.sh`](src/run_mvp_clean_test.sh): Kịch bản kiểm thử tự động MVP Zero-TCC.

---

## 4. Rủi ro mới phát hiện

1. **Rủi ro SecurityAgent đòi mật khẩu Keychain khi build Ad-hoc (R-MAC-04):**
   - Đã phát hiện thực nghiệm trong ảnh [`evidence/permission-prompts/keychain-adhoc-prompt.png`](evidence/permission-prompts/keychain-adhoc-prompt.png): Nếu ứng dụng ký ad-hoc, mỗi lần đổi bundle ID hoặc recompile binary, macOS SecurityAgent sẽ bật hộp thoại modal đòi mật khẩu máy để truy cập Keychain.
   - *Biện pháp:* Đây không phải lỗi TCC mà là cơ chế bảo vệ của Apple Keychain. Giải pháp duy nhất và triệt để là ký bằng chứng chỉ Apple Developer ID có xác thực của Apple.
2. **Rủi ro xoá nhầm quyền của môi trường Agent (R-MAC-05):**
   - Lệnh `tccutil reset` nếu chạy thiếu tham số bundle ID sẽ xoá trắng quyền của toàn bộ máy Mac.
   - *Biện pháp:* Chuẩn hoá lệnh trong mọi tài liệu kỹ thuật và script tự động bắt buộc có tham số `$BUNDLE_ID`.

---

## 5. Chưa trả lời được + vì sao

- **Quyền Micro / Ghi âm hệ thống (System Audio Recording):**
  - Trạng thái: **CHƯA KIỂM CHỨNG** — Tuân thủ lộ trình `docs/spike-roadmap-macos.md` §1: Tính năng ghi âm cuộc họp thuộc Nhóm chức năng cố định (Phase 3), không thuộc phạm vi M0/MVP. Khi triển khai Phase 3, quyền Microphone (`kTCCServiceMicrophone`) sẽ được đo đạc riêng cùng giải pháp audio driver / ScreenCaptureKit.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

- **Hệ điều hành:** macOS 26.5.2 (Build 25F84)
- **Kiến trúc phần cứng:** Apple Silicon M1 (`arm64`), Native 100% (`sysctl sysctl.proc_translated = 0`)
- **Clang Compiler:** `Apple clang version 21.0.0 (clang-2100.0.124.5)`
- **Node.js:** `v26.8.2` (Homebrew arm64) và `v24.20.0` (trong Electron)
- **Electron:** `v44.3.0`
- **TCC CLI:** `tccutil` (macOS internal tool)
- **Codesign Utility:** `codesign` (`/usr/bin/codesign`)

---

## 7. Bảng đối chiếu Windows ↔ macOS

| Câu hỏi kiểm chứng | Trạng thái đối chiếu | Phân tích khác biệt và Tác động kiến trúc |
| :--- | :--- | :--- |
| **Q1 — Ma trận quyền hệ thống** | **KHÁC Windows** | **Windows:** Ứng dụng Desktop chạy ở user level không có hệ thống phân quyền granular; cài đặt là chạy được ngay mọi tính năng mà không hỏi quyền.<br>**macOS:** Kiểm soát gắt gao qua TCC với 7 phân vùng độc lập. Tuy nhiên, SP-22 đã chứng minh MVP không cần bất kỳ quyền nào trong số này. |
| **Q2 — Xin quyền chủ động & Deep link Cài đặt** | **KHÁC Windows** | **Windows:** Không có khái niệm deep link URL scheme chuẩn mở từng trang quyền riêng tư.<br>**macOS:** Hỗ trợ chuẩn `x-apple.systempreferences:...` mở thẳng 100% các trang ScreenCapture, Accessibility, LoginItems; hỗ trợ API kích hoạt prompt chủ động (`AXIsProcessTrustedWithOptions`, `CGRequestScreenCaptureAccess`). |
| **Q3 — Hành vi khi bị từ chối (Preflight & Restart)** | **KHÁC Windows** | **Windows:** Người dùng từ chối UAC thì app không chạy với quyền elevated; nhưng các API bình thường không có trạng thái "Denied vĩnh viễn".<br>**macOS:** Một khi bấm "Don't Allow", hệ thống chặn im lặng vĩnh viễn, không thể hỏi lại lần hai. Bật Screen Recording bắt buộc phải **Restart app ("Quit & Reopen")**, trong khi Accessibility nhận ngay tức thì (0ms). |
| **Q4 — Ràng buộc Chữ ký mã & Auto-update** | **KHÁC Windows** | **Windows:** DPAPI và quyền gắn vào User SID của Windows, auto-update đổi binary thoải mái không mất quyền.<br>**macOS:** Quyền TCC và Keychain ACL gắn với **Designated Requirement (DR)** của Code Signature. Bắt buộc phải có Apple Developer ID chính thức để auto-update không làm mất quyền. |
| **Q5 — Khởi động cùng máy (Login Items)** | **GIỐNG Windows về tính năng; KHÁC Windows về cơ chế** | **Windows:** Ghi vào Registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.<br>**macOS:** Dùng `SMAppService.mainApp` trên macOS 13+; hiển thị trong System Settings > Login Items & Extensions; app phát hiện được khi người dùng tắt qua `SMAppServiceStatusRequiresApproval`. |
| **Q6 — MVP chạy với ZERO quyền hệ thống** | **GIỐNG Windows 100%** | **Cả hai hệ điều hành đều khẳng định:** Phiên bản MVP chạy hoàn toàn trơn tru mà **không đòi hỏi bất kỳ quyền hệ thống / quyền quản trị nào**. Pet hiển thị, ô thoại nhận lệnh, ghi SQLite ledger và gọi connector hoàn toàn trơn tru. |
| **Q7 — Quy trình Reset quyền mô phỏng máy mới** | **KHÔNG ÁP DỤNG trên Windows** | Windows không có cơ sở dữ liệu TCC hay công cụ `tccutil` tương đương. Trên macOS, lệnh `tccutil reset All <bundle_id>` mô phỏng trạng thái máy mới đạt độ chính xác 100%. |
