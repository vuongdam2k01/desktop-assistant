# SPIKE SP-7: Hành vi cửa sổ pet ở tầng hệ điều hành (Windows)

Kiểm chứng các hành vi cửa sổ của pet và dialogue card ở tầng hệ điều hành Windows:
- **Q1 (🔴 Đường găng):** Card tự bung không cướp keyboard focus (FR-INT-04).
- **Q2:** Click-through theo pixel (xuyên qua vùng trong suốt, nhận click vùng pet).
- **Q3:** Always-on-top đè lên ứng dụng fullscreen (E6).
- **Q4:** Đa màn hình khác DPI, nhớ toạ độ qua phiên và fallback tháo màn hình (FR-PET-01, E2).
- **Q5:** Dialogue card tự đảo hướng khi pet sát mép màn hình (E1).
- **Q6:** Khay hệ thống (System Tray) và Windows Native Notification khi ẩn pet (FR-INT-14, E3).

---

## 1. Cấu trúc thư mục

```text
spikes/SP-7-pet-window-os/
├── REPORT.md                         # Báo cáo chính thức theo khung §3.4
├── README.md                         # Hướng dẫn chạy lại từ đầu
├── src/
│   ├── launch.ps1                    # Script khởi chạy GUI app (tái sử dụng từ SP-0)
│   ├── screenshot.ps1                # Script chụp màn hình / cửa sổ (tái sử dụng từ SP-0)
│   ├── sendkeys.ps1                  # Script bơm phím SendInput (tái sử dụng từ SP-0)
│   ├── test-q1-focus.ps1             # Suite tự động 10 lần kiểm tra cướp focus (Q1)
│   ├── test-q2-clickthrough.ps1      # Kiểm chứng click-through xuyên pixel (Q2)
│   ├── test-q3-fullscreen.ps1        # Kiểm chứng đè ứng dụng fullscreen (Q3)
│   ├── test-q4-multimonitor.ps1      # Kiểm chứng đa màn hình & fallback E2 (Q4)
│   ├── test-q5-corners.ps1           # Kiểm chứng tự lật hướng cả 4 góc (Q5)
│   ├── test-q6-tray-notification.ps1 # Kiểm chứng Tray & Windows Notification (Q6)
│   └── electron-pet/                 # Ứng dụng Electron prototype tích hợp HTTP control API
│       ├── package.json
│       ├── main.js
│       ├── preload.js
│       ├── index.html                # Pet window
│       ├── card.html                 # Dialogue card window
│       ├── fullscreen.html           # Fullscreen test harness window
│       └── icon.png                  # System tray icon
└── evidence/                         # Bằng chứng kiểm thử tự động
    ├── q1-expected-200chars.txt      # 200 ký tự chuẩn
    ├── q1-focus-summary.log          # Tóm tắt kết quả 10 lần chạy Q1
    ├── q1-focus-run-1.log .. 10.log  # Chi tiết từng lần chạy
    ├── q1-focus-editor-during-popup.png # Ảnh chụp card bung khi gõ
    ├── q2-clickthrough.log & .png    # Kết quả click-through
    ├── q3-fullscreen.log & .png       # Kết quả đè fullscreen
    ├── q4-multimonitor.log & .png    # Kết quả đa màn hình
    ├── q5-corners.log & 4 ảnh góc   # Kết quả tự đảo hướng 4 góc
    └── q6-tray-notification.log & .png # Kết quả khay hệ thống & toast notification
```

---

## 2. Cách chạy lại từ đầu (Reproducibility)

### Yêu cầu môi trường
- Hệ điều hành: Windows 10/11 (Native, **không chạy qua WSL**).
- Node.js bản Windows (`v20+` hoặc `v24+`).
- PowerShell 5.1 hoặc PowerShell 7+.

### Bước 1: Khởi động Electron Pet Prototype
Mở một cửa sổ terminal và chạy:
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-7-pet-window-os\src\launch.ps1
```
Ứng dụng sẽ khởi chạy với HTTP control server lắng nghe tại port `18923`.

### Bước 2: Chạy bài test Focus Q1 (10 lần chạy tự động)
Trong một terminal khác, thực thi:
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-7-pet-window-os\src\test-q1-focus.ps1
```
Script sẽ tự động mở Notepad, bơm 200 ký tự với tốc độ 25ms/key, kích hoạt card bung giữa chừng qua API HTTP, lưu file, so sánh kết quả 10 lần liên tiếp và xuất ra `evidence/q1-focus-summary.log`.

### Bước 3: Chạy bài test Click-through Q2
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-7-pet-window-os\src\test-q2-clickthrough.ps1
```

### Bước 4: Chạy bài test Fullscreen Overlay Q3
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-7-pet-window-os\src\test-q3-fullscreen.ps1
```

### Bước 5: Chạy bài test Multi-Monitor & DPI Q4
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-7-pet-window-os\src\test-q4-multimonitor.ps1
```

### Bước 6: Chạy bài test 4 góc màn hình Q5
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-7-pet-window-os\src\test-q5-corners.ps1
```

### Bước 7: Chạy bài test Khay hệ thống & Notification Q6
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-7-pet-window-os\src\test-q6-tray-notification.ps1
```
