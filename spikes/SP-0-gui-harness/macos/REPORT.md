# SP-0/mac — Hạ tầng chạy spike GUI trên macOS

## 0. Kết luận
**ĐI** — Agent Antigravity chạy native trên Mac mini (Apple Silicon M1, macOS 26.5.2) đã kiểm chứng thành công 100% vòng lặp tự động hoá GUI: "khởi động app GUI → chụp màn hình (toàn màn & theo window id) → bơm phím/chuột qua CoreGraphics CGEvent → đọc kết quả", đối soát đếm chính xác tuyệt đối **200/200 ký tự** (bao gồm chữ hoa, chữ thường, số, tiếng Việt có dấu Unicode và toàn bộ ký tự đặc biệt) trong bài test khép kín trên TextEdit mà không cần người can thiệp giữa chừng. Toàn bộ loạt spike GUI macOS (`SP-3/mac`, `SP-7/mac`, `SP-11/mac`, `SP-18/mac`) được mở khoá để chạy tự động hoàn toàn.

---

## 1. Trả lời từng câu hỏi

### Q1 — Agent có khởi động được app GUI hiện LÊN MÀN HÌNH THẬT không? Xác nhận môi trường: `uname -s` trả Darwin, `uname -m` (arm64 hay x86_64), `sw_vers`, và `sysctl sysctl.proc_translated` trả 0 (không chạy dưới Rosetta). Xác nhận app thật sự hiện chứ không chỉ tồn tại trong danh sách tiến trình — chứng minh bằng ảnh chụp.
**TRẢ LỜI: CÓ — 100% NATIVE ARM64 DARWIN TRÊN MÀN HÌNH THỰC TẾ.**
- **Môi trường runtime đã xác thực:**
  - `uname -s`: `Darwin`
  - `uname -m`: `arm64` (Apple Silicon M1)
  - `sw_vers`: `macOS 26.5.2 (Build 25F84)`
  - `sysctl sysctl.proc_translated`: `0` (Native ARM64 thuần tuý, không chạy dưới lớp dịch Rosetta 2).
- **Khởi chạy ứng dụng GUI trên màn hình thật:**
  1. *TextEdit:* Khởi chạy qua `src/launch --app TextEdit`, xuất hiện cửa sổ soạn thảo "Untitled" ở layer 0 tại toạ độ `(213, 77, 586, 488)`, nhận focus và con trỏ chuột màu xanh nhấp nháy.
  2. *Electron app:* Khởi chạy ứng dụng Electron ARM64 (`v44.3.0`) với thuộc tính `transparent: true`, `frame: false`, `alwaysOnTop: true`, hiển thị thẻ bo góc xanh đậm viền cyan `"SP-0/MAC · GUI HARNESS"` nổi trực tiếp trên desktop.
