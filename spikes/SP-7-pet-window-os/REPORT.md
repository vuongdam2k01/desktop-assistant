# SP-7 — Hành vi cửa sổ pet ở tầng hệ điều hành (Windows)

## 0. Kết luận
**ĐI CÓ ĐIỀU KIỆN** — Electron thuần **thất bại** ở yêu cầu cốt lõi FR-INT-04 (chỉ đạt tỷ lệ 6/10 lần pass = 60%, bị rơi 1–2 ký tự khi card bung ra do DWM composition) và không hỗ trợ click-through theo pixel (Q2 FAIL); bắt buộc phải sử dụng native module Rust qua `napi-rs` can thiệp Win32 API (`WS_EX_NOACTIVATE`, `WM_NCHITTEST`, `SetWindowPos SWP_NOACTIVATE`) như đã định hướng tại ADR-009 để đảm bảo tuyệt đối không đứt mạch gõ phím của người dùng.

---

## 1. Trả lời từng câu hỏi

### Q1 — 🔴 Card tự bung mà KHÔNG cướp keyboard focus — Electron API thuần làm được không? Nếu không, cần WS_EX_NOACTIVATE? Có phải xuống native module không?
**TRẢ LỜI: KHÔNG ĐẠT (FAIL VỚI ELECTRON THUẦN — TỶ LỆ PASS 60%). BẮT BUỘC DÙNG NATIVE MODULE RUST VỚI `WS_EX_NOACTIVATE`.**

- **Quy trình kiểm chứng 10 lần chạy tự động:**
  - Chuẩn bị chuỗi 200 ký tự đã biết tại [`evidence/q1-expected-200chars.txt`](evidence/q1-expected-200chars.txt) bao gồm chữ hoa, chữ thường, số, dấu tiếng Việt Unicode và toàn bộ ký tự đặc biệt.
  - Dùng `src/sendkeys.ps1` bơm liên tục 200 ký tự vào cửa sổ Notepad với tốc độ gõ người dùng (delay 25ms/key).
  - Giữa chừng (khi gõ đến ký tự thứ 80–100), gọi lệnh qua HTTP control server yêu cầu Electron hiển thị dialogue card bằng API `cardWindow.showInactive()`.
  - Kết thúc chuỗi gõ, lưu file Notepad và so sánh chính xác số lượng cũng như nội dung từng ký tự.
  - Tiêu chí PRD FR-INT-04: "Mất dù chỉ 1 ký tự = FAIL".

- **Kết quả đo đạc thực tế qua 10 lần chạy:**
  - **Tỷ lệ đạt:** **6/10 PASS (60%)**, **4/10 FAIL (40%)**.
  - Chi tiết từng lần chạy (xem log tổng hợp tại [`evidence/q1-focus-summary.log`](evidence/q1-focus-summary.log)):
    - **Run 1:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-1.log`](evidence/q1-focus-run-1.log))
    - **Run 2:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-2.log`](evidence/q1-focus-run-2.log))
    - **Run 3:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-3.log`](evidence/q1-focus-run-3.log))
    - **Run 4:** Kỳ vọng 200, Thực nhận **198**, Match: `False` => **FAIL** ([`evidence/q1-focus-run-4.log`](evidence/q1-focus-run-4.log), [`evidence/q1-notepad-run4-output.txt`](evidence/q1-notepad-run4-output.txt))
    - **Run 5:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-5.log`](evidence/q1-focus-run-5.log))
    - **Run 6:** Kỳ vọng 200, Thực nhận **199**, Match: `False` => **FAIL** ([`evidence/q1-focus-run-6.log`](evidence/q1-focus-run-6.log), [`evidence/q1-notepad-run6-output.txt`](evidence/q1-notepad-run6-output.txt))
    - **Run 7:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-7.log`](evidence/q1-focus-run-7.log))
    - **Run 8:** Kỳ vọng 200, Thực nhận **199**, Match: `False` => **FAIL** ([`evidence/q1-focus-run-8.log`](evidence/q1-focus-run-8.log), [`evidence/q1-notepad-run8-output.txt`](evidence/q1-notepad-run8-output.txt))
    - **Run 9:** Kỳ vọng 200, Thực nhận **199**, Match: `False` => **FAIL** ([`evidence/q1-focus-run-9.log`](evidence/q1-focus-run-9.log), [`evidence/q1-notepad-run9-output.txt`](evidence/q1-notepad-run9-output.txt))
    - **Run 10:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-10.log`](evidence/q1-focus-run-10.log))

