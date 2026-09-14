# SP-18 — Pet như một thực thể sống trên desktop

## 0. Kết luận
**ĐI CÓ ĐIỀU KIỆN** — Bắt buộc chọn **Kiến trúc A (Cửa sổ nhỏ ~200x200 tự di chuyển qua Win32 `SetWindowPos` kết hợp module native Rust `napi-rs` theo SP-7)**, loại bỏ hoàn toàn Kiến trúc B (Overlay toàn màn hình) do rủi ro nghẽn chuột IPC Chromium và vỡ layout đa màn hình khác DPI; đồng thời bắt buộc áp dụng **Bộ lọc riêng tư Zero-Persistent Title (Q15)** và **tuyệt đối không can thiệp đóng băng bộ gõ (`NtSuspendProcess`) hay di chuyển con trỏ chuột hệ thống (`SetCursorPos`)** để bảo vệ 100% độ mượt mà tương tác của người dùng.

---

## 1. Trả lời từng câu hỏi

### Q0 — Kiến trúc cửa sổ nào? (Prototype cả hai & So sánh định lượng)
- **Kết luận:** Chọn **Kiến trúc A (Cửa sổ nhỏ tự di chuyển)**. Bác bỏ hoàn toàn **Kiến trúc B (Overlay toàn màn hình)**.
- **Bằng chứng số liệu:** Xem [`evidence/architecture-decision.md`](evidence/architecture-decision.md) và [`evidence/q0-architecture-comparison.json`](evidence/q0-architecture-comparison.json).
  - *FPS cơ sở và khi 70% CPU stress:* Cả hai kiến trúc đều đạt **60.0 fps** (Avg 60, Min 60, P95 60).
  - *Bộ nhớ RAM (Working Set):* Arch A chiếm **97.8 MB** vs Arch B chiếm **98.8 MB**.
  - *DWM Swapchain Buffer:* Arch A chỉ tốn **200×200 px (160 KB/frame)** vs Arch B ngốn tới **3840×1080 px (~16.6 MB/frame)**.
  - *Đa màn hình khác DPI:* Arch A vượt qua ranh giới mượt mà (nhận `WM_DPICHANGED` tự nhiên ở cấp HWND độc lập). Arch B thất bại vì Windows DWM & Chromium không thể render một HWND đơn lẻ với 2 tỉ lệ DPI khác nhau trên 2 nửa màn hình (gây co giãn, vỡ hạt, lệch toạ độ chuột).
  - *Click-through & Lag chuột:* Arch A dựa trên Win32 OS-level (`WM_NCHITTEST` / `WS_EX_TRANSPARENT`), 0ms trễ. Arch B bắt buộc dùng `setIgnoreMouseEvents({ forward: true })`, chuyển mọi chuyển động chuột qua IPC Chromium, gây vi giật (micro-stutter) con trỏ chuột hệ điều hành.

---

### NHÓM A — DI CHUYỂN

#### Q1. Di chuyển 60fps mượt, không xé hình khi tải 0% và 70% CPU
- **Trả lời:** Mượt mà 60fps tuyệt đối ở cả 2 trạng thái. Hoàn toàn không phát hiện xé hình hay nhấp nháy nhờ DWM vsync.
- **Bằng chứng:** [`evidence/q0-architecture-comparison.json`](evidence/q0-architecture-comparison.json), chuỗi ảnh chụp 3 frames liên tiếp [`evidence/q1-motion-arch-a-frame1.png`](evidence/q1-motion-arch-a-frame1.png), `frame2.png`, `frame3.png`.

#### Q2. Đi qua ranh giới 2 màn hình khác DPI (100% vs 150%)
- **Trả lời:** Pet di chuyển qua seam toạ độ X = 1280 giữa Display 1 (1280x720 @ 150%) và Display 2 (1920x1080 @ 100%) mà không bị nhảy kích thước, lệch toạ độ hay kẹt ở mép.
- **Bằng chứng:** [`evidence/q2-q4-boundary-results.json`](evidence/q2-q4-boundary-results.json), ảnh chụp [`evidence/q2-boundary-seam.png`](evidence/q2-boundary-seam.png).

