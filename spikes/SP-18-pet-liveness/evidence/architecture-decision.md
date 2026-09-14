# BÁO CÁO QUYẾT ĐỊNH KIẾN TRÚC LỚP CỬA SỔ PET (Q0 ARCHITECTURE DECISION) — SP-18

> **TÀI LIỆU QUYẾT ĐỊNH ĐẦU NÃO CHO MILESTONE 3 (M3)**  
> **Trạng thái:** DỨT KHOÁT (DECISIVE)  
> **Khuyến nghị kiến trúc được chọn:** **KIẾN TRÚC A (CỬA SỔ NHỎ TỰ DI CHUYỂN QUA WIN32 SETWINDOWPOS)**  
> **Kiến trúc bị bác bỏ:** **KIẾN TRÚC B (OVERLAY TOÀN MÀN HÌNH - FULLSCREEN TRANSPARENT CANVAS)**

---

## 1. Tóm tắt Bối cảnh & Phát biểu Ngã rẽ Kiến trúc
Tại Milestone 3 (M3), trợ lý ảo (Pet) cần phải di chuyển tự do khắp màn hình desktop, bám theo cửa sổ ứng dụng, kéo thả, và hiển thị thẻ hội thoại. Để hiện thực hoá điều này trên nền tảng Windows + Electron, có hai hướng tiếp cận kiến trúc cơ bản:

- **Kiến trúc A (Small Window Moving via Win32 SetWindowPos):**  
  Tạo một cửa sổ Electron nhỏ kích thước ~200x200px bám sát nhân vật, sử dụng cờ Win32 native `WS_EX_NOACTIVATE | WS_EX_TOPMOST | WS_EX_LAYERED`. Khi pet di chuyển, toạ độ cửa sổ được cập nhật liên tục ở tần số 60Hz bằng lệnh Win32 `SetWindowPos(SWP_NOACTIVATE | SWP_NOSIZE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING)`. Thẻ hội thoại là một cửa sổ con độc lập (`cardWindow`) đi kèm.
- **Kiến trúc B (Full-screen Transparent Canvas Overlay):**  
  Tạo một cửa sổ Electron trong suốt duy nhất phủ kín toàn bộ diện tích desktop (bao gồm tất cả màn hình). Bật cờ `setIgnoreMouseEvents(true, { forward: true })` để click-through xuyên thấu xuống các ứng dụng phía dưới; pet di chuyển bên trong cửa sổ này bằng cách dịch chuyển toạ độ CSS / GPU Canvas transform. Thẻ hội thoại được render trực tiếp trong cùng DOM/Canvas.

---

## 2. Bảng So sánh Định lượng & Đo đạc Thực nghiệm (Empirical Benchmark Table)

Dữ liệu đo đạc trực tiếp từ harness benchmark (`bench-q0-q1-motion.ps1`, `bench-q2-q4-boundary.ps1`, `bench-q16-q18-non-interference.ps1`) chạy trên môi trường đa màn hình (Display 1: 1280x720 @ 150% DPI, Display 2: 1920x1080 @ 100% DPI):

| Tiêu chí Đánh giá | KIẾN TRÚC A (Cửa sổ nhỏ SetWindowPos) | KIẾN TRÚC B (Overlay Toàn màn hình) | Bên thắng |
| :--- | :--- | :--- | :--- |
| **FPS Di chuyển Cơ sở (Tải 0%)** | **60.0 fps** (Avg 60.0, Min 60, P95 60) | **60.0 fps** (Avg 60.0, Min 60, P95 60) | Hòa |
| **FPS Dưới Tải Nặng (70% CPU Stress)** | **60.0 fps** (Không xé hình, không nhấp nháy) | **60.0 fps** (Không xé hình, không nhấp nháy) | Hòa |
| **Bộ nhớ RAM (Working Set)** | **97.8 MB** (Nhẹ, ổn định) | **98.8 MB** (+1.0 MB) | Arch A |
| **Bộ nhớ Riêng tư (Private Memory)**| **41.4 MB** | **41.7 MB** | Arch A |
| **Tài nguyên GDI / USER Handles** | 24 GDI / 48 USER | 23 GDI / 46 USER | Hòa |
| **Kích thước DWM Swapchain Surface**| **200 × 200 px** (160 KB / frame) | **3840 × 1080 px** (~16.6 MB / frame) | **Arch A thắng áp đảo** |
| **Đi qua ranh giới Đa màn hình Khác DPI**| ✅ **HOÀN HẢO:** Cửa sổ 200x200 vượt qua seam mượt mà, nhận `WM_DPICHANGED` chuẩn xác tại vị trí tâm nhân vật, không méo hình, không giật toạ độ. | 🔴 **THẤT BẠI NGHIÊM TRỌNG:** Windows DWM & Chromium không thể render một HWND đơn lẻ với 2 tỉ lệ DPI khác nhau trên 2 nửa màn hình. Canvas bị giật co giãn, nhấp nháy hoặc lệch toạ độ chuột tại biên giới. | **Arch A thắng tuyệt đối** |
| **Độ trễ & Cơ chế Click-Through** | ✅ **Native Win32 OS:** Sử dụng `WM_NCHITTEST` / `WS_EX_TRANSPARENT`. Click chuột ngoài vùng nhân vật rơi thẳng xuống ứng dụng bên dưới ở tầng kernel Windows (0ms trễ). | 🔴 **Nghẽn IPC Chromium:** Bắt buộc dùng `setIgnoreMouseEvents(true, { forward: true })`. Mọi chuyển động chuột trên toàn desktop đều bị chuyển qua IPC thread của Chromium để phân giải, gây vi giật (micro-stutter) con trỏ chuột hệ thống. | **Arch A thắng tuyệt đối** |
| **Không cướp Keyboard Focus (Q17)**| ✅ **100% PASS:** 5/5 runs gõ 200/200 ký tự vào Notepad trong lúc pet di chuyển 60fps qua lại. Không mất ký tự nào. | ⚠️ **CÓ RỦI RO:** Do diện tích cửa sổ lớn, bất kỳ sự cố focus nào đều che toàn bộ màn hình. | **Arch A** |
| **Thẻ Hội thoại & Đồ họa Lớp (Layering)**| ✅ **Độc lập:** Thẻ là cửa sổ riêng, tự động lật mép (Adaptive Edge Flip E1: lật Trái/Phải/Trên/Dưới) khi pet chạm biên màn hình. Ứng dụng khác có thể nằm xen giữa nếu cần. | ❌ **Dính liền Canvas:** Pet và thẻ nằm chung 1 canvas, không thể tách biệt thứ tự Z-order với các cửa sổ bên thứ ba. | **Arch A** |

