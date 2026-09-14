# SP-16: Code Signing & Auto-Update Pipeline (Windows)

Tài liệu hướng dẫn tái lập toàn bộ quy trình kiểm chứng tự động Code Signing và Auto-Update trên Windows theo yêu cầu của Spike SP-16.

---

## 1. Yêu cầu môi trường

- **Hệ điều hành:** Windows 10 / Windows 11 (x64)
- **Node.js:** v24.21.0 (hoặc LTS >= 20.x)
- **Công cụ ký Windows SDK:** `signtool.exe` (đi kèm Windows SDK / Visual Studio Build Tools, ví dụ: `C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe`)
- **Quyền quản trị:** Cần mở PowerShell bằng quyền **Administrator** ở bước cài đặt chứng chỉ root vào máy (`setup-cert.ps1`) và gỡ chứng chỉ (`teardown-cert.ps1`).

---

## 2. Cấu trúc thư mục

```
spikes/SP-16-signing-update/
├── REPORT.md                         # Báo cáo kết quả và trả lời câu hỏi Q1 - Q7
├── README.md                         # Hướng dẫn tái lập thực nghiệm (file này)
├── certs/                            # Chứng chỉ số tự ký phục vụ dry-run
│   ├── sp16-code-signing.pfx         # File PFX có private key để ký code
│   ├── sp16-code-signing.cer         # File public cert
│   └── cert-info.json                # Thông tin thumbprint, thuật toán, thời hạn
├── evidence/                         # Bằng chứng thực nghiệm
│   ├── procurement-checklist.md      # Checklist so sánh nhà cung cấp, giá, hồ sơ
│   ├── screenshot-v1.0.0-running.png # Màn hình v1.0.0 khởi chạy
│   ├── screenshot-v1.0.1-updated.png # Màn hình v1.0.1 sau khi tự cập nhật
│   ├── verify-v1.0.0.log             # Kết quả signtool verify v1.0.0
│   ├── verify-v1.0.1.log             # Kết quả signtool verify v1.0.1
│   ├── updater-app.log               # Log vòng đời phát hiện & cài đặt update
│   └── server-requests.log           # Log HTTP update server tiếp nhận yêu cầu
├── builds/                           # Bộ cài installer sinh ra
│   ├── v1.0.0/                       # Bộ cài v1.0.0 + blockmap + latest.yml
│   └── v1.0.1/                       # Bộ cài v1.0.1 + blockmap + latest.yml
└── src/                              # Mã nguồn spike
    ├── app/                          # Ứng dụng Electron kiểm chứng
    │   ├── package.json              # Cấu hình electron-builder & electron-updater
    │   ├── main.js                   # Xử lý vòng đời auto-update & xung đột job
    │   ├── preload.js                # Context bridge IPC
    │   └── index.html                # Giao diện kiểm thử trực quan
    ├── server/                       # HTTP update server cục bộ
    │   ├── update-server.js          # Server HTTP hỗ trợ HTTP Range & URI decode
    │   └── updates/                  # Thư mục lưu latest.yml và bộ cài cập nhật
    ├── setup-cert.ps1                # Script tạo và trust chứng chỉ tự ký
    ├── teardown-cert.ps1             # Script gỡ chứng chỉ tự ký khỏi máy
    └── run-dryrun-test.ps1           # Script thực thi kiểm chứng tự động toàn diện
```

---

## 3. Các bước chạy lại từ đầu (Step-by-Step)

### Bước 1: Cài đặt chứng chỉ tự ký (Chạy Administrator)

Mở PowerShell với quyền Administrator:
```powershell
cd d:\projects\desktop-assistant\spikes\SP-16-signing-update\src
powershell.exe -ExecutionPolicy Bypass -File .\setup-cert.ps1
```
*Tác vụ thực hiện:* Tạo chứng chỉ Code Signing `CN=Desktop Assistant (Spike SP-16 Code Signing)` thời hạn 1 năm với thuật toán RSA 2048 / SHA256; import vào `Cert:\LocalMachine\Root` và `Cert:\LocalMachine\TrustedPublisher`; xuất ra `certs/sp16-code-signing.pfx` (mật khẩu `SpikeSP16Password123!`).

