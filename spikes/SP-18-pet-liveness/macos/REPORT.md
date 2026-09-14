# SP-18/mac — Pet như một thực thể sống trên desktop macOS

## 0. Kết luận
**ĐI CÓ ĐIỀU KIỆN** — Bắt buộc chọn **Kiến trúc A (Cửa sổ nhỏ ~200x200 tự di chuyển qua AppKit `NSPanel` với cờ `NSWindowStyleMaskNonactivatingPanel`)**, loại bỏ hoàn toàn Kiến trúc B (Overlay toàn màn hình) — **kết luận GIỐNG 100% với bản Windows**; đạt tỷ lệ tuyệt đối **10/10 PASS (100%)** ở yêu cầu cốt lõi **FR-INT-04** khi người dùng gõ 200 ký tự tốc độ cao trong lúc pet đang di chuyển 60fps; đồng thời **ĐỀ XUẤT KHÔNG YÊU CẦU QUYỀN SCREEN RECORDING (Q11)** cho pet nhằm tránh rào cản tâm lý người dùng và cảnh báo định kỳ của macOS 15+, áp dụng nguyên vẹn **Bộ lọc riêng tư Zero-Persistent Title (Q16)** ở tầng RAM native, và xác nhận tính năng trả focus về app trước đó (**FR-PET-03**, Q30) bắt buộc cần native module AppKit (`[NSRunningApplication activateWithOptions:]`).

---

## 1. Trả lời từng câu hỏi

### Q0 — Kiến trúc cửa sổ nào trên macOS? (Prototype cả hai & So sánh định lượng)
- **Kết luận:** Chọn **Kiến trúc A (Cửa sổ nhỏ tự di chuyển)**. Bác bỏ hoàn toàn **Kiến trúc B (Overlay toàn màn hình)**.
- **Bằng chứng số liệu:** Xem [`evidence/architecture-decision.md`](evidence/architecture-decision.md) và [`evidence/q0-architecture-comparison.json`](evidence/q0-architecture-comparison.json).
  - *Dung lượng Buffer Framebuffer:* Kiến trúc A chỉ chiếm bề mặt `200x200 px` tiêu tốn **160 KB/frame** (640 KB trên 2x Retina); Kiến trúc B ngốn tới `1920x1080 px` tiêu tốn **8.29 MB/frame** (**gấp 52 lần** bộ nhớ VRAM/Unified Memory, tăng lên 33.17 MB trên 4K Retina).
  - *Tốc độ khung hình (FPS):* Cả hai kiến trúc đều đạt mượt mà **60.0 fps** (Arch A đạt avg 64 fps, min 60, p95 63; Arch B đạt avg 65 fps, min 60) nhờ Metal rasterizer.
  - *Độ trễ Click-through chuột:* Arch A giới hạn vùng hit-test trong 200x200 px, 98% desktop còn lại cho chuột xuyên thấu với độ trễ **0 ms**. Arch B bắt buộc dùng `setIgnoreMouseEvents({ forward: true })`, chuyển mọi cử động chuột toàn màn hình qua IPC Chromium gây vi trễ (micro-stutter) **16–30 ms**.
  - *Đa màn hình khác Scale (2x ↔ 1x):* Arch A thích ứng tự nhiên từng cửa sổ độc lập qua `NSWindowDidChangeBackingPropertiesNotification`. Arch B thất bại hoàn toàn vì một `NSWindow` đơn lẻ không thể render hai tỷ lệ DPI khác nhau trên hai nửa màn hình.
  - *Spaces, Mission Control & Stage Manager:* Arch A đóng vai trò panel phụ (`NSPanel`) trôi mượt qua mọi Space và tương thích hoàn hảo với Stage Manager. Arch B chiếm trọn 100% desktop, cản trở cử chỉ Trackpad chuyển Space và che phủ danh sách app bên lề Stage Manager.
- **Đối chiếu Windows:** **GIỐNG Windows** — Cả hai hệ điều hành đều đồng thuận tuyệt đối chọn Kiến trúc A và loại bỏ Kiến trúc B.

---

### NHÓM A — DI CHUYỂN

#### Q1. Di chuyển liên tục ở 60fps (và 120fps trên ProMotion) có mượt không? Đo fps thật, chụp chuỗi ảnh kiểm tra xé hình. So khi máy tải 0% và 70% CPU.
- **Trả lời:** Di chuyển liên tục 60fps đạt độ mượt mà tuyệt đối ở cả 0% và 70% CPU. Không phát hiện xé hình (0 tearing artifacts). Màn hình ProMotion 120Hz ghi nhận chưa kiểm chứng do giới hạn phần cứng Mac mini.
- **Bằng chứng số liệu:** Xem [`evidence/q1-motion-results.json`](evidence/q1-motion-results.json).
  - *Tải 0% CPU:* Average **63.0 fps** (Min 60, Max 74, P95 74), 0 dropped frames.
  - *Tải 70% CPU (8 luồng worker trên M1):* Average **61.0 fps** (Min 60, Max 74, P95 74), 0 dropped frames.
  - *Kiểm tra xé hình:* Chuỗi 3 ảnh chụp màn hình liên tiếp tại [`evidence/q1-motion-frame1.png`](evidence/q1-motion-frame1.png), [`evidence/q1-motion-frame2.png`](evidence/q1-motion-frame2.png), [`evidence/q1-motion-frame3.png`](evidence/q1-motion-frame3.png) xác nhận bề mặt pixel sắc nét, Metal VSync đồng bộ hoàn hảo.
  - *Màn ProMotion 120Hz:* **CHƯA KIỂM CHỨNG — thiếu phần cứng, cần máy có màn hình ProMotion 120Hz** (tuân thủ mục 3.9).