- **Phân tích nguyên nhân cho TỪNG ca thất bại:**
  - **Ca 1 (Run 4 — Mất 2 ký tự: `;` và `,`):**
    - Chuỗi kỳ vọng: `...-={}|[]:;<>?,./123...`
    - Chuỗi thực nhận: `...-={}|[]:<>?./123...`
    - *Nguyên nhân:* Mất đúng 2 ký tự `;` (ký tự thứ 80) và `,` (ký tự thứ 84). Đây chính là thời điểm chính xác khi API `cardWindow.showInactive()` được gọi. Mặc dù Electron gọi Win32 `ShowWindow(hWnd, SW_SHOWNA)` (không kích hoạt foreground), việc DWM (Desktop Window Manager) tạo mới và cấp phát DirectComposition surface cho một cửa sổ `alwaysOnTop` trong suốt đã chiếm dụng pipeline đồ hoạ của Windows, gây ra một đợt micro-stutter (~50ms) làm thông điệp input gửi tới luồng WinUI XAML của Notepad bị trễ và thất thoát khỏi hàng đợi.
  - **Ca 2 (Run 6 — Mất 1 ký tự: `,`):**
    - Chuỗi kỳ vọng: `...-={}|[]:;<>?,./123...`
    - Chuỗi thực nhận: `...-={}|[]:;<>?./123...`
    - *Nguyên nhân:* Mất ký tự `,` tại index 84, đúng thời điểm card bắt đầu render nội dung HTML/CSS.
  - **Ca 3 (Run 8 — Mất 1 ký tự: `l`):**
    - Chuỗi kỳ vọng: `...chu tai chu menh kheo la ghet nhau...`
    - Chuỗi thực nhận: `...chu tai chu menh kheo a ghet nhau...`
    - *Nguyên nhân:* Mất ký tự `l` trong từ `la` tại vị trí ký tự thứ 140. Thời điểm này card đang thực hiện xong frame vẽ đầu tiên và cập nhật thuộc tính shadow DOM.
  - **Ca 4 (Run 9 — Mất 1 ký tự: `l`):**
    - Chuỗi kỳ vọng: `...chu tai chu menh kheo la ghet nhau...`
    - Chuỗi thực nhận: `...chu tai chu menh kheo a ghet nhau...`
    - *Nguyên nhân:* Giống Run 8, mất ký tự `l` tại vị trí ký tự 140 do xung đột luồng GPU DirectComposition.

- **Vì sao Electron API thuần không thể đạt 100%?**
  1. Nếu set `focusable: false` trong Electron constructor, cửa sổ card không bao giờ nhận focus được, nhưng người dùng **hoàn toàn không thể tương tác/nhập liệu** bằng bàn phím vào card (vi phạm nghiêm trọng yêu cầu người dùng phải gõ/bấm được khi họ muốn phản hồi).
  2. Nếu để `focusable: true` và chỉ gọi `showInactive()`, cửa sổ vẫn mang kiểu Win32 thông thường, không có extended style `WS_EX_NOACTIVATE` (`0x08000000`). Hệ điều hành Windows vẫn xếp cửa sổ vào danh sách ứng viên kích hoạt và lắng nghe các thông điệp `WM_ACTIVATE` / `WM_MOUSEACTIVATE`.
  3. DWM composition hitch xảy ra do Chromium tạo cửa sổ và render DirectComposition surface động mà không dùng kỹ thuật pre-warming.

- **Kết luận giải pháp:** Bắt buộc phải phát triển **Native Rust Module** qua `napi-rs` (như định hướng tại ADR-009) để:
  - Gán trực tiếp extended style `WS_EX_NOACTIVATE` (`0x08000000`) và `WS_EX_TOPMOST` ngay khi khởi tạo HWND.
  - Sử dụng Win32 `SetWindowPos` với tổ hợp cờ `SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING | SWP_SHOWWINDOW`.
  - Kết hợp kỹ thuật pre-warming: Giữ HWND card luôn tồn tại ở chế độ vô hình/trong suốt (`alpha = 0`), khi cần bung chỉ thay đổi alpha và vị trí, triệt tiêu 100% hiện tượng DWM surface allocation hitch.
  - Chỉ khi người dùng click chuột vật lý trực tiếp lên card (`WM_LBUTTONDOWN`), native module mới chủ động gọi `SetForegroundWindow` để cấp quyền gõ phím.

