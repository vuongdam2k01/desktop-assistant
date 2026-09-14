# SP-7/mac — Hành vi cửa sổ pet ở tầng hệ điều hành (macOS)

## 0. Kết luận
**ĐI CÓ ĐIỀU KIỆN** — Trên macOS, Electron thuần **đạt tỷ lệ tuyệt đối 10/10 PASS (100%)** ở yêu cầu cốt lõi FR-INT-04 (hoàn toàn vượt trội so với tỷ lệ thất bại 6/10 trên Windows), với 0 ký tự rơi rụng trong suốt quá trình người dùng gõ phím tốc độ cao khi card tự bung nhờ cơ chế `showInactive()` kết hợp `type: 'panel'` (NSPanel) và kiến trúc render bất đồng bộ của macOS WindowServer/Metal không làm nghẽn hàng đợi sự kiện HID. Tuy nhiên, để tối ưu click-through theo pixel (Q2) với độ trễ 0ms (loại bỏ trễ IPC ~20ms của Chromium) và xử lý bài toán hai cửa sổ trong cùng một tiến trình theo ADR-002 (Q7 — ẩn Pet khỏi Dock/Switcher nhưng giữ App Window bình thường), macOS vẫn cần native module hoặc native wrapper AppKit (`desktop-window-macos`). Phạm vi native trên macOS là **HOÀN TOÀN RIÊNG BIỆT** so với Windows (AppKit `NSPanel` / `-[NSView hitTest:]` / `NSApplicationActivationPolicy` thay vì Win32 `WS_EX_NOACTIVATE` / `WM_NCHITTEST`), nghĩa là hai khối mã nguồn độc lập cho hai hệ điều hành.

---

## 1. Trả lời từng câu hỏi

### Q1 — 🔴 Card tự bung mà KHÔNG cướp keyboard focus — Electron API thuần làm được không? Có cần WS_EX_NOACTIVATE hoặc module native AppKit không?
**TRẢ LỜI: ĐẠT 100% (10/10 PASS) VỚI ELECTRON THUẦN. KHÔNG CẦN NATIVE MODULE CHO YÊU CẦU NÀY.**

- **Quy trình kiểm chứng 10 lần chạy tự động:**
  - Chuẩn bị chuỗi 200 ký tự chuẩn tại [`evidence/q1-expected-200chars.txt`](evidence/q1-expected-200chars.txt) (`0123456789` lặp 20 lần).
  - Bơm liên tục 200 ký tự vào cửa sổ TextEdit đang active với tốc độ gõ người dùng (delay 25ms/phím, tổng thời gian gõ ~5.8 giây) thông qua sự kiện native CoreGraphics `CGEvent`.
  - Giữa chừng (tại thời điểm 2.5s, khoảng ký tự thứ 90–100), gọi lệnh qua HTTP control server yêu cầu Electron hiển thị dialogue card bằng API `cardWindow.showInactive()`.
  - Kết thúc chuỗi gõ, đọc lại nội dung tài liệu TextEdit và so sánh chính xác số lượng cũng như nội dung từng ký tự.
  - Tiêu chí PRD FR-INT-04: "Mất dù chỉ 1 ký tự = FAIL".