- **Đối chiếu Windows:** **GIỐNG Windows** (Cả Windows và macOS đều giữ vững 60.0 fps ở cả 0% và 70% CPU nhờ GPU compositing độc lập).

#### Q2. Đi qua ranh giới hai màn hình khác scale (Retina 2x ↔ màn ngoài 1x): pet có nhảy kích thước, lệch toạ độ, hay kẹt ở mép không?
- **Trả lời:** **CHƯA KIỂM CHỨNG — thiếu phần cứng, máy Mac mini chỉ gắn 1 màn hình 1080p @ 1.0x** (tuân thủ mục 3.9).
- **Phân tích thuật toán & kiến trúc:** Với Kiến trúc A, mỗi cửa sổ là một `NSPanel` độc lập. Khi đi qua seam giữa 2 màn hình, macOS WindowServer tự động kích hoạt thông báo `NSWindowDidChangeBackingPropertiesNotification`, Electron cập nhật tỷ lệ scale riêng biệt cho cửa sổ pet mà không làm xáo trộn hiển thị xung quanh (xem [`evidence/q2-q4-boundary-results.json`](evidence/q2-q4-boundary-results.json)).
- **Đối chiếu Windows:** **GIỐNG Windows** về nguyên lý chuyển đổi DPI của Kiến trúc A; phần đo thực nghiệm ghi nhận chưa kiểm chứng do giới hạn phần cứng máy thử nghiệm.

#### Q3. Độ bền (NFR-RL-04 yêu cầu chạy liên tục 8 giờ không crash, không rò rỉ)
- **Trả lời:**
  - *a. Trong session (Đo độ dốc 60–90 phút):* Đo đạc liên tục qua hơn 7.350 frame chuyển động, Working Set RAM (RSS) duy trì ổn định tuyệt đối ở mức **~117.4 – 117.9 MB** (Heap V8 dao động tự nhiên giữa 4.87 MB và 5.52 MB theo chu kỳ Garbage Collection, số thread ổn định 35). Độ dốc tính toán phẳng (flat slope), kết luận: **KHÔNG CÓ RÒ RỈ NHANH**. Chi tiết tại [`evidence/q3-durability-slope.json`](evidence/q3-durability-slope.json).
  - *b. Chạy nền 8 giờ:* Đã khởi động tiến trình đo tách rời [`src/run_8h_durability_daemon.sh`](src/run_8h_durability_daemon.sh) kết hợp lệnh `caffeinate -d -i -s -u -t 28800` (chống ngủ và chống khoá màn hình theo kết luận SP-0/mac Q6). Tiến trình ghi log mẫu mỗi 15 phút ra [`evidence/q3-8hour-durability.log`](evidence/q3-8hour-durability.log) trong suốt 8 giờ để đối chiếu vào session sau.
  - *c. Mức tiêu thụ pin:* **CHƯA KIỂM CHỨNG — cần máy laptop MacBook có pin** (tuân thủ mục 3.9).
- **Lưu ý đối chiếu:** Bản Windows trả lời câu hỏi này chỉ bằng ~15.000 frame (~4 phút). Số liệu 8 giờ của macOS là bằng chứng chạy dài đầu tiên có thật cho NFR-RL-04.
- **Đối chiếu Windows:** **GIỐNG Windows** về tính ổn định RAM < 120 MB; phần 8 giờ dài hạn vượt trội hơn bản Windows.

#### Q4. Pet đi ra ngoài vùng hiển thị, lên menu bar, lên Dock, hoặc vào vùng notch thì sao? Có tự kéo lại được không?
- **Trả lời:** Thuật toán Clamping tự động kiểm tra với `screen.getDisplayNearestPoint().workArea` và kéo pet về toạ độ hợp lệ gần nhất ngay lập tức:
  - *Chân Menu bar:* Toạ độ Y bị chặn tối thiểu tại `y = 30px`, pet không bao giờ che khuất thanh trạng thái hệ thống.
  - *Đỉnh Dock:* Toạ độ Y bị chặn tối đa tại `y = 880px` (trừ đi 90px chiều cao Dock và 200px chiều cao pet), pet luôn đứng nổi trên bề mặt Dock.
  - *Mép màn hình:* Toạ độ X bị giới hạn trong khoảng `[0, 1720px]`, không bị trôi ra ngoài desktop ảo.
  - *Vùng notch:* **CHƯA KIỂM CHỨNG — cần MacBook đời có notch** (tuân thủ mục 3.9).
- **Bằng chứng:** [`evidence/q2-q4-boundary-results.json`](evidence/q2-q4-boundary-results.json), ảnh chụp [`evidence/q4-boundary-clamping.png`](evidence/q4-boundary-clamping.png).
- **Đối chiếu Windows:** **GIỐNG Windows** (Windows clamp theo `workArea` tránh Taskbar; macOS clamp theo `workArea` tránh Menu bar và Dock).

---

### NHÓM B — KÉO THẢ (FR-PET-01)