### Bước 2: Cài đặt dependencies và build bản v1.0.0

```powershell
cd d:\projects\desktop-assistant\spikes\SP-16-signing-update\src\app
npm install

# Đóng gói và ký số v1.0.0
npx electron-builder --win nsis
```
Sau khi build xong, copy file trong `dist/` vào `builds/v1.0.0/`:
```powershell
Copy-Item "dist\DesktopAssistantSpike Setup 1.0.0.exe" "..\..\builds\v1.0.0\"
Copy-Item "dist\DesktopAssistantSpike Setup 1.0.0.exe.blockmap" "..\..\builds\v1.0.0\"
Copy-Item "dist\latest.yml" "..\..\builds\v1.0.0\"
```

### Bước 3: Sửa version lên v1.0.1 và build bản v1.0.1

Chỉnh sửa `src/app/package.json` đổi `"version": "1.0.0"` thành `"version": "1.0.1"`. Sau đó đóng gói:
```powershell
npx electron-builder --win nsis
```
Copy file sang `builds/v1.0.1/` và thư mục cập nhật của server `src/server/updates/`:
```powershell
Copy-Item "dist\DesktopAssistantSpike Setup 1.0.1.exe" "..\..\builds\v1.0.1\"
Copy-Item "dist\DesktopAssistantSpike Setup 1.0.1.exe.blockmap" "..\..\builds\v1.0.1\"
Copy-Item "dist\latest.yml" "..\..\builds\v1.0.1\"

Copy-Item "dist\DesktopAssistantSpike Setup 1.0.1.exe" "..\server\updates\"
Copy-Item "dist\DesktopAssistantSpike Setup 1.0.1.exe.blockmap" "..\server\updates\"
Copy-Item "dist\latest.yml" "..\server\updates\"
```
(Sau khi build xong v1.0.1, trả lại `"version": "1.0.0"` trong `src/app/package.json` nếu muốn giữ mã nguồn ở v1.0.0).

### Bước 4: Khởi động HTTP Update Server

Mở một cửa sổ dòng lệnh riêng:
```powershell
node d:\projects\desktop-assistant\spikes\SP-16-signing-update\src\server\update-server.js
```
Server sẽ lắng nghe tại `http://127.0.0.1:8089/updates` và ghi log các request vào `evidence/server-requests.log`.

### Bước 5: Chạy kịch bản kiểm thử tự động toàn diện

Mở cửa sổ PowerShell khác:
```powershell
powershell.exe -ExecutionPolicy Bypass -File d:\projects\desktop-assistant\spikes\SP-16-signing-update\src\run-dryrun-test.ps1
```
Kịch bản sẽ tự động:
1. Dọn dẹp tiến trình cũ.
2. Cài đặt v1.0.0 vào `%LOCALAPPDATA%\Programs\sp16-desktop-assistant` bằng silent mode (`/S`).
3. Khởi chạy v1.0.0 và chụp ảnh màn hình lưu vào `evidence/screenshot-v1.0.0-running.png`.
4. v1.0.0 liên hệ server `http://127.0.0.1:8089/updates/latest.yml`, phát hiện bản v1.0.1, tải gói installer về cache pending.
5. Windows kiểm tra chữ ký số Authenticode của installer v1.0.1. Khi chữ ký hợp lệ, app kích hoạt `autoUpdater.quitAndInstall(true, true)`.
6. Bộ cài NSIS tự động cài đè binary lên v1.0.1 và khởi động lại app.
7. Script phát hiện phiên bản đã lên 1.0.1, chụp ảnh màn hình lưu vào `evidence/screenshot-v1.0.1-updated.png`.
8. Thu thập file log vào `evidence/updater-app.log` và xác nhận thành công.

### Bước 6: Dọn dẹp chứng chỉ tự ký (Sau khi thử nghiệm)

Khi kết thúc thử nghiệm và muốn gỡ bỏ hoàn toàn chứng chỉ khỏi Windows Certificate Store:
```powershell
powershell.exe -ExecutionPolicy Bypass -File d:\projects\desktop-assistant\spikes\SP-16-signing-update\src\teardown-cert.ps1
```
