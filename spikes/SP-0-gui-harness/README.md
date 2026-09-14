# SPIKE SP-0: Windows GUI Test Harness

Kiểm chứng hạ tầng chạy spike GUI trên Windows native (không WSL) nhằm tự động hoá hoàn toàn vòng lặp:
**Chạy app GUI → Nhìn (chụp màn hình & đọc lại) → Bơm phím/chuột → Đọc kết quả**, mở khoá cho các spike GUI tiếp theo (`SP-3`, `SP-7`, `SP-11`, `SP-16`).

---

## 1. Cấu trúc thư mục

```text
spikes/SP-0-gui-harness/
├── REPORT.md                    # Báo cáo kết quả chính thức (theo template chuẩn §3.4)
├── README.md                    # Tài liệu hướng dẫn chạy lại từ đầu
├── src/
│   ├── launch.ps1               # [TÁI SỬ DỤNG] Khởi chạy GUI app trên desktop thật (WinSta0\Default)
│   ├── screenshot.ps1           # [TÁI SỬ DỤNG] Chụp màn hình / cửa sổ ra PNG (System.Drawing + GDI)
│   ├── sendkeys.ps1             # [TÁI SỬ DỤNG] Bơm phím & chuột qua Win32 SendInput (hỗ trợ Unicode, IME)
│   ├── run-closed-loop-test.ps1 # Bài test khép kín tự động (Notepad 200/200 ký tự)
│   ├── test-mouse.ps1           # Kiểm chứng di chuột và click theo toạ độ (Q4)
│   ├── test-electron.ps1        # Khởi chạy & chụp ảnh cửa sổ Electron tối giản
│   ├── survey-toolchain.ps1     # Khảo sát compiler C++, Python, Node cho SP-12/Q1 (Q5)
│   ├── survey-uac.ps1           # Khảo sát ranh giới quyền UAC / Administrator (Q6)
│   └── electron-minimal/        # Ứng dụng Electron tối giản (transparent, frameless, always-on-top)
│       ├── package.json
│       ├── main.js
│       └── index.html
└── evidence/                    # Bằng chứng kiểm thử thực tế
    ├── q3-sendkeys-200chars.txt  # 200 ký tự mẫu đã biết (Unicode, dấu tiếng Việt, ký hiệu)
    ├── q3-notepad-output.txt    # 200 ký tự đọc ngược lại từ file Notepad đã lưu (khớp 100%)
    ├── q2-notepad-screenshot.png# Ảnh chụp Notepad hiển thị 200 ký tự
    ├── q2-electron-screenshot.png# Ảnh chụp cửa sổ Electron nổi trên Desktop thật
    ├── closed-loop-run.log      # Log thực thi chi tiết bài test khép kín
    ├── q4-mouse-test.log        # Log toạ độ di chuột và click
    ├── q5-toolchain-survey.log  # Log khảo sát toolchain native
    └── q6-uac-survey.log        # Log khảo sát ranh giới UAC
```

---

## 2. Cách chạy lại từ đầu (Reproducibility)

Yêu cầu môi trường:
- Windows 10/11 (Native, **không chạy trong WSL**).
- PowerShell 5.1 hoặc PowerShell 7+.
- Node.js bản Windows (khuyến nghị v20+ hoặc v24+).

### Bước 1: Chạy bài test khép kín (Closed-Loop Test — Q1, Q2, Q3)
Mở Notepad, bơm 200 ký tự Unicode qua `SendInput`, chụp màn hình, lưu file qua `Ctrl+S`, và đối soát đếm chính xác 200/200:
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-0-gui-harness\src\run-closed-loop-test.ps1
```
Kết quả mong đợi: `>>> VERIFICATION RESULT: PASS (200/200 characters matched perfectly) <<<`.

### Bước 2: Chạy kiểm chứng di chuột và click (Q4)
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-0-gui-harness\src\test-mouse.ps1
```
Kết quả mong đợi: `Q4 Verification Overall Result: PASS`.

### Bước 3: Chạy kiểm chứng Electron tối giản (Transparent, Frameless, Always-On-Top)
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-0-gui-harness\src\test-electron.ps1
```
Kết quả mong đợi: Khởi chạy cửa sổ Electron nổi trên desktop thật và lưu ảnh tại `evidence/q2-electron-screenshot.png`.

### Bước 4: Khảo sát Toolchain native (Q5)
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-0-gui-harness\src\survey-toolchain.ps1
```

### Bước 5: Khảo sát UAC & Phân quyền (Q6)
```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-0-gui-harness\src\survey-uac.ps1
```

---

## 3. Cách tái sử dụng 3 script trong SP-3, SP-7, SP-11

### `src/launch.ps1`
Khởi chạy ứng dụng GUI trên desktop người dùng (`WinSta0\Default`), chờ cửa sổ xuất hiện và kích hoạt:
```powershell
$proc = & .\spikes\SP-0-gui-harness\src\launch.ps1 -FilePath "electron.exe" -ArgumentList @("path\to\app") -WindowTitleMatch "Window Title" -ForceForeground
# Trả về: [PSCustomObject]@{ Process; ProcessId; MainWindowHandle; WindowTitle; Desktop }
```

### `src/screenshot.ps1`
Chụp màn hình đầy đủ hoặc chụp theo handle cửa sổ / bounding rectangle:
```powershell
# Chụp một cửa sổ cụ thể:
& .\spikes\SP-0-gui-harness\src\screenshot.ps1 -OutputPath "evidence\my-shot.png" -WindowHandle $proc.MainWindowHandle

# Chụp toàn màn hình:
& .\spikes\SP-0-gui-harness\src\screenshot.ps1 -OutputPath "evidence\full-desktop.png"
```

### `src/sendkeys.ps1`
Bơm phím và chuột trực tiếp vào active input desktop (tự động bypass foreground lockout, căn chỉnh struct 40-byte x64 và tự động tạm dừng/phục hồi IME tiếng Việt):
```powershell
# Gõ chuỗi Unicode (hỗ trợ tiếng Việt có dấu):
& .\spikes\SP-0-gui-harness\src\sendkeys.ps1 -TargetWindow $proc.MainWindowHandle -Text "Xin chào Việt Nam 123"

# Bấm phím tắt:
& .\spikes\SP-0-gui-harness\src\sendkeys.ps1 -TargetWindow $proc.MainWindowHandle -Key "Ctrl+S"
& .\spikes\SP-0-gui-harness\src\sendkeys.ps1 -TargetWindow $proc.MainWindowHandle -Key "Enter"

# Di chuột và click:
& .\spikes\SP-0-gui-harness\src\sendkeys.ps1 -MouseMove @{ X = 400; Y = 300 } -MouseClick Left
```