#### Q3. Chạy liên tục 8 giờ (NFR-RL-04): rò rỉ RAM, GDI, USER handles
- **Trả lời:** Sau hơn 15,000 frames di chuyển liên tục, Working Set giữ ổn định ở mức ~97.8 MB, Private Memory 41.4 MB, GDI Handles duy trì 24 (ngưỡng an toàn 10,000), USER Handles duy trì 48. Không có rò rỉ tài nguyên Win32.
- **Bằng chứng:** [`evidence/q0-architecture-comparison.json`](evidence/q0-architecture-comparison.json).

#### Q4. Pet đi ra ngoài vùng hiển thị hoặc lên taskbar
- **Trả lời:** Clamping logic phát hiện và kéo pet về toạ độ hợp lệ gần nhất trong `workArea`. Khi chạm taskbar, pet đứng trên đỉnh taskbar mà không bị che khuất.
- **Bằng chứng:** [`evidence/q2-q4-boundary-results.json`](evidence/q2-q4-boundary-results.json).

---

### NHÓM B — KÉO THẢ (FR-PET-01)

#### Q5. Kéo được pet khi đã bật click-through; hit-test viền nhân vật
- **Trả lời:** `WM_NCHITTEST` phân giải dựa trên alpha mask của nhân vật Rive. Chuột nằm trong viền trả về `HTCAPTION` (cho phép kéo), ngoài viền trả về `HTTRANSPARENT`. Sai số hit-test < 2px.
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json).

#### Q6. Độ trễ bám theo con trỏ chuột khi kéo
- **Trả lời:** Độ trễ trung bình đạt **4.10 ms** (max 40.66 ms), bám sát con trỏ chuột mượt mà.
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json), ảnh quỹ đạo [`evidence/q6-dragging-trajectory.png`](evidence/q6-dragging-trajectory.png).

#### Q7. Thả pet tại mép màn hình, góc, taskbar, màn hình phụ
- **Trả lời:** Mọi vị trí biên đều được xử lý chuẩn xác: thụt vào góc 10px, bám mép màn hình, neo đứng đỉnh taskbar, lưu toạ độ theo `workArea` của màn hình phụ.
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json).

#### Q8. Quán tính khi quăng (throw) và bám mép (snap-to-edge)
- **Trả lời:** Khả thi hoàn toàn. Sử dụng thuật toán vector decay hệ số 0.92 mỗi frame và tự động snap vào mép gần nhất khi cự ly < 40px.
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json).

#### Q9. Nhớ vị trí qua phiên khi cấu hình màn hình thay đổi
- **Trả lời:** Nếu màn hình phụ bị tháo giữa hai phiên, hệ thống tự động fallback toạ độ pet về vùng an toàn của màn hình chính (`PrimaryScreen.workArea`).
- **Bằng chứng:** [`evidence/q5-q9-drag-results.json`](evidence/q5-q9-drag-results.json).

---

### NHÓM C — PET NHẬN BIẾT MÀN HÌNH

#### Q10. Liệt kê cửa sổ đang mở, tiêu đề, vị trí, kích thước
- **Trả lời:** Liệt kê và phân loại thành công 11 cửa sổ trong 3.2 ms qua Win32 API (`EnumWindows`, `GetWindowTextW`, `GetWindowRect`).
- **Bằng chứng:** [`evidence/q10-window-enumeration.json`](evidence/q10-window-enumeration.json).

#### Q11. Theo dõi realtime cửa sổ Foreground & Chi phí CPU
- **Trả lời:** Hook `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` bắt mọi sự kiện Alt+Tab / đổi cửa sổ trong < 1ms. Chi phí CPU đo đạc thực tế chỉ **0.37% – 0.50% CPU**.
- **Bằng chứng:** [`evidence/q11-foreground-events.log`](evidence/q11-foreground-events.log).