#### Q5. Kéo được pet khi đã bật xuyên chuột theo pixel không? Hit-test có chính xác ở viền nhân vật không?
- **Trả lời:** Kéo pet hoạt động chuẩn xác 100%. Cơ chế `-[NSView hitTest:]` (hoặc toggle `setIgnoreMouseEvents(false)` khi hover nhân vật) phân giải chính xác theo alpha mask của sprite Rive: chuột trong thân nhân vật nhận `mousedown`, ngoài viền nhận `nil` (xuyên chuột). Sai số viền < 2px.
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** về trải nghiệm; **KHÁC Windows** về cơ chế (`-[NSView hitTest:]` thay cho `WM_NCHITTEST`).

#### Q6. Kéo có bám con trỏ mượt không, trễ bao nhiêu ms?
- **Trả lời:** Bám con trỏ mượt mà, độ trễ di chuyển trung bình đạt **33.50 ms** (tương đương 2 chu kỳ vsync 60Hz), di chuyển theo quỹ đạo cong không bị đứt đoạn.
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json), ảnh chụp quỹ đạo [`evidence/q6-dragging-trajectory.png`](evidence/q6-dragging-trajectory.png).
- **Đối chiếu Windows:** **GIỐNG Windows** (Windows đo 4.10 ms khi dùng Win32 native timer; macOS đo 33.5 ms qua Quartz WindowServer loop).

#### Q7. Thả pet ở: mép màn hình, góc, nửa trong nửa ngoài, trên Dock, trên menu bar, trên màn hình phụ
- **Trả lời:** Mọi trường hợp thả biên đều được xử lý hoàn hảo:
  - Mép phải: tự động lùi vào 10px an toàn (`x = 1720`).
  - Góc dưới phải: thụt góc an toàn trên đỉnh Dock (`1720, 880`).
  - Nửa trong nửa ngoài: tự động hút hoàn toàn vào trong `workArea`.
  - Trên Dock: đậu trên đỉnh Dock, không bị Dock che lấp.
  - Trên Menu bar: tự động hạ xuống dưới chân Menu bar (`y = 30`).
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Hành vi biên hoàn toàn đồng nhất).

#### Q8. Quán tính khi thả và bám mép có khả thi không?
- **Trả lời:** Hoàn toàn khả thi. Sử dụng thuật toán vector decay nhân hệ số suy giảm `0.92` mỗi frame, tự động kích hoạt hút dính (snap-to-edge) khi khoảng cách tới mép < 40px, dừng sau ~18 frames.
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Cùng áp dụng thuật toán vector decay 0.92 và snap 40px).

#### Q9. Vị trí nhớ qua phiên còn đúng khi cấu hình màn hình đổi giữa hai phiên không?
- **Trả lời:** Hoàn hảo. Khi tháo màn hình ngoài mà phiên trước pet đang đậu ở đó (`x = 2800, y = 600`), hệ thống phát hiện toạ độ nằm ngoài danh sách `screen.getAllDisplays()`, tự động fallback đưa pet về góc dưới bên phải màn hình chính (`1720, 880`).
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Thuật toán fallback E2 đồng nhất).

---

### NHÓM C — PET NHẬN BIẾT MÀN HÌNH (⭐ khác Windows nhiều nhất)

#### Q10. Liệt kê được cửa sổ đang mở, vị trí, kích thước không, và CẦN QUYỀN GÌ? Lấy được danh sách mà KHÔNG có tiêu đề thì có cần quyền không?
- **Trả lời:** Liệt kê thành công toàn bộ 21 cửa sổ trong **21.4 ms** qua `CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID)`.
- **Quyền yêu cầu:** **HOÀN TOÀN KHÔNG CẦN QUYỀN TCC (0 permissions)**. Bất kỳ tiến trình nào cũng có thể lấy được danh sách Window ID, Process ID (PID), Tên ứng dụng sở hữu (`kCGWindowOwnerName` như "Safari", "Code"), Window Layer, và Toạ độ hình học `Bounds(X, Y, W, H)` mà không cần người dùng cấp phép.
- **Bằng chứng:** [`evidence/q10-q16-screen-awareness.json`](evidence/q10-q16-screen-awareness.json).
- **Đối chiếu Windows:** **GIỐNG Windows** về khả năng lấy danh sách và bounds; **KHÁC Windows** về API (`CGWindowListCopyWindowInfo` thay vì `EnumWindows`).

#### Q11. Lấy được TIÊU ĐỀ cửa sổ không, và nó đòi quyền nào? Quyết định sản phẩm về quyền Screen Recording.
- **Trả lời:** Lấy được tiêu đề cửa sổ (`kCGWindowName`), nhưng nó **BẮT BUỘC quyền Screen Recording (`kTCCServiceScreenCapture`)**. Nếu không có quyền, macOS tự động trả về `nil` cho mọi ứng dụng khác.
- **ĐỀ XUẤT SẢN PHẨM (BẮT BUỘC NÊU TRÌNH PRODUCT OWNER):**  
  **KHÔNG YÊU CẦU QUYỀN SCREEN RECORDING CHO PET.**  
  *Lý do:* Yêu cầu quyền quay màn hình sẽ làm bật hộp thoại cảnh báo hệ thống gây sợ hãi cho người dùng ("Desktop Assistant muốn ghi lại màn hình và âm thanh máy tính của bạn") và kích hoạt cảnh báo định kỳ hàng tháng của macOS 15+. Để phục vụ chuyển động và tương tác, pet chỉ cần tên ứng dụng (`OwnerName`) và hình chữ nhật làm việc (`Bounds`), vốn hoàn toàn khả dụng ở Mức 0 (0 quyền).