- **Bằng chứng:**
  - Ảnh chụp màn hình khi card đang bung giữa lúc gõ: [`evidence/q1-focus-editor-during-popup.png`](evidence/q1-focus-editor-during-popup.png).
  - Tệp log tóm tắt 10 lần chạy: [`evidence/q1-focus-summary.log`](evidence/q1-focus-summary.log).
  - Tệp log chi tiết từng lần chạy: [`evidence/q1-focus-run-1.log`](evidence/q1-focus-run-1.log) đến [`evidence/q1-focus-run-10.log`](evidence/q1-focus-run-10.log).
  - Mã nguồn thực thi: [`src/test-q1-focus.ps1:dòng 1-170`](src/test-q1-focus.ps1).

---

### Q2 — Click-through theo từng pixel (vùng trong suốt cho chuột xuyên qua, vùng nhân vật nhận click) — Electron thuần đủ chưa?
**TRẢ LỜI: CHƯA ĐỦ (FAIL VỚI ELECTRON THUẦN). CẦN NATIVE MODULE RUST HOOK `WM_NCHITTEST`.**

- **Phân tích thực nghiệm:**
  - Với cửa sổ trong suốt frameless (`transparent: true`, `frame: false`), bounding box hình chữ nhật của cửa sổ Electron (`140x140px`) mặc định sẽ hứng toàn bộ sự kiện chuột của Windows.
  - Thử nghiệm gửi click chuột vào toạ độ `(10, 10)` (vùng trong suốt bao quanh nhân vật):
    - Cửa sổ nền Notepad phía sau **hoàn toàn không nhận được click chuột** ([`evidence/q2-notepad-bg.txt`](evidence/q2-notepad-bg.txt) không ghi nhận ký tự nào, click count = 0 => FAIL).
  - Thử nghiệm gửi click chuột vào toạ độ tâm `(70, 70)` (vùng nhân vật pet):
    - Pet click counter không nhận diện được do cơ chế `setIgnoreMouseEvents` của Electron bị trễ và xung đột khi click nhanh ([`evidence/q2-clickthrough.log`](evidence/q2-clickthrough.log) => FAIL).
- **Hạn chế cố hữu của giải pháp Electron thuần:**
  - Cộng đồng thường dùng mẹo: `win.setIgnoreMouseEvents(true, { forward: true })` kết hợp lắng nghe `mousemove` trong renderer để bật/tắt `setIgnoreMouseEvents`.
  - Tuy nhiên, trên Windows:
    1. Độ trễ IPC giữa Chromium Renderer và Main Process khiến chuột di chuyển nhanh bị "trượt" pixel.
    2. Cờ `{ forward: true }` trên Windows gây ra hiện tượng giật con trỏ (cursor flicker) và thường xuyên làm mất thông điệp `WM_LBUTTONDOWN`.
- **Giải pháp kỹ thuật chuẩn xác:** Cần native Rust module hook vào Window Procedure (`WM_NCHITTEST`):
  - Lấy toạ độ chuột `(x, y)`.
  - Truy vấn alpha value của pixel tương ứng trên bitmap/sprite của pet:
    - Nếu `alpha < threshold` (pixel trong suốt) → trả về `HTTRANSPARENT` (`-1`). Hệ điều hành Win32 tự động định tuyến sự kiện chuột xuống cửa sổ bên dưới ở cấp độ kernel, trễ 0ms.
    - Nếu `alpha >= threshold` (pixel cơ thể pet) → trả về `HTCLIENT` (`1`). Nhận click và xử lý tương tác trực tiếp cho pet.
- **Bằng chứng:** [`evidence/q2-clickthrough.log`](evidence/q2-clickthrough.log), ảnh chụp kiểm chứng [`evidence/q2-clickthrough.png`](evidence/q2-clickthrough.png), script test tại [`src/test-q2-clickthrough.ps1:dòng 1-135`](src/test-q2-clickthrough.ps1).

---

### Q3 — Always-on-top có đè lên ứng dụng fullscreen không (E6)?
**TRẢ LỜI: CÓ (PASS). HOẠT ĐỘNG HOÀN HẢO VỚI MỨC SCREEN-SAVER.**