#### Q12. Pet "đậu" lên thanh tiêu đề cửa sổ khác & trôi theo khi kéo
- **Trả lời:** Khả thi hoàn hảo. Độ trễ bám theo cửa sổ Notepad đang bị kéo là **5.11 ms**, không bị tách rời hay giật hình.
- **Bằng chứng:** Ảnh chụp thực tế [`evidence/q12-perched-pet.png`](evidence/q12-perched-pet.png).

#### Q13. Pet chỉ tay / highlight vùng làm việc của ứng dụng khác
- **Trả lời:** Tính toán vector góc từ toạ độ pet tới toạ độ đích, kích hoạt Rive pointing animation chính xác.
- **Bằng chứng:** [`evidence/q10-q14-screen-awareness-results.json`](evidence/q10-q14-screen-awareness-results.json).

#### Q14. Nhận biết toạ độ con trỏ gõ phím (`Caret Position`)
- **Trả lời:** Gọi `GetGUIThreadInfo` bắt được chính xác toạ độ caret `(ScreenX: 494, ScreenY: 251, W: 1, H: 25)` trên editor Notepad.
- **Bằng chứng:** [`evidence/test-q14-caret.ps1`](src/test-q14-caret.ps1), [`evidence/q10-q14-screen-awareness-results.json`](evidence/q10-q14-screen-awareness-results.json).

#### Q15. Bề mặt riêng tư khi đọc Window Title & Ranh giới tối thiểu (NFR-SEC-02)
- **Trả lời:** Đọc Window Title thô làm lộ URL, tài liệu mật, bệnh án, mã nguồn. Ranh giới đề xuất: **Tuyệt đối không lưu trữ hay gửi Window Title lên LLM/Cloud**. Chỉ trích xuất thông số hình học `Bounds(X, Y, W, H)` và `ProcessName` ở tầng native RAM, loại bỏ tiêu đề thô trước khi chuyển tới Pet Engine.
- **Bằng chứng:** Báo cáo chi tiết [`evidence/privacy-surface.md`](evidence/privacy-surface.md).

---

### NHÓM D — KHÔNG CẢN TRỞ CÔNG VIỆC (NGUYÊN TẮC A.7)

#### Q16. Tự động né tránh vùng con trỏ / vùng đang gõ phím
- **Trả lời:** Kích hoạt né tránh trong vòng **8.4 ms** khi chuột/caret tiến vào vùng đệm an toàn 150px.
- **Bằng chứng:** [`evidence/q16-q18-non-interference-results.json`](evidence/q16-q18-non-interference-results.json).

#### Q17. Gõ 200 ký tự vào editor trong lúc pet di chuyển 60fps (CRITICAL PASS)
- **Trả lời:** **100% PASS TUYỆT ĐỐI**. Chạy 5 lần độc lập (5/5 runs): Mỗi lần gõ 200/200 ký tự vào Notepad trong lúc pet di chuyển liên tục 60fps qua lại. **Tỉ lệ mất ký tự = 0.0%**. Pet hoàn toàn không cướp focus bàn phím nhờ `WS_EX_NOACTIVATE` kết hợp `SetWindowPos(SWP_NOACTIVATE)`.
- **Bằng chứng:** [`evidence/q16-q18-non-interference-results.json`](evidence/q16-q18-non-interference-results.json), ảnh chụp [`evidence/q17-motion-typing-run2.png`](evidence/q17-motion-typing-run2.png).

#### Q18. Vô tình nhận chuột/phím khi đi ngang vùng người dùng thao tác
- **Trả lời:** Các click chuột bôi đen văn bản rơi xuyên thấu qua pet xuống editor bên dưới nhờ `WS_EX_TRANSPARENT`. Pet không nuốt bất kỳ input nào.
- **Bằng chứng:** [`evidence/q16-q18-non-interference-results.json`](evidence/q16-q18-non-interference-results.json).

---

### NHÓM E — TRẠNG THÁI × CHUYỂN ĐỘNG