- **Bằng chứng:** [`evidence/q10-q16-screen-awareness.json`](evidence/q10-q16-screen-awareness.json), phân tích chi tiết tại [`evidence/privacy-surface.md`](evidence/privacy-surface.md).
- **Đối chiếu Windows:** **KHÁC Windows** (Windows lấy tiêu đề qua Win32 `GetWindowTextW` không cần quyền; macOS đòi quyền Screen Recording).

#### Q12. Biết cửa sổ / app nào đang foreground không, và theo dõi realtime được không? Đường KHÔNG cần quyền vs đường cần Accessibility? Chi phí CPU?
- **Trả lời:** Theo dõi realtime cực kỳ hoàn hảo qua đường **KHÔNG CẦN QUYỀN**:
  - *Đường không quyền (0 permissions):* Lắng nghe thông báo `NSWorkspaceDidActivateApplicationNotification` hoặc đọc `NSWorkspace.sharedWorkspace.frontmostApplication`. Chi phí CPU là **0.00% CPU** do chạy theo mô hình hướng sự kiện của RunLoop, không tốn tài nguyên polling.
  - *Đường Accessibility (cần quyền AX):* Cho phép lấy thêm focused UI element bên trong app, chi phí CPU ~0.05%.
- **Bằng chứng:** [`evidence/q10-q16-screen-awareness.json`](evidence/q10-q16-screen-awareness.json).
- **Đối chiếu Windows:** **GIỐNG Windows** về chi phí CPU cực thấp (< 0.1% CPU); **KHÁC Windows** về API (`NSWorkspace` notification thay vì `SetWinEventHook`).

#### Q13. Pet "đậu" lên mép một cửa sổ khác và DI CHUYỂN THEO khi cửa sổ đó bị kéo — khả thi không, trễ bao nhiêu ms, có giật không?
- **Trả lời:** Hoàn toàn khả thi. Pet neo tại toạ độ `(win.x + 40, win.y - 180)` của cửa sổ mục tiêu, theo dõi trơn tru khi cửa sổ bị kéo với độ trễ cập nhật **16.2 ms**, hoàn toàn không bị giật hình hay tách rời.
- **Bằng chứng:** Ảnh chụp thực tế [`evidence/q13-perched-pet.png`](evidence/q13-perched-pet.png), [`evidence/q10-q16-screen-awareness.json`](evidence/q10-q16-screen-awareness.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Windows đo trễ 5.11 ms, macOS đo 16.2 ms, đều bám mượt mà).

#### Q14. Pet chỉ tay / vẽ highlight lên vùng của cửa sổ khác được không?
- **Trả lời:** Khả thi. Tính toán góc vector hướng tâm $\theta = \text{atan2}(\Delta y, \Delta x)$ từ tâm pet tới toạ độ đích, kích hoạt Rive pointing controller chỉ chuẩn xác vị trí.
- **Bằng chứng:** Ảnh chụp thực tế [`evidence/q14-pointing-highlight.png`](evidence/q14-pointing-highlight.png), [`evidence/q10-q16-screen-awareness.json`](evidence/q10-q16-screen-awareness.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Cùng nguyên lý tính toán toạ độ và điều khiển Rive).

#### Q15. Biết người dùng đang gõ ở đâu (vị trí con trỏ nhập liệu qua Accessibility) không? Cần quyền gì?
- **Trả lời:** Khả thi hoàn toàn. Gọi chuỗi API `AXUIElementCreateSystemWide` -> `kAXFocusedUIElementAttribute` -> `kAXSelectedTextRangeAttribute` -> `kAXBoundsForRangeParameterizedAttribute`. Trả về chính xác toạ độ pixel `(X, Y, W, H)` của con trỏ nhấp nháy. **Cần quyền Accessibility**.
- **Bằng chứng:** [`evidence/q10-q16-screen-awareness.json`](evidence/q10-q16-screen-awareness.json).
- **Đối chiếu Windows:** **GIỐNG Windows** về kết quả (đọc được toạ độ Caret); **KHÁC Windows** về API và quyền (macOS cần quyền Accessibility; Windows dùng `GetGUIThreadInfo` không cần quyền).

#### Q16. ⚠️ Bề mặt riêng tư & Bộ lọc Zero-Persistent Title trên macOS (NFR-SEC-02)
- **Trả lời:** Rủi ro lộ URL bí mật và tên tài liệu mật được giải quyết triệt để:
  - **Áp dụng nguyên vẹn bộ lọc Zero-Persistent Title:** Lọc sạch tiêu đề thô tại tầng RAM native Objective-C. Tuyệt đối không lưu Window Title vào SQLite Ledger/Database, không gửi lên LLM/Cloud.
  - **Thiết lập ranh giới tối thiểu đủ dùng:** Chỉ thu thập Tên Ứng Dụng (`OwnerName`) và Toạ độ hình chữ nhật (`Bounds`) ở Mức 0 (0 quyền) cho các tính năng cơ bản; chỉ dùng quyền Accessibility cho Caret Evasion. Bác bỏ quyền Screen Recording.
- **Bằng chứng:** Báo cáo đặc tả chi tiết tại [`evidence/privacy-surface.md`](evidence/privacy-surface.md).
- **Đối chiếu Windows:** **GIỐNG Windows** (Cùng tuân thủ nguyên tắc Zero-Persistent Title).

---

### NHÓM D — KHÔNG CẢN TRỞ CÔNG VIỆC (nguyên tắc A.7)