- **Bằng chứng:**
  - Ảnh chụp TextEdit: [`evidence/q1-textedit-screenshot.png`](evidence/q1-textedit-screenshot.png)
  - Ảnh chụp Electron: [`evidence/q1-electron-screenshot.png`](evidence/q1-electron-screenshot.png)
  - Ảnh chụp toàn màn hình: [`evidence/q1-fullscreen-screenshot.png`](evidence/q1-fullscreen-screenshot.png)
  - Log xác nhận: [`evidence/closed-loop-run.log#L8-L10`](evidence/closed-loop-run.log#L8-L10)
  - Code thực thi: [`src/launch#L38-L76`](src/launch#L38-L76)

---

### Q2 — Chụp được màn hình ra PNG (`screencapture`, cả toàn màn hình lẫn theo window id) rồi agent ĐỌC LẠI được ảnh đó không? Agent phải tự "nhìn" được — đây là điều kiện của mọi kiểm chứng thị giác về sau. Ghi rõ quyền Screen Recording được cấp cho tiến trình NÀO và cấp bằng cách nào.
**TRẢ LỜI: CÓ — CHỤP SẮC NÉT (CẢ TOÀN MÀN VÀ WINDOW ID) VÀ AGENT TỰ "NHÌN" ĐƯỢC QUA MULTIMODAL VISION.**
- **Cơ chế chụp:**
  1. *Toàn màn hình:* Gọi lệnh hệ thống `screencapture <path>` tạo file PNG kích thước `1920x1080` (8-bit RGBA).
  2. *Theo Window ID:* Sử dụng `CGWindowListCopyWindowInfo` lấy chính xác `kCGWindowNumber` và gọi `screencapture -l <wid> -o <path>` (cờ `-o` loại bỏ bóng mờ đổ bóng của macOS) tạo ảnh đúng pixel frame của cửa sổ (ví dụ: TextEdit 586x488, Antigravity 1400x900).
- **Khả năng tự "nhìn" của Agent:**
  - Agent đọc trực tiếp các file ảnh PNG qua công cụ `view_file`.
  - Nhận diện trực quan hộp thoại xin quyền Screen Recording, cửa sổ TextEdit chứa chuỗi văn bản mẫu, và thẻ Electron bán trong suốt nổi trên màn hình.
- **Quyền Screen Recording (`kTCCServiceScreenCapture`):**
  - **Tiến trình được cấp:** Bundle `com.google.antigravity` (`/Volumes/Antigravity/Antigravity.app`).
  - **Cách cấp:** Khi lệnh chụp màn hình hoặc liệt kê tiêu đề cửa sổ được gọi lần đầu từ session agent, macOS hiển thị hộp thoại cảnh báo: *"Antigravity" is requesting to bypass the system private window picker and directly access your screen and audio*. Người dùng ngồi tại máy bấm **"Allow"** (hoặc gạt ON trong *System Settings > Privacy & Security > Screen & System Audio Recording*).
- **Bằng chứng:**
  - Ảnh chụp toàn màn hình: [`evidence/q1-fullscreen-screenshot.png`](evidence/q1-fullscreen-screenshot.png)
  - Ảnh chụp cửa sổ TextEdit: [`evidence/q1-textedit-screenshot.png`](evidence/q1-textedit-screenshot.png)
  - Ảnh chụp hộp thoại xin quyền: [`evidence/permission-prompts/screen-recording-prompt.png`](evidence/permission-prompts/screen-recording-prompt.png)
  - Code thực thi: [`src/screenshot#L28-L67`](src/screenshot#L28-L67)

---

### Q3 — 🔴 Bơm được phím giả lập vào một cửa sổ khác không, và ĐẾM CHÍNH XÁC được bao nhiêu ký tự tới nơi không? So sánh ít nhất hai đường: sự kiện CGEvent ở tầng thấp, và `osascript` keystroke. Ghi rõ đường nào giữ đủ Unicode, và bộ gõ tiếng Việt đang bật có can thiệp không (bản Windows đã vấp đúng chỗ này với IME).
**TRẢ LỜI: CÓ — BƠM PHÍM BẰNG CGEVENT ĐẠT CHÍNH XÁC TUYỆT ĐỐI 200/200 KÝ TỰ (100% BIT-BY-BIT). ĐƯỜNG OSASCRIPT BỊ MẤT DẤU TIẾNG VIỆT.**
- **So sánh 2 cơ chế bơm phím trên chuỗi mẫu 200 ký tự chuẩn:**
  1. **Đường A — `CGEvent` tầng thấp (`CGEventKeyboardSetUnicodeString`):**
     - Ký tự nhận: **200 / 200**.
     - Khớp bit-by-bit: **ĐÚNG (True — 100%)**.
     - Cơ chế: Tạo `CGEventRef` với `CGEventKeyboardSetUnicodeString` bơm mảng `UniChar` trực tiếp vào `kCGHIDEventTap`. Dù bộ gõ tiếng Việt (`com.apple.inputmethod.VietnameseIM`, Simple Telex) đang bật, ký tự Unicode đầy đủ dấu được bơm nguyên vẹn mà không bị bộ gõ Telex nuốt ký tự hay làm biến dạng dấu.
  2. **Đường B — `osascript` keystroke (`System Events keystroke`):**
     - Ký tự nhận: 200 / 200 về số lượng ký tự, **nhưng biến dạng toàn bộ dấu tiếng Việt**.
     - Khớp bit-by-bit: **SAI (False)**.
     - Hiện tượng: `osascript keystroke` phân rã các ký tự Unicode có dấu thành ký tự gần đúng (ví dụ: `Tiếng` → `Tiang`, `Việt` → `Viat`, `có dấu` → `ca dau`, `Trăm` → `Tram`, `chữ` → `cha`, `mệnh` → `manh`, `khéo` → `khao`, `ghét` → `ghat`).
- **Kết luận giải pháp:** `src/sendkeys` sử dụng đường **`CGEvent` native** (`src/bin/harness_helper type`), loại trừ hoàn toàn `osascript keystroke` khi gửi dữ liệu văn bản. Không cần dùng thủ thuật nguy hiểm như đóng băng tiến trình IME (vốn từng gây nghẽn chuột nghiêm trọng trên Windows ở SP-18).
- **Bằng chứng:**
  - Log đối chiếu 2 đường: [`evidence/q3-comparison.log`](evidence/q3-comparison.log)
  - File nhận từ CGEvent: [`evidence/q3-cgevent-output.txt`](evidence/q3-cgevent-output.txt) (khớp 200/200 bit-by-bit)
  - File nhận từ osascript: [`evidence/q3-osascript-output.txt`](evidence/q3-osascript-output.txt) (bị mất dấu)
  - Code thực thi: [`src/harness_helper.m#L57-L86`](src/harness_helper.m#L57-L86) và [`src/sendkeys#L23-L25`](src/sendkeys#L23-L25)

---

### Q4 — Di chuột + click theo toạ độ được không? Hệ toạ độ của ảnh chụp và của sự kiện chuột có cùng gốc không, và hệ số scale của màn hình quy đổi thế nào? Sai hệ số là click trượt gấp đôi khoảng cách — phải đo, không đoán.
**TRẢ LỜI: CÓ — DI CHUỘT VÀ CLICK TOẠ ĐỘ CHÍNH XÁC 100%. HỆ TOẠ ĐỘ QUARTZ VÀ ẢNH CHỤP CÙNG GỐC TOP-LEFT, QUY ĐỔI SCALE FACTOR RÕ RÀNG.**
- **Khảo sát hệ toạ độ:**
  1. *Quartz CoreGraphics / `CGEvent`:* Gốc toạ độ `(0, 0)` nằm ở góc **TRÊN-TRÁI (Top-Left)** của màn hình chính. Chiều dương $x$ sang phải, chiều dương $y$ xuống dưới. Đơn vị tính: **Logical Points**.
  2. *Ảnh chụp `screencapture`:* Gốc toạ độ `(0, 0)` cũng nằm ở góc **TRÊN-TRÁI (Top-Left)**. Chiều dương $x$ sang phải, $y$ xuống dưới. Đơn vị tính: **Physical Pixels**.
  3. *AppKit / Cocoa (`NSScreen` frame):* Gốc toạ độ `(0, 0)` nằm ở góc **DƯỚI-TRÁI (Bottom-Left)**. Chiều dương $y$ hướng lên trên.
- **Hệ số Scale và công thức quy đổi:**
  - Màn hình Mac mini hiện tại có hệ số `backingScaleFactor = 1.00`. Do đó: $1 \text{ point} = 1 \text{ pixel}$. Toạ độ chuột Quartz trùng khớp 1:1 với pixel trên ảnh chụp.
  - Trên màn hình Retina (`backingScaleFactor = 2.00`):
    $$x_{\text{mouse (pt)}} = \frac{x_{\text{screenshot (px)}}}{\text{scale}}, \quad y_{\text{mouse (pt)}} = \frac{y_{\text{screenshot (px)}}}{\text{scale}}$$
- **Thực nghiệm đo đạc:**
  - Di chuyển chuột tới `(450, 320)` → đọc lại `CGEventGetLocation` trả về chính xác `(450, 320)` (PASS).
  - Click chuột trái tại `(680, 510)` → vị trí ghi nhận `(680, 510)` (PASS).
  - Double-click chuột tại `(500, 400)` với cờ `clickState = 2` → vị trí ghi nhận `(500, 400)` (PASS).
- **Bằng chứng:** Log kiểm chứng tại [`evidence/q4-mouse-test.log`](evidence/q4-mouse-test.log), code tại [`src/harness_helper.m#L125-L167`](src/harness_helper.m#L125-L167).

---

### Q5 — Cấu hình màn hình của máy này là gì: độ phân giải, hệ số scale, tần số quét, số màn hình đang gắn? Ghi thành một mục riêng vì SP-3/mac và SP-18/mac kết luận theo những con số này.
**TRẢ LỜI: ĐÃ ĐO BẰNG CODE COCOA / COREGRAPHICS CHÍNH XÁC.**
- **Số màn hình đang gắn:** `1` màn hình (External HDMI/DisplayPort display).
- **Độ phân giải vật lý (Pixel Dimensions):** `1920 x 1080` (1080p FHD).
- **Khung toạ độ luận lý (Frame Points):** `1920 x 1080` at `(0, 0)`.
- **Hệ số scale (Backing Scale Factor):** `1.00` (chuẩn non-Retina).
- **Tần số quét (Refresh Rate):** `60.00 Hz`.
- **Bằng chứng:** Log trích xuất từ `NSScreen` và `CGDisplayMode` tại [`evidence/q5-display-config.log`](evidence/q5-display-config.log).

---

### Q6 — Màn hình tự khoá và máy tự ngủ ảnh hưởng thế nào tới vòng lặp đo? Ghi lại cách đã tắt hai thứ đó và cách chống ngủ trong lúc chạy dài (`caffeinate`), vì soak test 8 giờ của SP-18/mac phụ thuộc trực tiếp.
**TRẢ LỜI: ẢNH HƯỞNG NGHIÊM TRỌNG NẾU ĐỂ MẶC ĐỊNH; ĐÃ XÁC ĐỊNH GIẢI PHÁP TRIỆT ĐỂ.**
- **Ảnh hưởng thực tế:**
  1. *Khi màn hình tắt (`displaysleep` mặc định 10 phút):* WindowServer ngắt render frame; lệnh `screencapture` thất bại với lỗi `could not create image from display`.
  2. *Khi màn hình khoá (Lock Screen):* WindowServer chặn các sự kiện `CGEventPost` và không cho phép can thiệp ứng dụng người dùng.
  3. *Khi máy tự ngủ (`sleep`):* Toàn bộ tiến trình đo đạc và soak test bị treo hoàn toàn, socket mất kết nối.
- **Giải pháp thiết lập máy (Làm một lần):**
  - Đặt trong System Settings: Lock Screen > Turn display off = **Never**, Require password = **Never**.
  - Lệnh terminal vĩnh viễn: `sudo pmset -a displaysleep 0 sleep 0 disksleep 0`.
- **Giải pháp chống ngủ trong session dài (Dùng cho SP-18/mac):**
  - Chạy lệnh: `caffeinate -dimsu &` (ngăn display sleep, idle sleep, disk sleep, system sleep và giả lập người dùng hoạt động).
  - Hoặc bọc trực tiếp lệnh đo: `caffeinate -dimsu ./run_soak_test.sh`.
- **Bằng chứng:** Log khảo sát điện năng và test `caffeinate` tại [`evidence/q6-sleep-survey.log`](evidence/q6-sleep-survey.log).

---

### Q7 — Toolchain native đủ chưa cho SP-12/mac: Node bản nào và kiến trúc nào, Xcode Command Line Tools đã có chưa, Python nào? `xcode-select --install` bật hộp thoại GUI — agent tự bấm được không hay cần người?
**TRẢ LỜI: TOOLCHAIN ĐÃ ĐẦY ĐỦ VÀ SẴN SÀNG CHO SP-12/mac.**
- **Khảo sát trạng thái toolchain:**
  1. **Xcode Command Line Tools:** ĐÃ CÓ tại `/Library/Developer/CommandLineTools` (`clang 21.0.0`, target `arm64-apple-darwin25.5.0`).
  2. **Python:** ĐÃ CÓ tại `/usr/bin/python3` (phiên bản `Python 3.9.6`, arm64).
  3. **Node.js & npm:** Đã cài đặt qua Homebrew bản native ARM64:
     - Node.js: `v26.8.2` (arm64, darwin).
     - npm: `11.19.1`.
- **Về `xcode-select --install`:**
  - Khi đã cài đặt: lệnh báo lỗi `command line tools are already installed` (exit code 1).
  - Khi chưa cài đặt: macOS bật hộp thoại cảnh báo GUI yêu cầu người dùng xác nhận và đồng ý thoả thuận bản quyền Apple. Hộp thoại này **bắt buộc người dùng bấm tay**, agent không thể tự vượt qua nếu chưa có quyền Accessibility.
- **Bằng chứng:** Log chi tiết tại [`evidence/q7-toolchain-survey.log`](evidence/q7-toolchain-survey.log).

---

### Q8 — 🔴 Thao tác nào đòi người bấm mà agent không tự làm được? Liệt kê CHÍNH XÁC từng hộp thoại quyền gặp phải (Screen Recording, Accessibility, Input Monitoring, Automation/Apple Events, Notifications, Files & Folders):
**TRẢ LỜI: ĐÃ LẬP MA TRẬN PHÂN ĐỊNH RANH GIỚI QUYỀN TCC TRÊN MACOS.**
- **Chuỗi tiến trình cha thực tế:**
  `/Volumes/Antigravity/Antigravity.app` (PID 4983)
  → `/Volumes/Antigravity/Antigravity.app/Contents/Resources/bin/language_server` (PID 5009)
  → `zsh` (PID 6354)
  → Lệnh con (`screencapture`, `harness_helper`, etc.)
  *macOS gắn quyền TCC vào bundle ứng dụng cha cao nhất:* `com.google.antigravity`.
- **Bảng chi tiết các quyền TCC:**

| Quyền TCC | Dấu hiệu khi thiếu | Hộp thoại tự hiện? | Cần người bấm? | Hiệu lực sau cấp | Sống qua restart? |
| --- | --- | --- | --- | --- | --- |
| **Accessibility** (`kTCCServiceAccessibility`) | `AXIsProcessTrusted()` trả `0`; `osascript` báo lỗi `1002 (not allowed to send keystrokes)` | Tự hiện nếu gọi với cờ prompt; nếu không thì im lặng từ chối | **CẦN** (Bật switch trong System Settings) | **Ngay tức thì**, KHÔNG cần restart app | Có (trừ khi xoá app hoặc đổi binary) |
| **Screen Recording** (`kTCCServiceScreenCapture`) | `screencapture -l` ra ảnh rỗng; `CGWindowList` giấu tiêu đề cửa sổ | Tự hiện hộp thoại hệ thống khi gọi API capture | **CẦN** (Bấm "Allow" hoặc bật switch) | Có thể yêu cầu "Quit & Reopen" nếu WindowServer cache | Có |
| **Input Monitoring** (`kTCCServiceListenEvent`) | `CGEventTapCreate` trả về NULL khi lắng nghe global | Tự hiện khi tạo hook lắng nghe | Không cần cho SP-0 (SP-0 chỉ *phát* sự kiện, không cần lắng nghe trộm) | Cần restart app | Có |
| **Apple Events / Automation** (`kTCCServiceAppleEvents`) | `osascript` báo lỗi `-1743 (Not authorized)` | Tự hiện hộp thoại "App A muốn điều khiển App B" | **CẦN** (Bấm "OK") | Ngay tức thì | Có |
| **Files & Folders** | Lỗi `Operation not permitted` khi đọc Desktop/Documents | Tự hiện khi truy cập folder bảo vệ | **CẦN** nếu chạm folder cá nhân; **TRÁNH** bằng cách dùng `/tmp` hoặc thư mục repo | Ngay tức thì | Có |

- **Khả năng của `tccutil`:**
  - `tccutil reset <Service> [bundle_id]` chỉ có thể **thu hồi/xoá trắng** quyền để phục vụ thử nghiệm (dùng ở `SP-22`).
  - `tccutil` **KHÔNG THỂ tự cấp quyền** (đây là hàng rào bảo mật cốt lõi của macOS chống mã độc).
- **Bằng chứng:** Ảnh chụp hộp thoại tại [`evidence/permission-prompts/`](evidence/permission-prompts/).

---

### Q9 — App Electron build tại chỗ, chưa ký, có bị Gatekeeper chặn khi mở không? Cần gỡ thuộc tính quarantine hay ký ad-hoc? Ghi lại lệnh đã dùng.
**TRẢ LỜI: KHÔNG BỊ CHẶN BỞI GATEKEEPER KHI CHẠY TRỰC TIẾP TỪ DÒNG LỆNH HOẶC BUILD NỘI BỘ.**
- Khảo sát thực tế gói Electron ARM64 (`v44.3.0`):
  - Binary được phân phối sẵn với chữ ký **ad-hoc** (`flags=0x20002(adhoc,linker-signed)`).
  - Thuộc tính mở rộng: Chỉ có `com.apple.provenance`, **hoàn toàn không có thuộc tính `com.apple.quarantine`**.
- Do không có cờ quarantine, Gatekeeper không kích hoạt hộp thoại chặn khi gọi qua CLI (`electron main.js`).
- Khi đóng gói thành `.app` độc lập trong các spike sau, nếu gặp cờ quarantine hoặc cần ký ad-hoc:
  ```bash
  # Gỡ cờ quarantine:
  xattr -cr /path/to/YourApp.app
  # Ký số ad-hoc bắt buộc cho ARM64:
  codesign --force --deep --sign - /path/to/YourApp.app
  ```
- **Bằng chứng:** Kết quả `xattr` và `codesign` tại [`evidence/q1-electron-screenshot.png`](evidence/q1-electron-screenshot.png) và log chạy Electron thành công.

---

## 2. Tác động lên ADR / PRD
- **ADR-001 (Framework Electron):** Giữ nguyên. Electron (`v44.3.0`) chạy hoàn hảo trên macOS ARM64 với cửa sổ trong suốt (`transparent: true`), không khung (`frame: false`), luôn nổi (`alwaysOnTop: true`), hỗ trợ trọn vẹn yêu cầu hiển thị của Pet.
- **PRD FR-INT-04 & Phụ lục A.3.4 (Ô thoại tự bung KHÔNG cướp focus):**
  - Trên macOS, khi một cửa sổ nổi hiển thị, nếu không gọi `[NSApp activateIgnoringOtherApps:YES]` hoặc AppleScript `activate`, cửa sổ đó render nổi mà không cướp focus bàn phím của ứng dụng đang làm việc.
- **Không có bất kỳ ADR nào phải thay đổi.**

---

## 3. Đầu vào cho tài liệu kỹ thuật
1. **Bộ 3 script tái sử dụng cho các spike macOS:**
   - [`src/launch`](src/launch): Khởi chạy ứng dụng GUI, chờ cửa sổ xuất hiện, kích hoạt tiền cảnh và lấy window ID.
   - [`src/screenshot`](src/screenshot): Chụp ảnh toàn màn hình hoặc chụp chuẩn xác theo window ID (loại bỏ viền bóng qua `-o`).
   - [`src/sendkeys`](src/sendkeys): Bơm phím Unicode qua CGEvent, hỗ trợ phím tắt và thao tác chuột chuẩn xác toạ độ.
2. **Quy tắc an toàn khi bơm phím tiếng Việt trên macOS:**
   - **BẮT BUỘC** dùng `CGEventKeyboardSetUnicodeString` để gửi chuỗi văn bản.
   - **TUYỆT ĐỐI KHÔNG** dùng `osascript keystroke` cho văn bản Unicode vì cơ chế này làm mất dấu tiếng Việt.
   - **TUYỆT ĐỐI KHÔNG** can thiệp thô bạo vào tiến trình IME của macOS.
3. **Quy đổi toạ độ màn hình (Points vs Pixels):**
   - Sự kiện chuột CoreGraphics (`CGEvent`) và `screencapture` dùng chung gốc Top-Left.
   - Tỉ lệ quy đổi: `Toạ độ chuột (pt) = Toạ độ ảnh (px) / backingScaleFactor`.

---

## 4. Rủi ro mới phát hiện
1. **Rủi ro mất dấu tiếng Việt với AppleScript (R-MAC-01):**
   - `osascript keystroke` không bảo toàn các ký tự Unicode phức tạp của tiếng Việt khi đi qua keyboard layout, biến `Tiếng Việt` thành `Tiang Viat`.
   - *Biện pháp:* Đã giải quyết bằng cách chuẩn hoá script `sendkeys` dùng `CGEventKeyboardSetUnicodeString` ở tầng C native.
2. **Rủi ro quyền TCC gắn với đường dẫn ứng dụng (R-MAC-02):**
   - Hiện tại Antigravity đang chạy trực tiếp từ DMG mount tạm (`/Volumes/Antigravity/Antigravity.app`). Nếu DMG bị unmount hoặc di dời sang `/Applications`, macOS sẽ coi là binary mới và yêu cầu cấp lại quyền TCC.
   - *Biện pháp:* Khuyến nghị chép cố định ứng dụng vào `/Applications/Antigravity.app` trước khi chạy các spike dài ngày.
3. **Rủi ro gián đoạn do Sleep / Screen Lock (R-MAC-03):**
   - `displaysleep` 10 phút mặc định làm hỏng việc chụp màn hình. Bắt buộc duy trì `caffeinate -dimsu` cho soak test 8 giờ ở `SP-18/mac`.

---

## 5. Chưa trả lời được + vì sao
*Không có.* Toàn bộ 9 câu hỏi kỹ thuật (Q1 đến Q9) và bài test khép kín đều đã được kiểm chứng bằng thực nghiệm trực tiếp trên máy Mac mini với mã nguồn chạy thật và ảnh chụp xác nhận 100%.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài
- **Hệ điều hành:** macOS 26.5.2 (Build 25F84)
- **Kiến trúc máy:** `arm64` (Apple M1, 8 cores)
- **Trạng thái dịch mã:** `sysctl.proc_translated = 0` (Native ARM64, không chạy qua Rosetta)
- **Node.js:** `v26.8.2` (arm64, darwin, cài đặt qua Homebrew tại `/opt/homebrew/bin/node`)
- **npm:** `11.19.1`
- **Electron:** `v44.3.0` (arm64)
- **Python:** `Python 3.9.6` (`/usr/bin/python3`, arm64)
- **Apple Clang:** Apple clang version 21.0.0 (clang-2100.1.1.101), Target `arm64-apple-darwin25.5.0`
- **Xcode Command Line Tools:** Đã cài đặt tại `/Library/Developer/CommandLineTools`
- **Homebrew:** `7.0.0`

---

## 7. Bảng đối chiếu Windows ↔ macOS

| Câu hỏi | Trạng thái đối chiếu | Số liệu Windows (`SP-0`) | Số liệu macOS (`SP-0/mac`) | Hệ quả / Ghi chú |
| --- | --- | --- | --- | --- |
| **Q1 — Khởi động app GUI native** | **GIỐNG Windows** | Native Win32 (`win32`, x64). Chạy được Notepad & Electron v44.3.0 nổi trên desktop. | Native Darwin (`arm64`, M1). Chạy được TextEdit & Electron v44.3.0 nổi trên desktop. | Cả 2 OS đều hỗ trợ hoàn hảo kiến trúc desktop shell của Desktop Assistant. |
| **Q2 — Chụp màn hình & Agent tự đọc ảnh** | **GIỐNG Windows** | GDI BitBlt + DWM Bounds (`1280x720`). Agent đọc qua multimodal vision. | `screencapture` + `CGWindowList` (`1920x1080`). Agent đọc qua multimodal vision. | macOS yêu cầu cấp quyền `Screen Recording` cho bundle app cha trong System Settings. |
| **Q3 — Bơm phím giả lập & Đếm ký tự** | **KHÁC Windows** | Windows dùng `SendInput` (struct 40 bytes). Phải tạm dừng tiến trình IME để không bị nuốt Telex. Khớp 200/200. | macOS dùng `CGEventKeyboardSetUnicodeString`. Giữ trọn Unicode, IME không làm sai lệch dấu mà KHÔNG CẦN đụng vào tiến trình IME. Khớp 200/200. | macOS an toàn hơn nhiều: không làm giật chuột người dùng như sai lầm `NtSuspendProcess` của Windows. |
| **Q4 — Di chuột & Click toạ độ** | **KHÁC Windows** | Windows dùng `MOUSEINPUT` / `SetCursorPos`. Gốc Top-Left. Scale factor Windows DPI. | macOS dùng `CGEventCreateMouseEvent`. Quartz dùng Top-Left points; AppKit dùng Bottom-Left points. Quy đổi qua `backingScaleFactor`. | Đã kiểm chứng chuẩn xác các thao tác move, click, double-click. |
| **Q5 — Cấu hình màn hình** | **KHÁC Windows** | Windows: 1280x720, 60Hz, 100% scale. | macOS: 1920x1080, 60.00Hz, scale factor 1.00 (1x). | Mac mini dùng màn hình FHD ngoài. |
| **Q6 — Màn hình khoá & Máy ngủ** | **KHÁC Windows** | Windows: UAC Secure Desktop cô lập màn hình; cần chạy elevated session. | macOS: `displaysleep` ngắt frame capture. Khắc phục bằng thiết lập System Settings và lệnh `caffeinate -dimsu`. | Là cơ sở sống còn để chạy soak test 8 giờ ở `SP-18/mac`. |
| **Q7 — Toolchain native cho SQLite** | **GIỐNG Windows** | Windows có Node x64, cần cài thêm Python 3.11 & VS C++ Build Tools. | macOS có sẵn Clang & Python 3.9, đã cài thêm Node.js v26.8.2 native ARM64 qua Homebrew. | Sẵn sàng cho `SP-12/mac`. |
| **Q8 — Hộp thoại quyền TCC vs UAC** | **KHÁC Windows** | Windows: Hộp thoại UAC chuyển sang Secure Desktop cô lập (Agent hoàn toàn bất lực). | macOS: Cơ chế TCC cấp quyền theo ứng dụng cha (Accessibility, Screen Recording). Người dùng bấm một lần trên màn hình đồ hoạ. | Là đầu vào trực tiếp để thiết kế `SP-22`. |
| **Q9 — Gatekeeper vs SmartScreen** | **GIỐNG Windows** | Windows: SmartScreen không chặn binary chạy qua CLI. | macOS: Gatekeeper không chặn binary chạy CLI; binary Electron có sẵn chữ ký ad-hoc, không có cờ quarantine. | Thuận lợi cho quy trình build và test tại chỗ. |
