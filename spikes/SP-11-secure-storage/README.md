# SPIKE SP-11 — Secure Storage trên Windows

Thư mục: `spikes/SP-11-secure-storage/`  
Nền tảng: Windows NT 10.0+ (x64) · Node.js `v24.21.0` · Electron `v44.3.0`

---

## 1. Mục đích & Phạm vi

Kiểm chứng hạ tầng lưu trữ an toàn (secure storage) cho Desktop Assistant trên Windows:
1. So sánh và lựa chọn giữa Electron `safeStorage` (Windows DPAPI) vs thư viện keychain rời (`keytar` đã bị archive).
2. Đo lường giới hạn dung lượng thực tế của Windows Credential Manager (`2560 bytes`) vs `safeStorage` (hỗ trợ không giới hạn, thử nghiệm tới `1 MB`).
3. Kiểm chứng cơ chế bảo vệ toàn vẹn (AES-256-GCM auth tag) và xử lý lỗi / hiển thị SYSTEM card theo Phụ lục A.2.
4. Chứng minh bằng thực nghiệm rằng mã hoá DPAPI gắn liền với tài khoản người dùng Windows (SID + Master Key) thông qua việc tạo người dùng thứ hai `testuser_sp11` và kiểm thử giải mã chéo (mã lỗi `0x8009000B`).
5. Thiết kế và kiểm chứng mô hình phân loại & đặt tên khoá (`connector:`, `llm:`, `auth:`).
6. Hiện thực và kiểm chứng quy trình xoá sạch 100% credential theo yêu cầu xoá tài khoản FR-BE-12.

*Lưu ý về macOS:* tại thời điểm chạy spike này nhánh macOS đang hoãn theo quyết định của Product Owner, nên mọi câu hỏi về macOS Keychain được gắn nhãn **CHƯA KIỂM CHỨNG**. Nhánh đã mở lại ngày 13/09/2026: phần macOS do `SP-11/mac` trả lời, prompt tại `docs/spike-roadmap-macos.md` §5, kết quả ở `macos/REPORT.md` trong chính thư mục này.

---

## 2. Cấu trúc Thư mục

```
spikes/SP-11-secure-storage/
├── REPORT.md                         # Báo cáo chính theo chuẩn mục 3.4
├── README.md                         # Hướng dẫn chạy lại từ đầu (file này)
├── src/
│   ├── wincred-bench.ps1             # P/Invoke Advapi32.dll đo giới hạn CredWrite & lỗi 1783
│   ├── electron-secure-bench.js      # Benchmark safeStorage (payload 52B -> 1MB, tamper test, timing)
│   ├── cross-user-dpapi.ps1          # Tạo local user Windows thứ 2, thử giải mã chéo DPAPI, dọn dẹp
│   ├── secure-storage-service.js     # Module tham chiếu SecureStorageService (CRUD, taxonomy, wipe, card)
│   ├── test-service-wipe.js          # Runner test SecureStorageService, taxonomy & xoá tài khoản FR-BE-12
│   └── run-all.ps1                   # Master runner chạy trọn bộ 4 bài test và kiểm tra bằng chứng
└── evidence/
    ├── q1-library-status.json        # So sánh safeStorage vs keytar vs Windows Credential Manager
    ├── q2-payload-capacity.json      # Kết quả đo safeStorage: payload thật (Notion, Google) và stress 1MB
    ├── q2-wincred-limit.log          # Log đo giới hạn 2560 bytes của Windows Credential Manager
    ├── q2-wincred-results.json       # Dữ liệu JSON chi tiết của bài test CredWrite
    ├── q3-error-system-cards.json    # Kết quả 4 bài test can thiệp dữ liệu và mẫu SYSTEM card A.2
    ├── q4-cross-user-dpapi.json      # Kết quả kiểm thử giải mã chéo giữa 2 user Windows
    ├── q4-cross-user-dpapi.log       # Log thực tế Win32 HResult 0x8009000B (NTE_BAD_KEY_STATE)
    ├── q5-key-taxonomy.json          # Danh mục và cấu trúc đặt tên khoá credential
    ├── q6-account-wipe.json          # Kết quả xác minh xoá sạch dữ liệu FR-BE-12
    ├── q6-account-wipe.log           # Log thực tế quá trình xoá sạch credential
    └── run-summary.log               # Log tổng hợp trọn bộ suite
```

---

## 3. Hướng dẫn chạy lại từ đầu (Reproduction Guide)

Mở PowerShell trên máy Windows (chạy native trên desktop, không dùng WSL).

### Chạy toàn bộ master suite (Khuyến nghị)

```powershell
powershell -ExecutionPolicy Bypass -File .\spikes\SP-11-secure-storage\src\run-all.ps1
```

Thời gian chạy dự kiến: ~8 – 10 giây.  
Kết quả: In ra bảng kiểm tra 10 file bằng chứng và dòng chữ `OVERALL STATUS: PASS (ALL TESTS VERIFIED)`.

### Chạy từng bài test riêng biệt

1. **Đo giới hạn Windows Credential Manager:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\spikes\SP-11-secure-storage\src\wincred-bench.ps1
   ```

2. **Benchmark Electron safeStorage & Integrity:**
   ```powershell
   $electronExe = (Get-ChildItem -Path "$env:LOCALAPPDATA\npm-cache\_npx" -Filter 'electron.exe' -Recurse | Select-Object -First 1).FullName
   & $electronExe .\spikes\SP-11-secure-storage\src\electron-secure-bench.js
   ```

3. **Kiểm chứng cô lập DPAPI giữa 2 Windows user:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\spikes\SP-11-secure-storage\src\cross-user-dpapi.ps1
   ```

4. **Kiểm chứng Taxonomy khoá & Xoá sạch tài khoản FR-BE-12:**
   ```powershell
   $electronExe = (Get-ChildItem -Path "$env:LOCALAPPDATA\npm-cache\_npx" -Filter 'electron.exe' -Recurse | Select-Object -First 1).FullName
   & $electronExe .\spikes\SP-11-secure-storage\src\test-service-wipe.js
   ```