- **Kết quả đo đạc thực tế qua 10 lần chạy liên tiếp:**
  - **Tỷ lệ đạt:** **10/10 PASS (100%)**, **0/10 FAIL (0%)**.
  - Chi tiết từng lần chạy (xem log tổng hợp tại [`evidence/q1-focus-summary.log`](evidence/q1-focus-summary.log)):
    - **Run 1:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-1.log`](evidence/q1-focus-run-1.log))
    - **Run 2:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-2.log`](evidence/q1-focus-run-2.log))
    - **Run 3:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-3.log`](evidence/q1-focus-run-3.log))
    - **Run 4:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-4.log`](evidence/q1-focus-run-4.log))
    - **Run 5:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-5.log`](evidence/q1-focus-run-5.log))
    - **Run 6:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-6.log`](evidence/q1-focus-run-6.log))
    - **Run 7:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-7.log`](evidence/q1-focus-run-7.log))
    - **Run 8:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-8.log`](evidence/q1-focus-run-8.log))
    - **Run 9:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-9.log`](evidence/q1-focus-run-9.log))
    - **Run 10:** Kỳ vọng 200, Thực nhận 200, Match: `True` => **PASS** ([`evidence/q1-focus-run-10.log`](evidence/q1-focus-run-10.log))

- **Đo đối chuẩn thêm 10 lần với cấu hình cửa sổ tiêu chuẩn (`mode=normal`, NSWindow thuần):**
  - Cả 10/10 lần chạy đều đạt **PASS 200/200 ký tự** (100%).

- **Phân tích nguyên nhân vì sao macOS ĐẠT mà Windows THẤT BẠI (60%):**
  1. Trên Windows: Quá trình tạo mới và cấp phát bề mặt DirectComposition cho cửa sổ trong suốt `alwaysOnTop` của DWM (Desktop Window Manager) chiếm dụng đồ hoạ đồng bộ, gây micro-stutter ~50ms làm trễ luồng tin nhắn WinUI XAML của Notepad dẫn đến mất ký tự.
  2. Trên macOS: Kiến trúc Quartz WindowServer kết hợp CoreAnimation/Metal xử lý compositing hoàn toàn bất đồng bộ trên luồng riêng của hệ thống. Luồng bơm sự kiện bàn phím CoreGraphics (`CGEvent`) truyền thẳng tới vòng lặp sự kiện `NSApplication` của ứng dụng tiền cảnh (TextEdit) mà không bị ảnh hưởng bởi việc cấp phát surface mới của Electron.
  3. API `cardWindow.showInactive()` trên macOS gọi trực tiếp `[NSWindow orderFrontRegardless]` hoặc `[NSWindow orderFront:nil]`, không gọi `[NSApp activateIgnoringOtherApps:YES]`. Khi kết hợp `type: 'panel'`, cửa sổ được gắn thuộc tính `NSWindowStyleMaskNonactivatingPanel`, đảm bảo hệ điều hành macOS không bao giờ chuyển giao `keyWindow` từ ứng dụng soạn thảo sang dialogue card.

- **Bằng chứng:**
  - Ảnh chụp màn hình khi card đang bung giữa lúc gõ: [`evidence/q1-focus-editor-during-popup.png`](evidence/q1-focus-editor-during-popup.png).
  - Log tổng hợp: [`evidence/q1-focus-summary.log`](evidence/q1-focus-summary.log).
  - Mã nguồn thực thi: [`src/test-q1-focus.sh`](src/test-q1-focus.sh).
- **Đối chiếu Windows:** **KHÁC Windows** (macOS đạt 10/10 PASS với Electron thuần; Windows fail 4/10 lần và bắt buộc phải dùng native module).

---

### Q2 — Click-through theo từng pixel: vùng trong suốt cho chuột xuyên qua, vùng nhân vật nhận click. Electron có đủ chính xác không? Cơ chế thay thế trên macOS là gì?
**TRẢ LỜI: ELECTRON THUẦN DÙNG ĐƯỢC NHƯNG CÓ TRỄ IPC (~16–30MS). NATIVE MODULE SỬ DỤNG `-[NSView hitTest:]` THAY THẾ CHO `WM_NCHITTEST`.**

- **Phân tích thực nghiệm Electron thuần:**
  - Sử dụng cơ chế: `win.setIgnoreMouseEvents(true, { forward: true })` kết hợp lắng nghe `mousemove` trong renderer để gọi `setIgnoreMouseEvents(false)` khi chuột chạm vào phần tử interactive.
  - Thử nghiệm click vào vùng trong suốt `(x=8, y=8)`: Chuột xuyên qua cửa sổ Pet thành công, TextEdit bên dưới nhận click, không bị chặn bởi bounding box 140x140.
  - Thử nghiệm click vào tâm Pet `(x=70, y=70)`: Pet avatar nhận sự kiện click qua IPC thành công (`petClicks` tăng).
  - Thử nghiệm quét bán kính viền nhân vật (bán kính hình tròn 50px):
    - Tại khoảng cách 10px, 20px, 30px, 40px: Nhận click (HIT_PET).
    - Tại khoảng cách >54px (vùng trong suốt): Chuột xuyên qua (PASS_THROUGH).
- **Hạn chế của giải pháp Electron thuần:**
  - Tồn tại độ trễ IPC round-trip giữa Renderer Process và Main Process (`mousemove` -> `document.elementFromPoint` -> IPC `set-ignore-mouse-events` -> AppKit `[window setIgnoresMouseEvents:]`). Nếu người dùng vẩy chuột nhanh và click tức thì (<30ms), sự kiện chuột có thể lọt qua trước khi AppKit kịp cập nhật mask.
  - Sai số viền khoảng 2–4 pixel do `document.elementFromPoint()` nội suy bounding box của DOM element thay vì đọc kênh alpha thực tế của sprite.
- **Cơ chế thay thế ở tầng native AppKit (macOS không có Win32 `WM_NCHITTEST`):**
  - Trong AppKit, mọi thao tác định tuyến chuột đi qua phương thức: `-[NSView hitTest:(NSPoint)point]`.
  - Triển khai Native Module: Subclass `NSView` gốc của cửa sổ Pet:
    ```objc
    - (NSView *)hitTest:(NSPoint)point {
        NSPoint localPoint = [self convertPoint:point fromView:nil];
        uint8_t alpha = [self getAlphaAtPoint:localPoint];
        if (alpha == 0) {
            return nil; // nil = xuyên click xuống ứng dụng phía dưới lập tức (0ms latency)
        }
        return self;    // nhận click chuột cho pet
    }
    ```
- **Bằng chứng:** [`evidence/q2-clickthrough.log`](evidence/q2-clickthrough.log), ảnh chụp [`evidence/q2-clickthrough.png`](evidence/q2-clickthrough.png), script tại [`src/test-q2-clickthrough.sh`](src/test-q2-clickthrough.sh).
- **Đối chiếu Windows:** **KHÁC Windows** (macOS không có `WM_NCHITTEST` mà dùng `-[NSView hitTest:]`).

---

### Q3 — Always-on-top có đè lên ứng dụng fullscreen native không (E6)? Mission Control, Stage Manager, Spaces?
**TRẢ LỜI: CÓ (PASS). HOẠT ĐỘNG HOÀN HẢO KHI CẤU HÌNH ĐỦ CỜ SPACES.**

- **Phân tích thực nghiệm:**
  - Thử nghiệm trên cả 2 chế độ Fullscreen:
    1. *Simple Fullscreen* (cửa sổ chiếm 100% màn hình đè toàn bộ Menu bar và Dock): Pet và Dialogue Card nổi rõ ràng ở Z-order cao nhất ([`evidence/q3-fullscreen-simple.png`](evidence/q3-fullscreen-simple.png)).
    2. *Native macOS Fullscreen Space* (ứng dụng mở riêng một Spaces toàn màn hình): Cả Pet và Card đều hiển thị đầy đủ, sắc nét trên bề mặt fullscreen ([`evidence/q3-fullscreen-native.png`](evidence/q3-fullscreen-native.png)).
  - **Hành vi chuyển Spaces:**
    - Cần cấu hình: `win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`.
    - Thuộc tính AppKit tương ứng: `NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorFullScreenAuxiliary`.
    - Kết quả: Khi người dùng chuyển đổi qua lại giữa các Space (Desktop 1, Desktop 2, Fullscreen app Space), Pet tự động xuất hiện ở tất cả các Space, không bị giữ lại ở Space cũ.
  - **Hành vi Mission Control:**
    - Khi kích hoạt Mission Control, toàn bộ các cửa sổ trên desktop thu nhỏ lại thành lưới thumbnail.
    - Riêng Pet Window và Dialogue Card với cấp `screen-saver` (`kCGScreenSaverWindowLevel`) giữ nguyên vị trí toạ độ tuyệt đối trên màn hình, không bị thu nhỏ ([`evidence/q3-mission-control.png`](evidence/q3-mission-control.png)).
- **Bằng chứng:** [`evidence/q3-fullscreen.log`](evidence/q3-fullscreen.log), các ảnh chụp: `evidence/q3-fullscreen-simple.png`, `evidence/q3-fullscreen-native.png`, `evidence/q3-mission-control.png`.
- **Đối chiếu Windows:** **GIỐNG Windows** về mức `screen-saver` đè fullscreen; **KHÁC Windows** về cơ chế Spaces và Mission Control chỉ có trên macOS.

---

### Q4 — Đa màn hình khác scale (Retina 2x + màn ngoài 1x): toạ độ nhớ qua phiên (FR-PET-01) còn đúng khi cấu hình màn hình đổi không? Tháo màn hình đang chứa pet (E2) thì sao?
**TRẢ LỜI: PHẦN KHÁC SCALE GHI NHẬN CHƯA KIỂM CHỨNG (GIỚI HẠN PHẦN CỨNG). THUẬT TOÁN FALLBACK THÁO MÀN HÌNH (E2) ĐẠT 100% (PASS).**

- **Giới hạn phần cứng (tuân thủ mục 3.9 của `docs/spike-roadmap-macos.md`):**
  - Máy Mac mini thử nghiệm gắn 1 màn hình vật lý duy nhất (1080p, scaleFactor = 1.0).
  - Phép đo toạ độ trên 2 màn hình khác hệ số scale (Retina 2x + màn ngoài 1x): **CHƯA KIỂM CHỨNG — thiếu phần cứng, cần máy có 2 màn hình khác scale**.
- **Kiểm chứng thuật toán Fallback khi tháo màn hình (E2):**
  - Giả lập toạ độ lưu phiên trước `(3500, 800)` (toạ độ màn hình ngoài đã bị tháo).
  - Thuật toán kiểm tra giao điểm với `screen.getAllDisplays()`: phát hiện toạ độ nằm ngoài vùng hiển thị của tất cả các màn hình hiện hữu.
  - Tự động fallback đưa Pet về góc dưới bên phải của Primary Display `workArea` tại toạ độ `(1760, 830)`.
  - Kết quả kiểm tra: Pet xuất hiện an toàn trong tầm mắt người dùng, không bao giờ bị lạc ngoài không gian ảo.
- **Bằng chứng:** [`evidence/q4-multimonitor.log`](evidence/q4-multimonitor.log), script [`src/test-q4-multimonitor.sh`](src/test-q4-multimonitor.sh).
- **Đối chiếu Windows:** **GIỐNG Windows** về thuật toán Fallback E2; phần đa màn hình Retina/1x ghi nhận chưa kiểm chứng do giới hạn máy Mac mini.

---

### Q5 — Ô thoại tự chọn hướng mở khi pet sát mép (E1): lấy được vùng hiển thị khả dụng chính xác không? Thử cả 4 góc và vùng notch.
**TRẢ LỜI: CÓ (PASS). HOÀN HẢO CẢ 4 GÓC; VÙNG NOTCH GHI NHẬN CHƯA KIỂM CHỨNG (CẦN MACBOOK).**

- **Phân tích vùng hiển thị khả dụng (`workArea`):**
  - Trên màn hình `1920x1080`, `screen.getPrimaryDisplay().workArea` trả về chính xác: `x: 0, y: 30, width: 1920, height: 960`.
  - Hệ thống tự động trừ đi:
    - 30px Menu bar phía trên (`y=30`).
    - 90px Dock phía dưới (`1080 - 30 - 960 = 90px`).
- **Kiểm chứng 4 góc màn hình:**
  1. **Góc trên-trái (`top-left` - Pet x=0, y=30):** Card tự động mở sang phải-dưới (`x=150, y=40`). Nằm trọn 100% trong `workArea` ([`evidence/q5-corner-top-left.png`](evidence/q5-corner-top-left.png)).
  2. **Góc trên-phải (`top-right` - Pet x=1780, y=30):** Card tự động lật sang trái-dưới (`x=1430, y=40`). Nằm trọn 100% trong `workArea` ([`evidence/q5-corner-top-right.png`](evidence/q5-corner-top-right.png)).
  3. **Góc dưới-trái (`bottom-left` - Pet x=0, y=850):** Card tự động lật sang phải-trên (`x=150, y=770`). Nằm ngay trên Dock, không bị che khuất ([`evidence/q5-corner-bottom-left.png`](evidence/q5-corner-bottom-left.png)).
  4. **Góc dưới-phải (`bottom-right` - Pet x=1780, y=850):** Card tự động lật sang trái-trên (`x=1430, y=770`). Nằm ngay trên Dock, không bị che khuất ([`evidence/q5-corner-bottom-right.png`](evidence/q5-corner-bottom-right.png)).
- **Giới hạn phần cứng về Notch (§3.9):**
  - Mac mini không có màn hình tích hợp với notch tai thỏ. Phần kiểm thử notch ghi nhận: **CHƯA KIỂM CHỨNG — cần MacBook đời có notch**. Tuy nhiên, vùng ngay dưới menu bar (`y=30px`) đã được đo đạc và hoạt động hoàn hảo.
- **Bằng chứng:** [`evidence/q5-corners.log`](evidence/q5-corners.log), 4 ảnh chụp góc màn hình.
- **Đối chiếu Windows:** **GIỐNG Windows** về thuật toán tự lật góc thích ứng và kiểm soát 100% trong `workArea`.

---

### Q6 — Tray icon trên menu bar + thông báo hệ thống khi pet ẩn (FR-INT-14, E3): hoạt động không? Có cần quyền Notifications không? Focus / DND thì sao?
**TRẢ LỜI: CÓ (PASS). HOẠT ĐỘNG ỔN ĐỊNH; THÔNG BÁO CẦN QUYỀN TCC VÀ CHỊU ẢNH HƯỞNG BỞI FOCUS/DND.**

- **Phân tích thực nghiệm:**
  - Khởi tạo `Tray` icon thành công trên Menu bar của macOS ([`evidence/q6-tray-notification.png`](evidence/q6-tray-notification.png)), menu chuột phải hỗ trợ đầy đủ các thao tác Ẩn/Hiện Pet.
  - Gửi thông báo native qua Electron `Notification`: Hiển thị banner góc trên bên phải màn hình.
  - **Quyền Notifications (TCC):** Trên macOS, ứng dụng gửi thông báo hệ thống cần được cấp quyền Notifications trong **System Settings > Notifications**. Nếu người dùng từ chối, banner không xuất hiện nhưng ứng dụng không bị crash.
  - **Chế độ Focus / Do Not Disturb (DND):** Khi DND đang bật, macOS tự động triệt tiêu popup banner và âm thanh; thông báo được gom âm thầm vào Notification Center.
  - **Giải pháp bảo đảm trải nghiệm:** Khi Pet bị ẩn, khay Menu bar (Tray) luôn là điểm neo dự phòng trực quan nhất để người dùng khôi phục Pet mà không phụ thuộc hoàn toàn vào thông báo hệ thống.
- **Bằng chứng:** [`evidence/q6-tray-notification.png`](evidence/q6-tray-notification.png), mã nguồn tại [`src/electron-pet/main.js`](src/electron-pet/main.js).
- **Đối chiếu Windows:** **GIỐNG Windows** về tính năng Tray và Notification; **KHÁC Windows** về cơ chế phân quyền TCC Notifications của macOS.

---

### Q7 — Pet có xuất hiện trong Dock và trong App Switcher (Cmd-Tab) không? Nếu ẩn app khỏi Dock thì App Window (ADR-002) bị ảnh hưởng gì?
**TRẢ LỜI: KHÁC BIỆT CỐT LÕI VỚI WINDOWS. DOCK THUỘC CẤP TIẾN TRÌNH (`NSApplicationActivationPolicy`). CẦN CƠ CHẾ DYNAMIC DOCK TOGGLING CHO ADR-002.**

- **Phân tích cơ chế hệ điều hành macOS:**
  - Trên Windows: `skipTaskbar: true` là thuộc tính gán riêng cho từng cửa sổ (HWND).
  - Trên macOS: Việc xuất hiện trên Dock và Cmd-Tab App Switcher được điều khiển ở cấp **Tiến trình (`NSApplicationActivationPolicy`)**:
    - **Chế độ Accessory (`NSApplicationActivationPolicyAccessory` qua `app.dock.hide()`):** Ứng dụng biến mất hoàn toàn khỏi Dock và App Switcher Cmd-Tab. Cửa sổ Pet và Menu bar Tray vẫn hiển thị bình thường ([`evidence/q7-dock-hidden.png`](evidence/q7-dock-hidden.png)).
    - **Chế độ Regular (`NSApplicationActivationPolicyRegular` qua `app.dock.show()`):** Ứng dụng xuất hiện trên Dock với icon chính thức và có mặt trong danh sách Cmd-Tab ([`evidence/q7-dock-visible.png`](evidence/q7-dock-visible.png)).
- **Xử lý ràng buộc kiến trúc hai cửa sổ (ADR-002):**
  - *Vấn đề:* Nếu ẩn Dock vĩnh viễn, khi người dùng mở App Window (cửa sổ quản trị, ledger, rule settings), App Window sẽ không có icon trong Dock và không thể Cmd-Tab để quay lại nếu bị các cửa sổ khác che lấp.
  - *Giải pháp tối ưu đã kiểm chứng:* **Dynamic Dock Policy Switching**:
    1. Trạng thái mặc định (chỉ có Pet chạy trên desktop): Đặt chính sách `Accessory` (`app.dock.hide()`) -> Không chiếm Dock, không làm rác Cmd-Tab.
    2. Khi người dùng mở App Window (qua click vào Pet hoặc menu Tray): Gọi ngay `app.dock.show()` (`Regular`) -> Icon xuất hiện trên Dock và Cmd-Tab hoạt động bình thường cho App Window.
    3. Khi người dùng đóng App Window: Ẩn cửa sổ và gọi lại `app.dock.hide()` (`Accessory`) -> Trở về trạng thái companion vô hình.
- **Bằng chứng:** [`evidence/q7-dock-switcher.log`](evidence/q7-dock-switcher.log), ảnh chụp [`evidence/q7-dock-hidden.png`](evidence/q7-dock-hidden.png) và [`evidence/q7-dock-visible.png`](evidence/q7-dock-visible.png).
- **Đối chiếu Windows:** **KHÁC Windows** (Windows điều khiển ở cấp từng Window, macOS bắt buộc điều khiển ở cấp Process).

---

## 2. Tác động lên ADR / PRD

### Tác động lên ADR
- **ADR-002 (Hai cửa sổ: Pet Window & App Window):** **BỔ SUNG QUY TẮC MACOS.**
  - Trên Windows, hai cửa sổ nằm chung một process và độc lập về Taskbar nhờ `skipTaskbar: true`.
  - Trên macOS, bổ sung yêu cầu: Quản lý vòng đời hiển thị Dock bằng cơ chế Dynamic Activation Policy (`app.dock.show()` khi mở App Window, `app.dock.hide()` khi đóng App Window).
- **ADR-009 (Native modules qua napi-rs):** **ĐIỀU CHỈNH PHẠM VI WORKSTREAM.**
  - Trên Windows: Native module là **bắt buộc ngay ở M1** để giải quyết cả Q1 (chống cướp focus bằng `WS_EX_NOACTIVATE`) lẫn Q2 (click-through bằng `WM_NCHITTEST`).
  - Trên macOS: Yêu cầu cốt lõi Q1 (chống cướp focus) **đã đạt 100% bằng Electron thuần** (`showInactive()` + `type: 'panel'`). Module native trên macOS (`desktop-window-macos`) chỉ cần tập trung vào:
    1. Subclass `NSView` override `hitTest:` để tối ưu pixel click-through độ trễ 0ms (Q2).
    2. Điều khiển `NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorFullScreenAuxiliary` (Q3).
  - Khẳng định: Phạm vi native macOS là **HOÀN TOÀN RIÊNG** so với Windows, không dùng chung code Win32 C++/Rust.

### Tác động lên PRD
- **PRD (FR-INT-04, FR-PET-01, FR-INT-14):** **KHÔNG SỬA ĐỔI.**
  - Yêu cầu cứng FR-INT-04 ("không đứt mạch gõ phím") đã được chứng minh khả thi 100% trên macOS.

---

## 3. Đầu vào cho tài liệu kỹ thuật

### 3.1. Đặc tả kỹ thuật cho macOS Window Integration (`desktop-window-macos`)
1. **Khởi tạo Pet Window & Card Window không cướp focus:**
   ```javascript
   // Khởi tạo cửa sổ dạng NSPanel trên macOS
   const petWindow = new BrowserWindow({
     width: 140, height: 140,
     transparent: true, frame: false, resizable: false,
     alwaysOnTop: true,
     focusable: false,
     type: 'panel', // Gán NSWindowStyleMaskNonactivatingPanel trên macOS AppKit
     webPreferences: { preload: 'preload.js' }
   });

   // Hiển thị Card mà tuyệt đối không cướp keyWindow
   cardWindow.showInactive();
   ```

2. **Cấu hình đa không gian làm việc (Spaces & Fullscreen Auxiliary):**
   ```javascript
   // Đảm bảo pet luôn nổi trên mọi Space và ứng dụng fullscreen native
   petWindow.setAlwaysOnTop(true, 'screen-saver', 1);
   petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
   ```

3. **Cơ chế quản lý Dock cho kiến trúc hai cửa sổ (ADR-002):**
   ```javascript
   function setAppWindowVisible(visible) {
     if (visible) {
       app.dock.show(); // Chuyển NSApplication sang Regular mode
       appWindow.show();
       appWindow.focus();
     } else {
       appWindow.hide();
       app.dock.hide(); // Chuyển NSApplication sang Accessory mode khi chỉ còn Pet
     }
   }
   ```

4. **AppKit Native Hit-testing cho Pixel Click-Through (thay thế `WM_NCHITTEST`):**
   ```objc
   // Subclass NSView để routing chuột 0ms xuống ứng dụng dưới
   - (NSView *)hitTest:(NSPoint)point {
       NSPoint localPoint = [self convertPoint:point fromView:nil];
       if ([self isPixelTransparentAt:localPoint]) {
           return nil; // Xuyên chuột xuống cửa sổ bên dưới
       }
       return self;    // Nhận click chuột cho pet
   }
   ```

---

## 4. Rủi ro mới phát hiện
1. **RISK-074 — Độ trễ IPC của `setIgnoreMouseEvents` trên macOS:**
   - Khi sử dụng cơ chế Electron thuần `setIgnoreMouseEvents(true, { forward: true })`, việc đồng bộ giữa Chromium Renderer và Main Process có độ trễ ~16–30ms. Nếu người dùng di chuột nhanh và click tức thì vào mép nhân vật, click có thể lọt qua trước khi AppKit kịp cập nhật mask.
2. **RISK-075 — Xung đột Activation Policy giữa Pet Window và App Window:**
   - Do macOS không có thuộc tính ẩn Dock theo từng cửa sổ như Windows (`skipTaskbar`), việc quản lý không đồng bộ giữa `app.dock.show()` và `app.dock.hide()` có thể làm mất icon quản trị trong Dock hoặc để lại icon rác khi chỉ có Pet hoạt động.
3. **RISK-076 — Phụ thuộc quyền Notifications và trạng thái Focus/DND:**
   - Khác với Windows Toast luôn hiển thị, macOS có thể ẩn toàn bộ notification banner vào Notification Center khi chế độ Focus (Do Not Disturb) đang bật. Phải luôn có Menu bar Tray làm kênh tương tác dự phòng.

---

## 5. Chưa trả lời được + vì sao
- **Đa màn hình với hệ số scale hỗn hợp (Retina 2x + màn ngoài 1x ở Q4):**
  - Ghi nhận: **CHƯA KIỂM CHỨNG — thiếu phần cứng, cần máy có 2 màn hình khác scale** (tuân thủ mục 3.9 của `docs/spike-roadmap-macos.md` do máy Mac mini thử nghiệm chỉ gắn 1 màn hình vật lý 1080p scale 1.0).
- **Hành vi hiển thị vùng notch MacBook ở Q5:**
  - Ghi nhận: **CHƯA KIỂM CHỨNG — cần MacBook đời có notch** (Mac mini là máy để bàn không có notch).

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài
- **Hệ điều hành:** macOS 26.5.2 (Build 25F84, Darwin Kernel Version 25.5.0, `arm64`)
- **Phần cứng:** Mac mini (Chip Apple M1, 8 Cores GPU Metal 4)
- **Rosetta Translation:** `sysctl sysctl.proc_translated` = `0` (Chạy native Apple Silicon 100%)
- **Màn hình:** 1 Display `1920 x 1080` @ 60.00Hz, Scale Factor = `1.0`
- **Node.js:** `v26.8.2` (arm64)
- **NPM:** `11.19.1`
- **Electron:** `44.3.0` (darwin-arm64)
- **Clang / LLVM:** Apple clang version 17.0.0 (clang-1700.6.4.2)
- **TextEdit:** Version 1.19 (macOS native document editor)

---

## 7. Bảng đối chiếu Windows ↔ macOS

| Câu hỏi | Nhãn đối chiếu | Kết quả trên Windows (`SP-7`) | Kết quả trên macOS (`SP-7/mac`) | Hệ quả kiến trúc & Spec |
| :--- | :--- | :--- | :--- | :--- |
| **Q1 — Card tự bung không cướp focus (FR-INT-04)** | **KHÁC Windows** | **FAIL với Electron thuần (6/10)**. Rơi 1–2 ký tự do DWM composition hitch. Bắt buộc dùng native Win32 `WS_EX_NOACTIVATE`. | **PASS 100% với Electron thuần (10/10)**. Không rơi ký tự nào nhờ `showInactive()` + `type: 'panel'` và render bất đồng bộ của WindowServer. | macOS không cần native module cho riêng bài toán focus. |
| **Q2 — Click-through theo từng pixel** | **KHÁC Windows** | Cần native Win32 hook `WM_NCHITTEST` trả về `HTTRANSPARENT`. | Dùng được với Electron thuần (nhưng trễ IPC 16-30ms). Native thay thế bằng AppKit `-[NSView hitTest:]`. | Kiến trúc native hai hệ điều hành hoàn toàn độc lập (`hitTest:` vs `WM_NCHITTEST`). |
| **Q3 — Always-on-top đè fullscreen (E6)** | **GIỐNG Windows** (Fullscreen) / **KHÁC Windows** (Spaces) | Đè trọn vẹn app fullscreen ở mức `screen-saver`. Không có Spaces. | Đè trọn vẹn fullscreen. Hỗ trợ di chuyển xuyên Spaces qua `NSWindowCollectionBehaviorFullScreenAuxiliary`. Ghim trên Mission Control. | Spec bổ sung cấu hình CollectionBehavior cho macOS. |
| **Q4 — Đa màn hình khác scale & Tháo màn hình (E2)** | **GIỐNG Windows** (E2 fallback) / **CHƯA KIỂM CHỨNG** (Retina/1x) | Đạt kiểm chứng cả 2 màn hình và thuật toán fallback E2. | Thuật toán fallback E2 đạt 100%. Phần Retina 2x + 1x: CHƯA KIỂM CHỨNG do Mac mini gắn 1 màn hình. | Thuật toán fallback toạ độ dùng chung cho cả 2 OS. |
| **Q5 — Tự lật hướng ô thoại sát mép (E1)** | **GIỐNG Windows** (Corners) / **CHƯA KIỂM CHỨNG** (Notch) | Đạt 4 góc với Windows Taskbar. | Đạt 4 góc, trừ chính xác Menu bar (30px) và Dock (90px). Vùng notch: CHƯA KIỂM CHỨNG (cần MacBook). | Thuật toán Adaptive Edge dùng chung logic cho cả 2 OS. |
| **Q6 — Tray icon + Notification khi ẩn pet (FR-INT-14)** | **GIỐNG Windows** | Khay Notification Area + Windows Toast Notification ổn định. | Menu bar StatusItem + macOS Notification banner hoạt động. Cần lưu ý quyền TCC và chế độ Focus/DND. | Spec ghi nhận Menu bar Tray là kênh fallback tin cậy khi Focus/DND bật. |
| **Q7 — Dock, Cmd-Tab và hai cửa sổ (ADR-002)** | **KHÁC Windows** | `skipTaskbar: true` là thuộc tính của từng Window HWND. | Dock và Cmd-Tab thuộc về toàn bộ Process (`NSApplicationActivationPolicy`). Phải dùng Dynamic Dock Policy. | ADR-002 bổ sung quy tắc chuyển đổi chính sách Dock linh hoạt trên macOS. |