---

## 3. Phân tích Chi tiết 3 "Lỗ hổng Chết người" của Kiến trúc B

### 3.1. Điểm nghẽn Đa màn hình Khác DPI (Mixed-DPI Multi-Monitor Barrier)
- Trong thực tế người dùng hiện đại, thiết lập đa màn hình với DPI hỗn hợp (ví dụ: màn hình laptop 14-16 inch 150%/200% DPI ghép với màn hình rời 24-27 inch 100% DPI) là cực kỳ phổ biến.
- Với Kiến trúc B, một cửa sổ overlay bao phủ toàn bộ desktop ảo (`VirtualScreen`: 3840x1080) chỉ có thể gán cho một `DPI_AWARENESS_CONTEXT` và nhận một Scale Factor duy nhất tại một thời điểm từ Chromium. Khi một nửa cửa sổ nằm ở Display 1 (150%) và nửa còn lại ở Display 2 (100%), Chromium bắt buộc phải nội suy (stretch/scale) một trong hai nửa, dẫn đến hiện tượng vỡ hạt, mờ đục hoặc toạ độ canvas bị lệch hoàn toàn so với toạ độ pixel vật lý của chuột.
- Kiến trúc A khắc phục hoàn toàn vấn đề này: Cửa sổ 200x200 là một thực thể độc lập; khi nó di chuyển từ màn hình này sang màn hình kia, nhân Windows tự động gửi thông điệp `WM_DPICHANGED` đúng thời điểm tâm cửa sổ vượt ranh giới, cho phép cập nhật ma trận biến đổi mượt mà mà không ảnh hưởng tới bất kỳ vùng hiển thị nào khác.

### 3.2. Nguy cơ Đóng băng/Giật lag Con trỏ Chuột do `setIgnoreMouseEvents({ forward: true })`
- Để Kiến trúc B có thể click xuyên thấu những khoảng trống trong suốt của canvas toàn màn hình, Chromium bắt buộc phải cài đặt hook chuột nội bộ và chuyển tiếp sự kiện qua IPC loop.
- Như đã phát hiện và ghi nhận sâu sắc trong các bài kiểm tra thực tế, bất kỳ sự chậm trễ hoặc nghẽn thread nào trong message loop của Electron/Chromium đều lập tức làm khựng con trỏ chuột vật lý của toàn hệ thống điều hành.
- Với Kiến trúc A, ngoài phạm vi 200x200px của pet, **không có bất kỳ bề mặt cửa sổ nào tồn tại trên màn hình**. Hệ điều hành điều phối chuột trực tiếp xuống các ứng dụng phía dưới với chi phí CPU = 0% và độ trễ = 0ms.

### 3.3. Tiêu hao VRAM và Băng thông DWM Compositor
- DWM (Desktop Window Manager) của Windows duy trì một Direct3D surface texture cho mỗi HWND topmost.
- Cửa sổ 200x200px chỉ chiếm diện tích 0.04 megapixel.
- Cửa sổ overlay 3840x1080 chiếm tới 4.15 megapixel (gấp hơn 100 lần). Trên các cấu hình màn hình 4K kép (7680x2160), con số này lên tới 16.6 megapixel. Việc GPU liên tục blend một texture trong suốt khổng lồ ở 60fps gây lãng phí băng thông bộ nhớ đồ hoạ không cần thiết và làm giảm thời lượng pin trên laptop.

---

## 4. Kết luận & Quyết định Dứt khoát (Definitive Verdict)

1. **CHỌN KIẾN TRÚC A:**
   - Sử dụng cửa sổ nhỏ độc lập kích thước ~200x200px cho Pet.
   - Di chuyển bằng Win32 API native `SetWindowPos` với các cờ `SWP_NOACTIVATE | SWP_NOSIZE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING` thông qua module native Rust `napi-rs` (theo đúng kết luận bắt buộc của SP-7).
   - Thẻ hội thoại / companion card tách riêng thành một cửa sổ thứ hai (`WS_EX_NOACTIVATE`), di chuyển bám sát toạ độ của pet và tự động lật hướng (Adaptive Flip E1) khi tiến sát ranh giới màn hình.
2. **LOẠI BỎ HOÀN TOÀN KIẾN TRÚC B:**
   - Không sử dụng mô hình Overlay toàn màn hình trong sản phẩm chính thức.
3. **ĐẦU VÀO CHO TÀI LIỆU KỸ THUẬT:**
   - Báo cáo này đóng vai trò cơ sở để phê duyệt ADR mới: `ADR-009: Kiến trúc Cửa sổ Pet Di động Đa màn hình (Small Movable Topmost Window via Win32 SetWindowPos)`.