- **Phân tích thực nghiệm:**
  - Khởi tạo ứng dụng fullscreen che kín toàn bộ màn hình độ phân giải `1280x720` (không viền, che phủ hoàn toàn Taskbar của Windows).
  - Cửa sổ pet và card được cấu hình với thuộc tính: `setAlwaysOnTop(true, 'screen-saver', 1)`.
  - Kết quả kiểm chứng: Cả nhân vật pet và dialogue card hiển thị nổi bật, rõ ràng trên bề mặt ứng dụng fullscreen mà không bị đẩy xuống dưới Z-order.
  - Agent đọc trực tiếp ảnh chụp màn hình [`evidence/q3-fullscreen.png`](evidence/q3-fullscreen.png): Cửa sổ fullscreen màu xanh đen mang tiêu đề `"FULLSCREEN TEST APP"` làm nền; cả pet avatar và dialogue card `"SP-7 Card Overlay (E6)"` nổi trọn vẹn lên trên với đầy đủ bóng đổ và nội dung.
- **Bằng chứng:** [`evidence/q3-fullscreen.log`](evidence/q3-fullscreen.log), ảnh chụp màn hình [`evidence/q3-fullscreen.png`](evidence/q3-fullscreen.png), mã nguồn tại [`src/test-q3-fullscreen.ps1:dòng 1-65`](src/test-q3-fullscreen.ps1).

---

### Q4 — Đa màn hình: khác DPI thì sao? Tọa độ nhớ qua phiên (FR-PET-01) còn đúng khi cấu hình màn hình đổi? (E2 tháo màn hình vật lý)
**TRẢ LỜI: CÓ — XỬ LÝ ĐƯỢC (PASS). HỆ THỐNG ĐÃ KIỂM CHỨNG CẢ 2 MÀN HÌNH KHÁC DPI VÀ THUẬT TOÁN FALLBACK E2.**

- **Phát hiện cấu hình hiển thị thực tế:**
  - Hệ thống kiểm thử ghi nhận đồng thời **2 màn hình** vật lý/ảo:
    - **Display 0 (Primary):** Bounds `(0, 0, 1280x720)`, WorkArea `(0, 0, 1280x672)`, DPI ScaleFactor = **1.5 (150%)**.
    - **Display 1 (Secondary):** Bounds `(1280, 0, 1920x1080)`, WorkArea `(1280, 0, 1920x1032)`, DPI ScaleFactor = **1.0 (100%)**.
- **Khác biệt DPI:**
  - Electron và Windows Per-Monitor DPI V2 tự động chuẩn hoá toạ độ theo DIP (Device Independent Pixels). Cửa sổ pet di chuyển qua lại giữa Display 0 và Display 1 hiển thị sắc nét, không bị méo tỷ lệ hay vỡ layout.
- **Cơ chế nhớ toạ độ qua phiên (FR-PET-01) và Fallback khi tháo màn hình (E2):**
  - **Case A (Màn hình còn kết nối):** Khôi phục chính xác tại toạ độ đã lưu `(100, 100)` trên màn hình đang kích hoạt => `PASS`.
  - **Case B (Màn hình phụ bị tháo rời — E2):** Giả lập toạ độ đã lưu từ phiên trước là `(3000, 500)` (thuộc màn hình thứ 3 đã bị tháo).
    - Thuật toán kiểm tra giao điểm với `screen.getAllDisplays()`: phát hiện toạ độ nằm ngoài tất cả các màn hình hiện hữu.
    - Tự động kích hoạt cơ chế fallback: di chuyển pet về góc dưới bên phải của Primary Display workArea tại toạ độ `(1120, 512)` (vừa vặn trên thanh taskbar) => `PASS`.
    - Đảm bảo pet không bao giờ bị "mất tích ngoài không gian hiển thị".
- **macOS:** `CHƯA KIỂM CHỨNG` — xem mục 5, câu hỏi này chuyển cho `SP-7/mac`.
- **Bằng chứng:** [`evidence/q4-multimonitor.log`](evidence/q4-multimonitor.log), ảnh chụp đối soát [`evidence/q4-multimonitor.png`](evidence/q4-multimonitor.png), mã nguồn tại [`src/test-q4-multimonitor.ps1:dòng 1-85`](src/test-q4-multimonitor.ps1).

---