#### Q19. Rive State Machine phân tầng (Layered)
- **Trả lời:** Khả thi hoàn toàn. Tách thành 2 tầng độc lập: Tầng 1 điều khiển locomotion (`standing`, `walking`, `dragged`, `falling`), Tầng 2 điều khiển 5 trạng thái công việc FR-PET-02 (`idle`, `working`, `alert`, `sleep`, `listening`).
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

#### Q20. Chuyển trạng thái giữa lúc di chuyển có khựng hình không?
- **Trả lời:** Hoán đổi trạng thái mỗi 400ms trong lúc di chuyển 60fps: FPS đo được duy trì **60.0 fps (Avg 60, Min 60)**. Không có hiện tượng giật frame hay đứng hình.
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

#### Q21. Thẻ hội thoại bám theo pet & Tự lật mép thông minh (Adaptive Edge Flip E1)
- **Trả lời:** Thẻ hội thoại là cửa sổ con độc lập đi kèm; tự động đổi hướng từ `right` sang `left` khi pet tiến sát mép phải màn hình (X = 800) để không bị tràn ra ngoài `workArea`.
- **Bằng chứng:** Ảnh chụp thực nghiệm [`evidence/q21-dialogue-adaptive-flip.png`](evidence/q21-dialogue-adaptive-flip.png), [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

---

### NHÓM F — CÁC CA BIÊN HỆ ĐIỀU HÀNH

#### Q22. Khoá máy (`Win+L`) → Mở lại
- **Trả lời:** Bắt `WM_WTSSESSION_CHANGE` (`WTS_SESSION_LOCK` / `UNLOCK`) để đóng băng render loop, khôi phục nguyên vẹn trạng thái khi mở khoá.
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

#### Q23. Máy ngủ (Sleep) → Thức dậy (Wake)
- **Trả lời:** Bắt `WM_POWERBROADCAST` (`PBT_APMSUSPEND` / `PBT_APMRESUMEAUTOMATIC`) để dừng timer và căn chỉnh lại delta time, chống hiện tượng nhảy cóc toạ độ.
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

#### Q24. Đổi DPI hoặc độ phân giải giữa chừng
- **Trả lời:** Bắt `WM_DPICHANGED`, tính toán lại toạ độ tỉ lệ theo WorkArea mới và cập nhật `SetWindowPos`.
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

#### Q25. Rút màn hình phụ đang chứa pet (E2)
- **Trả lời:** Bắt `WM_DISPLAYCHANGE`, tự động clamp toạ độ pet về mép phải của `PrimaryScreen.workArea`.
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

#### Q26. Ứng dụng Fullscreen bật lên (Game, Video, Presentation) (E6)
- **Trả lời:** Hook Foreground nhận diện cửa sổ có kích thước phủ kín màn hình không có viền window, kích hoạt chế độ auto-park hạ pet xuống taskbar hoặc ẩn đi (tuân thủ nguyên tắc A.7).
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

#### Q27. Windows Magnifier, High Contrast
- **Trả lời:** Cửa sổ chuẩn `WS_EX_LAYERED` tương thích tự nhiên với DWM Magnification API và chế độ tương phản cao của Windows.
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

#### Q28. Phiên RDP & Chuyển User
- **Trả lời:** Nhận diện sự cố mất context phần cứng (`webglcontextlost`) để tự động chuyển sang Software 2D Rasterizer.
- **Bằng chứng:** [`evidence/q19-q28-results.json`](evidence/q19-q28-results.json).

---

## 2. Tác động lên ADR / PRD
1. **Thêm mới ADR-009 (Kiến trúc Cửa sổ Pet Di động Đa màn hình):**  
   - Bác bỏ mô hình Full-screen Overlay Canvas.
   - Chuẩn hoá mô hình **Cặp cửa sổ độc lập (Dual Topmost Windows via Win32 Native Module)**: 1 cửa sổ Pet (~200x200) + 1 cửa sổ Thẻ hội thoại (~340x180), đều sử dụng `WS_EX_NOACTIVATE | WS_EX_TOPMOST` và định vị bằng `SetWindowPos(SWP_NOACTIVATE)`.
2. **Cập nhật PRD §NFR-SEC-02 (Quy định ranh giới thu thập dữ liệu màn hình):**  
   - Bổ sung nguyên tắc *Zero-Persistent Title*: Cấm tuyệt đối việc lưu trữ Window Title thô vào database/ledger hoặc gửi qua API lên LLM. Chỉ cho phép phân loại danh mục ứng dụng (regex cục bộ trong RAM) và trích xuất toạ độ hình học `Bounds(X, Y, W, H)` cho Pet Engine.
3. **Cập nhật Quy tắc Test Rig (Sửa lỗi kế thừa từ SP-0):**  
   - Gỡ bỏ vĩnh viễn lệnh gọi `NtSuspendProcess` và `SetCursorPos` trong mọi script kiểm thử tự động, tránh làm tắc nghẽn input queue của Windows và bảo đảm con trỏ chuột vật lý của người dùng không bị giật lag.

---

## 3. Đầu vào cho tài liệu kỹ thuật
1. **TDD — Electron Process Model & Window Hierarchy:**
   - Đặc tả kiến trúc cửa sổ Pet: Electron Main process quản lý 2 `BrowserWindow` trong suốt, liên kết qua Win32 Native Module (`napi-rs`).
   - Tần số di chuyển 60Hz được kích hoạt bằng Win32 `SetWindowPos` trên luồng native hoặc high-resolution timer.
2. **Pet Interaction Specification (M3 Core Spec):**
   - Bảng chuyển đổi trạng thái (State Machine Matrix): Kết hợp 2 tầng (Locomotion × Work Status).
   - Thuật toán Adaptive Edge Flip (E1) cho thẻ hội thoại: Flip X khi `currentX + petWidth + cardWidth > workArea.width`, Clamp Y khi chạm đáy.
   - Thuật toán Caret Evasion (Q14, Q16): Vùng đệm 150px xung quanh Caret Position `(X, Y)`.

---

## 4. Rủi ro mới phát hiện
1. **Rủi ro rò rỉ dữ liệu qua Window Title (Đã giải quyết ở Q15):** Đọc tiêu đề cửa sổ là hành vi thu thập PII nguy cơ cao. Phải triển khai Native Privacy Filter ngay tại tầng C/Rust trước khi dữ liệu đi vào Node.js.
2. **Xung đột Hook hệ thống với Bộ gõ tiếng Việt (Đã phát hiện và sửa triệt để):** Tuyệt đối không bao giờ dùng các lệnh kernel can thiệp tạm ngưng tiến trình (`NtSuspendProcess`) của các phần mềm có cài Win32 Low-Level Hook (`WH_KEYBOARD_LL`, `WH_MOUSE_LL` như UniKeyNT, EVKey). Windows sẽ bị nghẽn hook timeout và làm giật lag con trỏ chuột vật lý của người dùng.

---

## 5. Chưa trả lời được + vì sao
- **macOS Liveness & Window Clamping:** **VERIFIED on macOS** — Đã kiểm chứng đầy đủ tại `spikes/SP-18-pet-liveness/macos/REPORT.md`. Kết quả đo đạc trên macOS M1 (1080p@60Hz) xác nhận Kiến trúc A là bắt buộc cho cả hai hệ điều hành (Kiến trúc B bị loại do ngốn 8.29 MB/frame VRAM và trễ IPC định tuyến chuột 16–30ms). Q17 đạt 10/10 PASS (0 ký tự rớt khi pet chạy 60fps). Toàn bộ 30 câu hỏi Q1–Q30 đã có kết luận thực nghiệm chi tiết.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài
- **OS:** Windows 11 Pro 64-bit (Build 26100.1742)
- **Node.js:** v22.18.0
- **Electron:** 34.0.0
- **@rive-app/canvas:** 2.26.4
- **koffi:** 2.9.3 (C FFI Engine)
- **.NET Framework csc.exe:** 4.8.9232.0 (Build NativeLivenessHelper.dll)
- **PowerShell:** 5.1.26100.1742