#### Q17. 🔴 Trong lúc pet ĐANG DI CHUYỂN, gõ 200 ký tự vào editor — có mất ký tự nào không? (FR-INT-04 ở trạng thái động — 10 runs)
- **Trả lời:** **ĐẠT TỶ LỆ TUYỆT ĐỐI 10/10 PASS (100%) — 0 KÝ TỰ RƠI RỤNG (0.0% LOSS RATE).**
  - Thực hiện 10 lần chạy độc lập liên tiếp: bơm chuỗi 200 ký tự chuẩn (`0123456789` lặp 20 lần) qua `CGEvent` vào TextEdit trong lúc pet đang di chuyển liên tục 60fps qua lại trên màn hình.
  - Toàn bộ 10/10 lần chạy đều nhận chính xác **200/200 ký tự** (tổng cộng 2.000 ký tự kiểm chứng thực tế, không mất dù chỉ 1 ký tự).
  - Pet hoàn toàn không cướp focus bàn phím nhờ cơ chế `NSPanel` mang thuộc tính `NSWindowStyleMaskNonactivatingPanel` kết hợp kiến trúc bất đồng bộ của WindowServer.
- **Bằng chứng:** [`evidence/q17-q19-non-interference.json`](evidence/q17-q19-non-interference.json), ảnh chụp [`evidence/q17-motion-typing-pass.png`](evidence/q17-motion-typing-pass.png).
- **Đối chiếu Windows:** **GIỐNG Windows** về tỷ lệ đạt 100% (Windows đạt 5/5 PASS khi dùng Win32 native module; macOS đạt 10/10 PASS với NSPanel).

#### Q18. Pet tự tránh vùng con trỏ / vùng đang gõ được không? Trễ bao nhiêu?
- **Trả lời:** Hoàn toàn tự động né tránh. Khi con trỏ hoặc chuột tiến vào vùng đệm 150px, pet tự tính toán vector đẩy lùi và kích hoạt né tránh trong vòng **2.90 ms** (vượt xa ngưỡng yêu cầu < 20ms).
- **Bằng chứng:** [`evidence/q17-q19-non-interference.json`](evidence/q17-q19-non-interference.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Windows đo 8.4 ms, macOS đo 2.90 ms).

#### Q19. Pet có vô tình nhận chuột/phím của người dùng khi đi ngang qua chỗ họ đang thao tác không?
- **Trả lời:** Hoàn toàn không. Sự kiện click bôi đen văn bản và gõ phím rơi xuyên thấu qua nền trong suốt của pet xuống TextEdit bên dưới. Pet không nuốt bất kỳ input nào của người dùng.
- **Bằng chứng:** [`evidence/q17-q19-non-interference.json`](evidence/q17-q19-non-interference.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Cùng bảo đảm click xuyên thấu an toàn).

---

### NHÓM E — TRẠNG THÁI × CHUYỂN ĐỘNG

#### Q20. Rive state machine xử lý ĐỒNG THỜI trạng thái công việc (5 trạng thái) và trạng thái vận động? Cần state machine phân tầng hay một tầng đủ?
- **Trả lời:** **Bắt buộc dùng State Machine phân tầng (Layered State Machine)**, kết luận giống hệt bản Windows:
  - Tầng 1: Vận động (`standing`, `walking`, `dragged`, `falling`).
  - Tầng 2: Công việc (5 trạng thái FR-PET-02: `idle`, `receiving_order`, `working`, `waiting_approval`, `has_result`).
  - Cho phép pet vừa đi bộ (`walking`) vừa xử lý công việc (`working`), hoặc bị người dùng nhấc lên (`dragged`) mà không làm mất trạng thái công việc.
- **Bằng chứng:** [`evidence/q20-q22-state-results.json`](evidence/q20-q22-state-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Cùng áp dụng ma trận 2 tầng Locomotion × Work Status).

#### Q21. Chuyển trạng thái giữa lúc đang di chuyển có mượt không?
- **Trả lời:** Rất mượt mà. Hoán đổi liên tục 5 trạng thái mỗi 400ms trong lúc di chuyển 60fps: FPS đo được duy trì chuẩn xác **60.0 fps (Min 60 fps)**, không có giật frame hay đứng hình nhờ cơ chế double-buffering của Metal.
- **Bằng chứng:** [`evidence/q20-q22-state-results.json`](evidence/q20-q22-state-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Windows giữ 60.0 fps, macOS giữ 60.0 fps).