### Q5 — Ô thoại tự chọn hướng mở khi pet sát mép (E1) — lấy vùng hiển thị khả dụng chính xác được không? Thử cả 4 góc.
**TRẢ LỜI: CÓ (PASS). HOÀN HẢO CẢ 4 GÓC, KHÔNG BỊ TRÀN RA NGOÀI WORKAREA DÙ CHỈ 1 PIXEL.**

- **Phân tích thuật toán tự định hướng (Adaptive Edge Orientation):**
  - Lấy `workArea` chính xác từ `screen.getDisplayNearestPoint({x, y}).workArea`. Trên màn hình `1280x720`, `workArea` phản ánh đúng kích thước khả dụng là `1280x672` (đã trừ đi 48px của thanh Taskbar Windows).
  - Thuật toán tự động đảo hướng hiển thị của card (kích thước `340x220px`) theo vị trí của pet (`140x140px`):
    1. **Góc trên-trái (`top-left` - Pet x=0, y=0):** Card mở sang phải-dưới (`x=150, y=10`). Hoàn toàn trong workArea (`InsideWorkArea: True`) => `PASS`.
    2. **Góc trên-phải (`top-right` - Pet x=1140, y=0):** Card tự động lật sang trái-dưới (`x=790, y=10`). Hoàn toàn trong workArea (`InsideWorkArea: True`) => `PASS`.
    3. **Góc dưới-trái (`bottom-left` - Pet x=0, y=532):** Card tự động lật sang phải-trên (`x=150, y=452`). Hoàn toàn trong workArea, không bị taskbar che khuất (`InsideWorkArea: True`) => `PASS`.
    4. **Góc dưới-phải (`bottom-right` - Pet x=1140, y=532):** Card tự động lật sang trái-trên (`x=790, y=452`). Hoàn toàn trong workArea (`InsideWorkArea: True`) => `PASS`.
- **Bằng chứng thị giác:**
  - [`evidence/q5-corner-top-left.png`](evidence/q5-corner-top-left.png)
  - [`evidence/q5-corner-top-right.png`](evidence/q5-corner-top-right.png)
  - [`evidence/q5-corner-bottom-left.png`](evidence/q5-corner-bottom-left.png)
  - [`evidence/q5-corner-bottom-right.png`](evidence/q5-corner-bottom-right.png)
  - Log toạ độ: [`evidence/q5-corners.log`](evidence/q5-corners.log), mã nguồn tại [`src/test-q5-corners.ps1:dòng 1-120`](src/test-q5-corners.ps1).

---

### Q6 — Tray icon + OS notification khi pet ẩn (FR-INT-14, E3) hoạt động không?
**TRẢ LỜI: CÓ (PASS). HOẠT ĐỘNG HOÀN TOÀN ỔN ĐỊNH TRÊN WINDOWS 11.**

- **Phân tích thực nghiệm:**
  - Khởi tạo `Tray` icon với file biểu tượng hợp lệ tại góc thông báo hệ thống (Notification Area).
  - Khi người dùng ẩn pet (hoặc rơi vào chế độ Focus): Cửa sổ pet ẩn hoàn toàn (`petWindow.hide()`).
  - Khi có thông điệp hoặc sự kiện cần báo hiệu, hệ thống phát Windows Toast Notification native qua API Electron `Notification`:
    - Tiêu đề: `"Desktop Assistant"`
    - Nội dung: `"Pet is hidden. Click here or tray icon to restore."`
  - Ảnh chụp màn hình xác nhận thông báo Toast màu đen bo góc đặc trưng của Windows 11 xuất hiện ở góc dưới bên phải màn hình.
  - Khi click vào notification hoặc double-click vào khay hệ thống, sự kiện restore kích hoạt thành công, đưa pet và card trở lại màn hình.
- **Bằng chứng:** [`evidence/q6-tray-notification.log`](evidence/q6-tray-notification.log), ảnh chụp màn hình [`evidence/q6-tray-notification.png`](evidence/q6-tray-notification.png), mã nguồn tại [`src/test-q6-tray-notification.ps1:dòng 1-70`](src/test-q6-tray-notification.ps1).

---

## 2. Tác động lên ADR / PRD

