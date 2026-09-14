# HƯỚNG DẪN CHẠY LẠI THỰC NGHIỆM (REPRODUCTION GUIDE) — SP-18

Tài liệu hướng dẫn tái lập toàn bộ kết quả đo đạc thực nghiệm của Spike SP-18 ("Pet như một thực thể sống trên desktop") từ môi trường sạch.

---

## 1. Yêu cầu Môi trường
- **Hệ điều hành:** Windows 10/11 64-bit (Đã kiểm chứng trên Windows 11 Build 26100).
- **Node.js:** v20+ hoặc v22+ (Đã dùng v22.18.0).
- **Trình biên dịch C#:** `csc.exe` (sẵn có trong `%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`).
- **PowerShell:** PowerShell 5.1 hoặc PowerShell 7+.

---

## 2. Cài đặt Phụ thuộc & Biên dịch Native Helper

Mở PowerShell tại thư mục `spikes/SP-18-pet-liveness`:

```powershell
cd d:\projects\desktop-assistant\spikes\SP-18-pet-liveness

# 1. Cài đặt các gói npm cần thiết (koffi cho C FFI)
npm install

# 2. Biên dịch thư viện C# Native Helper DLL
& "$env:SystemRoot\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:library /out:src\NativeLivenessHelper.dll /reference:System.Windows.Forms.dll,System.Drawing.dll,UIAutomationClient.dll,UIAutomationTypes.dll src\NativeLivenessHelper.cs
```

---

## 3. Các kịch bản Benchmark Tự động hoá

Mỗi nhóm câu hỏi có một kịch bản PowerShell tự động hoàn chỉnh, xuất dữ liệu ra thư mục `evidence/`:

### 3.1. Nhóm A — Ngã rẽ Kiến trúc Q0 & Di chuyển 60fps Q1
So sánh Kiến trúc A (Cửa sổ nhỏ 200x200) vs Kiến trúc B (Overlay toàn màn hình):
```powershell
powershell -ExecutionPolicy Bypass -File src\bench-q0-q1-motion.ps1
```
- *Đầu ra:* `evidence/q0-architecture-comparison.json`, `evidence/q1-motion-arch-a-frame1..3.png`.

### 3.2. Nhóm A — Vượt ranh giới Đa màn hình Q2 & Clamping Q4
Kiểm tra pet đi qua ranh giới 2 màn hình khác DPI (100% vs 150%) và xử lý khi chạm taskbar:
```powershell
powershell -ExecutionPolicy Bypass -File src\bench-q2-q4-boundary.ps1
```
- *Đầu ra:* `evidence/q2-q4-boundary-results.json`, `evidence/q2-boundary-seam.png`.

### 3.3. Nhóm B — Kéo thả, Hit-test Pixel & Quán tính (Q5 - Q9)
Kiểm tra hit-test viền alpha, độ trễ bám chuột, thả pet ở các vị trí biên và quán tính văng (throw):
```powershell
powershell -ExecutionPolicy Bypass -File src\bench-q5-q9-drag-drop.ps1
```
- *Đầu ra:* `evidence/q5-q9-drag-results.json`, `evidence/q6-dragging-trajectory.png`.

### 3.4. Nhóm C — Pet nhận biết màn hình (Q10 - Q15)
Quét danh sách cửa sổ desktop, bắt sự kiện foreground qua `SetWinEventHook`, pet đậu lên Notepad (`Perching`), và đo toạ độ Caret con trỏ gõ phím:
```powershell
powershell -ExecutionPolicy Bypass -File src\bench-q10-q15-screen-awareness.ps1
```
- *Đầu ra:* `evidence/q10-window-enumeration.json`, `evidence/q11-foreground-events.log`, `evidence/q12-perched-pet.png`, `evidence/privacy-surface.md`.

### 3.5. Nhóm D — Không cản trở công việc & Gõ 200 ký tự (Q16 - Q18)
Bài test trọng yếu Q17: Gõ liên tục 200 ký tự vào Notepad trong lúc pet phi nước đại 60fps ngang qua:
```powershell
powershell -ExecutionPolicy Bypass -File src\bench-q16-q18-non-interference.ps1
```
- *Đầu ra:* `evidence/q16-q18-non-interference-results.json`, `evidence/q17-motion-typing-run2.png`.

### 3.6. Nhóm E & F — Trạng thái, Lật thẻ thông minh & Ca biên (Q19 - Q28)
Kiểm tra đổi trạng thái 60fps, thẻ hội thoại tự lật mép (Adaptive Edge Flip E1) và các ca biên Windows:
```powershell
powershell -ExecutionPolicy Bypass -File src\bench-q19-q28-state-edgecases.ps1
```
- *Đầu ra:* `evidence/q19-q28-results.json`, `evidence/q21-dialogue-adaptive-flip.png`.

---

## 4. Tài liệu Đầu ra Đầy đủ
1. [`REPORT.md`](REPORT.md) — Báo cáo tổng kết đầy đủ theo khung PRD §3.4.
2. [`evidence/architecture-decision.md`](evidence/architecture-decision.md) — Báo cáo so sánh số liệu chi tiết và quyết định kiến trúc cho Q0.
3. [`evidence/interaction-catalogue.md`](evidence/interaction-catalogue.md) — Danh mục kiểm chứng 28 câu hỏi tương tác chi tiết từ Q1 đến Q28.
4. [`evidence/privacy-surface.md`](evidence/privacy-surface.md) — Báo cáo phân tích bề mặt riêng tư Window Title và ranh giới tối thiểu cho NFR-SEC-02.