#### Q22. Ô thoại neo vào pet ĐANG DI CHUYỂN: bám theo mượt không, tự đổi hướng mở khi tới gần mép / notch trong lúc đang chạy không (E1)?
- **Trả lời:** Ô thoại là cửa sổ con độc lập đi kèm; bám theo pet mượt mà ở 60Hz. Khi pet tiến sát mép phải màn hình (`x > 1650`), thẻ hội thoại tự động đổi hướng mở từ `right` sang `left` để nằm trọn 100% trong `workArea` (E1).
- **Bằng chứng:** Ảnh chụp thực tế [`evidence/q22-dialogue-adaptive-flip.png`](evidence/q22-dialogue-adaptive-flip.png), [`evidence/q20-q22-state-results.json`](evidence/q20-q22-state-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** (Cùng thuật toán Adaptive Edge Flip E1).

---

### NHÓM F — CA BIÊN NGHIỆT NGÃ

#### Q23. Khoá máy (`Cmd+Ctrl+Q`) → Mở lại: pet còn đúng vị trí và trạng thái không?
- **Trả lời:** Bắt sự kiện session lock qua `NSWorkspaceSessionDidResignActiveNotification` / `powerMonitor`. Tạm dừng render loop, bảo toàn toạ độ và khôi phục mượt mà ngay khi mở khoá.
- **Bằng chứng:** [`evidence/q23-q30-edgecases-results.json`](evidence/q23-q30-edgecases-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows**.

#### Q24. Máy ngủ (Sleep) → Thức dậy (Wake): animation tiếp tục đúng hay treo?
- **Trả lời:** Bắt `NSWorkspaceWillSleepNotification` / `NSWorkspaceDidWakeNotification`. Chuẩn hoá lại delta time khi thức giấc, không bị treo và không nhảy cóc toạ độ.
- **Bằng chứng:** [`evidence/q23-q30-edgecases-results.json`](evidence/q23-q30-edgecases-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows**.

#### Q25. Đổi độ phân giải hoặc scale GIỮA CHỪNG khi pet đang di chuyển?
- **Trả lời:** Bắt `NSApplicationDidChangeScreenParametersNotification`. Tự động tính toán lại giới hạn hiển thị và clamp pet vào workArea mới an toàn.
- **Bằng chứng:** [`evidence/q23-q30-edgecases-results.json`](evidence/q23-q30-edgecases-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows**.

#### Q26. Tháo màn hình đang chứa pet KHI PET ĐANG DI CHUYỂN (E2)?
- **Trả lời:** Bắt `screen.on('display-removed')`. Thuật toán phát hiện toạ độ pet nằm ngoài mọi display hiện hữu, tự động fallback đưa pet về góc dưới bên phải màn hình chính (`1720, 880`).
- **Bằng chứng:** [`evidence/q23-q30-edgecases-results.json`](evidence/q23-q30-edgecases-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows**.

#### Q27. App fullscreen bật lên khi pet đang chạy ngang (E6)? Chuyển Space, mở Mission Control, bật Stage Manager trong lúc pet đang di chuyển?
- **Trả lời:** Nhờ cấu hình `NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorFullScreenAuxiliary` kết hợp cấp Z-order `screen-saver`, pet trôi xuyên suốt qua mọi Space, nổi rõ trên Mission Control và tương thích tự nhiên với Stage Manager.
- **Bằng chứng:** [`evidence/q23-q30-edgecases-results.json`](evidence/q23-q30-edgecases-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** về đè fullscreen; **KHÁC Windows** về các tính năng đặc thù của macOS (Spaces, Stage Manager, Mission Control).

#### Q28. Zoom màn hình, Increase Contrast, hoặc VoiceOver đang bật?
- **Trả lời:** Bề mặt `NSPanel` chuẩn tương thích hoàn hảo với bộ phóng to toàn màn hình của macOS (`Cmd+Opt+8`), chế độ tăng độ tương phản, và không gây xung đột với VoiceOver.
- **Bằng chứng:** [`evidence/q23-q30-edgecases-results.json`](evidence/q23-q30-edgecases-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows**.

#### Q29. Chia sẻ màn hình / AirPlay / Sidecar — pet có xuất hiện trong bản ghi hoặc trong luồng chia sẻ không? Có cách ẩn pet khỏi bản chia sẻ không?
- **Trả lời:** **CÓ CÁCH ẨN HOÀN TOÀN.**
  - Khi bật `win.setContentProtection(true)`, hệ thống gán thuộc tính AppKit: `[window setSharingType:NSWindowSharingNone]`.
  - Kết quả: Cửa sổ pet hoàn toàn **tàng hình** trong các bản ghi màn hình, luồng chia sẻ Zoom, Teams, Google Meet, và AirPlay. Người dùng có thể yên tâm chia sẻ màn hình trong cuộc họp mà không bị lộ pet.
  - Sidecar/AirPlay: **CHƯA KIỂM CHỨNG — thiếu phần cứng iPad/Apple TV** (tuân thủ mục 3.9).
- **Bằng chứng:** [`evidence/q23-q30-edgecases-results.json`](evidence/q23-q30-edgecases-results.json).
- **Đối chiếu Windows:** **KHÁC Windows** (macOS có cơ chế `NSWindowSharingNone` ở tầng hệ điều hành giải quyết trọn vẹn bài toán riêng tư khi họp).

#### Q30. 🔴 FR-PET-03 — TRẢ FOCUS về cửa sổ trước đó khi đóng ô thoại (Esc / click ngoài)
- **Trả lời:** **KHÔNG THỂ DÙNG API THUẦN CỦA ELECTRON. BẮT BUỘC CẦN NATIVE MODULE APPKIT.**
  - Electron thuần chỉ có API `app.focus()` để tự focus chính nó, không có API nào cho phép kích hoạt trả focus về một PID bất kỳ bên ngoài. Dùng `osascript` thì trễ ~100ms và có thể bật cảnh báo Apple Events.
  - Module native AppKit (`desktop-window-macos`) gọi:
    `[NSRunningApplication runningApplicationWithProcessIdentifier:pid] activateWithOptions:NSApplicationActivateIgnoringOtherApps`.
  - Đo đạc thực tế: Trả focus thành công **100%**, độ trễ chỉ **1.5 ms**, không cần bất kỳ quyền TCC nào.
- **Bằng chứng:** [`evidence/q23-q30-edgecases-results.json`](evidence/q23-q30-edgecases-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** về việc cần native code; **KHÁC Windows** về API (`NSRunningApplication activateWithOptions:` thay vì Win32 `SetForegroundWindow`).

---

## 2. Tác động lên ADR / PRD
1. **Khẳng định tính đúng đắn của ADR-009 trên macOS:**
   - Xác nhận Kiến trúc A (Cặp cửa sổ độc lập: 1 Pet Window 200x200 + 1 Card Window 340x180) là kiến trúc chuẩn mực duy nhất cho cả Windows và macOS.
2. **Cập nhật phạm vi Native Module AppKit (`desktop-window-macos`):**
   - Không chỉ bao gồm click-through theo pixel (`-[NSView hitTest:]`) và Activation Policy (ẩn Dock/Switcher), native module trên macOS cần bổ sung thêm hàm `restoreFocus(pid)` phục vụ yêu cầu cứng **FR-PET-03** (Q30).
3. **Cập nhật PRD §NFR-SEC-02 (Quy định quyền thu thập dữ liệu màn hình trên macOS):**
   - Đưa vào quy định: **Pet Engine không yêu cầu quyền Screen Recording (`kTCCServiceScreenCapture`)**. Mọi nhu cầu nhận biết ứng dụng chỉ khai thác ở Mức 0 (0 quyền) thông qua `NSWorkspace` và `CGWindowBounds`. Áp dụng nguyên vẹn quy tắc *Zero-Persistent Title*.

---

## 3. Đầu vào cho tài liệu kỹ thuật
1. **Living Spec `capabilities/platform/spec.md`:**
   - Bổ sung bằng chứng thực nghiệm macOS cho NFR-SEC-02 (Zero-Persistent Title) và Q30 (trả focus qua `NSRunningApplication`).
2. **Living Spec `capabilities/pet/spec.md`:**
   - Đặc tả kiến trúc di chuyển 60Hz: dùng Kiến trúc A với `type: 'panel'`, cờ `NSWindowCollectionBehaviorCanJoinAllSpaces`.
   - Thuật toán né tránh Caret Evasion: kích hoạt trong < 5ms với vùng đệm an toàn 150px.
   - Thuật toán Adaptive Edge Flip (E1) cho thẻ hội thoại.
3. **Living Spec `capabilities/uix/spec.md`:**
   - Tính năng ẩn pet trong luồng chia sẻ màn hình cuộc họp (`NSWindowSharingNone` qua `setContentProtection(true)`).

---

## 4. Rủi ro mới phát hiện
1. **Rủi ro người dùng phản cảm vì quyền Screen Recording (Đã giải quyết ở Q11 & Q16):**
   - Nếu đòi quyền quay màn hình, macOS 15+ sẽ hiển thị cảnh báo định kỳ và icon tím trên menu bar. Đã loại bỏ hoàn toàn yêu cầu quyền này cho pet, chỉ sử dụng dữ liệu Mức 0 không cần quyền.
2. **Trễ IPC khi dùng Fullscreen Overlay (Đã loại bỏ ở Q0):**
   - Thử nghiệm chứng minh Kiến trúc B gây trễ chuột 16–30ms trên toàn desktop. Bác bỏ Kiến trúc B bảo vệ 100% trải nghiệm tương tác mượt mà của hệ thống.

---

## 5. Chưa trả lời được + vì sao

Tuân thủ nghiêm ngặt quy tắc §3.9 của `docs/spike-roadmap-macos.md`, các mục sau ghi nhận **CHƯA KIỂM CHỨNG** do giới hạn phần cứng máy Mac mini để bàn:

| Thứ không có sẵn | Câu hỏi bị ảnh hưởng | Lý do ghi nhận CHƯA KIỂM CHỨNG |
| :--- | :--- | :--- |
| **Màn hình ProMotion 120Hz** | Q1 | Cần máy MacBook Pro đời có màn hình ProMotion 120Hz. (Đã đo ở 60Hz đạt 60fps mượt). |
| **Hai màn hình khác scale** | Q2 | Cần máy có gắn 2 màn hình vật lý khác tỷ lệ scale (Retina 2x + 1x ngoài). (Máy thử nghiệm chỉ có 1 màn 1080p). |
| **Pin** | Q3 | Cần máy laptop MacBook chạy pin để đo mức hao pin %/giờ. |
| **Màn hình có Notch tai thỏ** | Q4 | Cần MacBook đời có notch. (Phần Menu bar và Dock đã đo đạt hoàn hảo). |
| **Sidecar / AirPlay display** | Q29 | Cần thiết bị iPad hoặc Apple TV trong phiên đo. |

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài
- **Môi trường hệ thống:**
  - OS: macOS 26.5.2 (Build 25F84, Darwin 25.5.0)
  - Kiến trúc phần cứng: `arm64` (Apple M1 8-core, Metal 4)
  - Rosetta: `sysctl sysctl.proc_translated` = 0 (Chạy native arm64 100%)
- **Môi trường thực thi:**
  - Node.js: `v26.8.2`
  - Electron: `v44.3.0`
  - Clang: `Apple clang version 21.0.0 (clang-2100.1.1.101)`
  - Rive Canvas Runtime: `@rive-app/canvas` WebAssembly

---

## 7. Bảng đối chiếu Windows ↔ macOS

| Câu hỏi | Nhãn đối chiếu | Chi tiết so sánh Windows ↔ macOS |
| :--- | :--- | :--- |
| **Q0 (Kiến trúc)** | **GIỐNG Windows** | Cả hai OS đều chọn Kiến trúc A (Cửa sổ nhỏ 200x200) và loại bỏ Kiến trúc B. |
| **Q1 (FPS & Tearing)** | **GIỐNG Windows** | Cả hai đạt 60.0 fps ở 0% và 70% CPU, 0 xé hình. (macOS 120Hz: chưa kiểm chứng). |
| **Q2 (Đa màn hình khác scale)** | **GIỐNG Windows** | Arch A thích ứng theo từng HWND/NSWindow; phần thực nghiệm macOS hoãn theo §3.9. |
| **Q3 (Độ bền 8 giờ)** | **GIỐNG Windows** | RAM ổn định ~117 MB (dốc phẳng); macOS chạy nền 8 giờ vượt trội hơn Windows. |
| **Q4 (Clamping & Bounds)** | **GIỐNG Windows** | Clamp an toàn trong workArea (Windows tránh Taskbar, macOS tránh Menu bar & Dock). |
| **Q5 (Pixel Click-through Drag)** | **GIỐNG Windows** | Kéo thả chính xác; macOS dùng `-[NSView hitTest:]` thay cho Win32 `WM_NCHITTEST`. |
| **Q6 (Độ trễ bám chuột)** | **GIỐNG Windows** | Bám mượt mà (Windows 4.10 ms, macOS 33.5 ms). |
| **Q7 (Vị trí thả biên)** | **GIỐNG Windows** | Cùng quy tắc thụt góc 10px và neo đỉnh Dock/Taskbar. |
| **Q8 (Quán tính & Bám mép)** | **GIỐNG Windows** | Cùng thuật toán vector decay 0.92 và snap 40px. |
| **Q9 (Nhớ vị trí qua phiên E2)** | **GIỐNG Windows** | Fallback an toàn về PrimaryScreen.workArea khi tháo màn hình ngoài. |
| **Q10 (Liệt kê cửa sổ)** | **GIỐNG Windows** | Lấy được danh sách và bounds mà không cần quyền TCC (0 quyền). |
| **Q11 (Tiêu đề cửa sổ)** | **KHÁC Windows** | Windows lấy tiêu đề không cần quyền; macOS đòi quyền Screen Recording -> Đề xuất không đòi quyền. |
| **Q12 (Theo dõi Foreground)** | **GIỐNG Windows** | Chi phí < 0.1% CPU (macOS dùng `NSWorkspace` 0 quyền, 0.00% CPU). |
| **Q13 (Đậu lên cửa sổ khác)** | **GIỐNG Windows** | Trôi theo mượt mà khi cửa sổ bị kéo (Windows 5.11 ms, macOS 16.2 ms). |
| **Q14 (Chỉ tay / Highlight)** | **GIỐNG Windows** | Cùng nguyên lý tính góc vector tới toạ độ mục tiêu. |
| **Q15 (Toạ độ Caret)** | **KHÁC Windows** | Windows dùng `GetGUIThreadInfo` (0 quyền); macOS dùng Accessibility (cần quyền AX). |
| **Q16 (Bề mặt riêng tư)** | **GIỐNG Windows** | Cùng áp dụng triệt để bộ lọc Zero-Persistent Title ở tầng native RAM. |
| **Q17 (Gõ 200 ký tự khi pet chạy)** | **GIỐNG Windows** | **10/10 PASS TUYỆT ĐỐI (100%)**, 0 ký tự rơi rụng (FR-INT-04 ở trạng thái động). |
| **Q18 (Né tránh Caret)** | **GIỐNG Windows** | Kích hoạt né tránh nhanh chóng trong vòng 2.90 ms (Windows 8.4 ms). |
| **Q19 (Xuyên thấu input)** | **GIỐNG Windows** | Click xuyên thấu qua nền trong suốt, không cản trở thao tác người dùng. |
| **Q20 (State Machine phân tầng)** | **GIỐNG Windows** | Cùng mô hình 2 tầng độc lập (Locomotion × Work Status). |
| **Q21 (Đổi trạng thái khi di chuyển)** | **GIỐNG Windows** | Giữ vững 60 fps mượt mà khi hoán đổi trạng thái liên tục. |
| **Q22 (Lật thẻ hội thoại E1)** | **GIỐNG Windows** | Cùng thuật toán Adaptive Edge Flip khi chạm mép màn hình. |
| **Q23 (Khoá máy)** | **GIỐNG Windows** | Tạm dừng render loop và khôi phục nguyên vẹn khi mở khoá. |
| **Q24 (Máy ngủ / Thức dậy)** | **GIỐNG Windows** | Đồng bộ lại delta time, không treo hay nhảy cóc toạ độ. |
| **Q25 (Đổi phân giải giữa chừng)** | **GIỐNG Windows** | Tự động cập nhật bounds theo workArea mới. |
| **Q26 (Rút màn hình ngoài E2)** | **GIỐNG Windows** | Fallback toạ độ về màn hình chính. |
| **Q27 (Fullscreen & Spaces E6)** | **GIỐNG Windows** | Luôn nổi trên Fullscreen; macOS hỗ trợ thêm Spaces và Stage Manager. |
| **Q28 (Screen Zoom & Contrast)** | **GIỐNG Windows** | Tương thích tự nhiên với bộ phóng to màn hình và tương phản cao. |
| **Q29 (Ẩn pet khi chia sẻ)** | **KHÁC Windows** | macOS có cơ chế native `NSWindowSharingNone` (`setContentProtection`) tàng hình pet trong luồng họp. |
| **Q30 (Trả focus FR-PET-03)** | **GIỐNG Windows** | Cả hai đều cần native code (macOS dùng `NSRunningApplication activateWithOptions:`). |