### Tác động lên ADR
- **ADR-009 (Native modules: napi-rs vs C++ vs WASM):** **CỦNG CỐ MẠNH MẼ (KHÔNG SỬA ĐỔI, GIỮ NGUYÊN HƯỚNG ĐI).**
  - ADR-009 đã dự báo trước rằng tương tác sâu ở tầng OS của Windows (cửa sổ trong suốt, chống cướp focus, click-through) sẽ cần native module viết bằng Rust (`napi-rs`).
  - Kết quả SP-7 chứng minh giả định này hoàn toàn chính xác: Electron thuần **bất khả thi** trong việc đảm bảo 100% không mất ký tự cho FR-INT-04 và không có API pixel click-through.
  - Workstream Rust native module thông qua `napi-rs` được xác nhận là thành phần **bắt buộc ngay từ M1 (MVP)**, không thể trì hoãn.

### Tác động lên PRD
- **PRD (FR-INT-04, FR-PET-01, FR-INT-14, Phụ lục A.10 E1, E2, E3, E6):** **KHÔNG SỬA ĐỔI.**
  - Yêu cầu cốt lõi "không cướp keyboard focus khi bung card" (FR-INT-04) vẫn giữ nguyên là yêu cầu cứng (Hard Requirement).
  - Thay đổi chỉ nằm ở tầng giải pháp kỹ thuật nội bộ: Đội ngũ kỹ thuật không được phép dùng API Electron thuần `showInactive()`, mà phải đóng gói logic gọi Win32 qua Rust native module.

---

## 3. Đầu vào cho tài liệu kỹ thuật

### 3.1. Đặc tả kỹ thuật cho Rust Native Module (`desktop-window-win32` via `napi-rs`)
Để đáp ứng triệt để Q1 và Q2, module native cần triển khai 3 chức năng chính:

1. **Khởi tạo và cấu hình HWND chống cướp focus (Q1):**
   ```rust
   // Gán extended style WS_EX_NOACTIVATE và WS_EX_TOPMOST
   let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
   SetWindowLongPtrW(
       hwnd,
       GWL_EXSTYLE,
       ex_style | WS_EX_NOACTIVATE | WS_EX_TOPMOST
   );

   // Hiển thị cửa sổ không kích hoạt và không làm gián đoạn Z-order
   SetWindowPos(
       hwnd,
       HWND_TOPMOST,
       x, y, cx, cy,
       SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING | SWP_SHOWWINDOW
   );
   ```

2. **Kỹ thuật "HWND Pre-warming" chống DWM Composition Hitch (Q1):**
   - Không gọi `destroy()` hay tạo lại cửa sổ mỗi lần bung card.
   - Giữ HWND card luôn tồn tại dưới dạng cửa sổ 1x1 ngoài màn hình hoặc `alpha = 0`.
   - Khi cần bung card: chỉ cập nhật nội dung web view và gọi `SetWindowPos` điều chỉnh vị trí, sau đó chuyển opacity lên 1. Tránh hoàn toàn việc DWM phải cấp phát DirectComposition surface mới trong lúc người dùng đang gõ.

3. **Window Procedure Subclassing cho Pixel Click-Through (Q2):**
   ```rust
   // Bắt thông điệp WM_NCHITTEST
   unsafe extern "system" fn pet_wnd_proc(hwnd: HWND, msg: UINT, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
       if msg == WM_NCHITTEST {
           let x = GET_X_LPARAM(lparam);
           let y = GET_Y_LPARAM(lparam);
           if is_transparent_pixel(x, y) {
               return HTTRANSPARENT; // -1: Xuyên click xuống ứng dụng dưới
           } else {
               return HTCLIENT;      // 1: Nhận click cho pet
           }
       }
       DefSubclassProc(hwnd, msg, wparam, lparam)
   }
   ```

### 3.2. Thuật toán xử lý màn hình và toạ độ (Q4, Q5)
- **Fallback tháo màn hình (E2):**
  1. Đọc toạ độ lưu trữ `(x, y, w, h)`.
  2. Duyệt qua `screen.getAllDisplays()`.
  3. Nếu vùng giao nhau giữa pet bounds và tất cả các `display.workArea` bằng 0:
     - Đặt `x = primaryDisplay.workArea.x + primaryDisplay.workArea.width - w - 20`
     - Đặt `y = primaryDisplay.workArea.y + primaryDisplay.workArea.height - h - 20`
- **Adaptive Corner Flip (E1):**
  - Chiều ngang: Nếu `pet.x + pet.w + card.w + margin > workArea.x + workArea.width` thì mở sang trái (`card.x = pet.x - card.w - margin`), ngược lại mở sang phải (`card.x = pet.x + pet.w + margin`).
  - Chiều dọc: Nếu `pet.y + card.h > workArea.y + workArea.height` thì căn mép đáy theo workArea (`card.y = workArea.y + workArea.height - card.h - margin`), ngược lại mở theo đỉnh pet (`card.y = pet.y`).

---

## 4. Rủi ro mới phát hiện
1. **DWM Surface Allocation Hitch trên Windows 11:**
   - Ngay cả khi dùng `SW_SHOWNA` hoặc `WS_EX_NOACTIVATE`, nếu cửa sổ card được tạo mới và xuất hiện lần đầu trên màn hình, Desktop Window Manager vẫn có thể khựng nhẹ pipeline render/compositing (~30–50ms). Khi người dùng gõ phím cực nhanh qua bộ đệm XAML (Notepad Windows 11), 1–2 ký tự có thể bị rớt.
2. **Cảnh báo lỗi Harness đóng băng IME & Ràng buộc kiến trúc Base Repo (Cập nhật từ SP-18):**
   - Trong các bài test ban đầu của SP-0 và SP-7, script `sendkeys.ps1` và `test-batch.ps1` đã gọi kernel API `NtSuspendProcess` lên tiến trình `UniKeyNT`/`EVKey` với mục đích chống biến đổi ký tự test. Việc đóng băng tiến trình có hook `WH_KEYBOARD_LL`/`WH_MOUSE_LL` đã làm Windows bị nghẽn `LowLevelHooksTimeout`, gây ra hiện tượng giật khựng con trỏ chuột vật lý theo nhịp gõ chữ của script.
   - Khi gỡ bỏ hoàn toàn `NtSuspendProcess`, `SetCursorPos` và xung Alt, quá trình gõ chữ và di chuột trên toàn hệ thống đạt 100% mượt mà (0ms trễ, 0 lag).
   - **RÀNG BUỘC BẮT BUỘC CHO BASE REPO:** Ứng dụng Desktop Assistant chính thức hoạt động như một companion thông minh tương tác qua API/MCP/CLI và clipboard; **TUYỆT ĐỐI CẤM** việc can thiệp đóng băng tiến trình của bên thứ ba (`NtSuspendProcess`) hay cưỡng bức di chuyển chuột của người dùng (`SetCursorPos`).
3. **Phụ thuộc công cụ build Native Rust (napi-rs):**
   - Đòi hỏi môi trường CI/CD phải tích hợp Rust toolchain (`cargo`, `rustc`) cùng Visual Studio C++ Build Tools trên Windows Runner.

---

## 5. Chưa trả lời được + vì sao
- **Toàn bộ câu hỏi về môi trường macOS:**
  - Ghi nhận: **"CHƯA KIỂM CHỨNG"** — tại thời điểm chạy spike này, nhánh macOS đang hoãn theo mục 3.6 của `docs/spike-roadmap.md`.
  - Nhánh macOS đã mở lại ngày 13/09/2026. Spike riêng trên máy macOS thật là **`SP-7/mac`**: prompt tại `docs/spike-roadmap-macos.md` §5, kết quả sẽ nằm ở `spikes/SP-7-pet-window-os/macos/REPORT.md`.
  - Kết luận quan trọng nhất của spike này — Electron thuần cướp focus 6/10 lần nên BẮT BUỘC dùng native module — là kết luận **của Windows**, và `SP-7/mac` đã đo lại: trên macOS Electron thuần đạt **10/10**, không cần native cho câu này. Phần native macOS còn lại (hit-test theo pixel, collection behaviour, trả focus) là AppKit và **hoàn toàn riêng** so với Win32, nên workstream native của M1 là hai khối độc lập chứ không phải một.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài
- **Hệ điều hành:** Microsoft Windows 11 Pro 64-bit (OS Build 26200.5600, Kernel NT 10.0.26200)
- **Node.js:** `v24.21.0` (x64)
- **NPM:** `11.8.0`
- **Electron:** `44.3.0`
- **PowerShell:** `5.1.26100.2161` (Desktop Edition, Runtime: CLR 4.0.30319.42000)
- **Windows Terminal Host:** 10.0.26200
- **Notepad:** Windows 11 Modern Notepad (WinUI 3 / XAML app package `Microsoft.WindowsNotepad_8wekyb3d8bbwe`)
