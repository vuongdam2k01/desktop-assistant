# SP-16/mac — Code Signing, Notarization & Auto-Update trên macOS

Spike kiểm chứng thực nghiệm quy trình ký số (Code Signing), công chứng (Apple Notarization), cơ chế Hardened Runtime & Entitlements, và đường ống cập nhật tự động (Auto-Update) qua `electron-builder` và `electron-updater` trên nền tảng **macOS (Apple Silicon M1, arm64)**. Thí nghiệm đối chiếu trực tiếp với kết luận của bản Windows (`spikes/SP-16-signing-update/REPORT.md`).

---

## 1. Chuẩn bị máy (Theo `SP-0/mac`)

Trước khi chạy lại các bài đo, đảm bảo môi trường:
1. **Màn hình & Chống ngủ**:
   - Màn hình Mac mini bật, không khóa màn hình.
   - Ngăn máy tự ngủ: `caffeinate -dimsu &`.
2. **Quyền TCC**:
   - Terminal / Antigravity đã được cấp quyền Screen Recording (cho lệnh `screencapture`) và Accessibility.
3. **Môi trường phần mềm**:
   - macOS 26.5.2 (Build 25F84, Apple Silicon M1 arm64).
   - Node.js `v26.8.2`, npm `11.19.1`.
   - Electron `44.3.0`, electron-builder `26.15.3`, electron-updater `6.8.9`.
   - Xác nhận chạy native: `sysctl sysctl.proc_translated` trả `0` (không qua Rosetta).
4. **Chứng chỉ thử nghiệm trong Keychain**:
   - Đảm bảo chứng chỉ Code Signing tự tạo `CN=DesktopAssistant Dev Test A` có sẵn trong Keychain `login.keychain-db`.

---

## 2. Cách chạy kiểm thử từng câu hỏi

### Bài 1: Kiểm chứng Hardened Runtime & Entitlements (Q2)
```bash
./spikes/SP-16-signing-update/macos/src/test-hardened-runtime.sh
```
*Script sẽ kiểm tra 6 trường hợp: không runtime, thiếu library-validation, thiếu JIT, thiếu unsigned-memory, và đầy đủ entitlements. Kết quả và crash stack trace được ghi vào `evidence/hardened-runtime-crash.log`.*

### Bài 2: Đóng gói bản v1.0.0 và v1.0.1 (Chuẩn bị cho Q4)
```bash
./spikes/SP-16-signing-update/macos/src/build-test-apps.sh
```
*Script sẽ tự động cấu hình `package.json`, dùng `electron-builder` đóng gói hai phiên bản, ký mã bằng `DesktopAssistant Dev Test A`, sinh các file `.zip`, `.dmg`, `latest-mac.yml` và đẩy lên thư mục server cập nhật.*

### Bài 3: Chạy vòng lặp Dry-Run Auto-Update (Q4 & Q6)
```bash
./spikes/SP-16-signing-update/macos/src/run-dryrun-test.sh
```
*Script sẽ khởi động server HTTP nội bộ (port 8089), mở bản v1.0.0, tự động tải bản v1.0.1 qua `Squirrel.Mac`, kiểm tra xác thực chữ ký của `ShipIt`, thực thi hoán đổi bundle và khởi động lại đúng phiên bản v1.0.1. Toàn bộ log Squirrel.Mac và ShipIt được lưu tại `evidence/squirrel-shipit-update.log`.*

### Bài 4: Kiểm chứng Gatekeeper & Quarantine (Q5)
```bash
./spikes/SP-16-signing-update/macos/src/test-quarantine-gatekeeper.sh
```
*Gắn thuộc tính mở rộng `com.apple.quarantine`, đánh giá qua `spctl --assess`, mở app và chụp ảnh màn hình hộp thoại cảnh báo của Gatekeeper vào `evidence/gatekeeper-quarantine-prompt.png`.*

---

## 3. Cấu trúc thư mục

```
spikes/SP-16-signing-update/macos/
├── REPORT.md                         # Báo cáo kỹ thuật chính (đối chiếu Windows ↔ macOS)
├── README.md                         # Hướng dẫn tái hiện thí nghiệm này
├── builds/                           # File nhị phân v1.0.0 và v1.0.1 đã đóng gói
│   ├── v1.0.0/                       # App, zip, dmg, blockmap v1.0.0
│   └── v1.0.1/                       # App, zip, dmg, blockmap v1.0.1
├── evidence/                         # Bằng chứng thực nghiệm
│   ├── procurement-checklist-macos.md # Hướng dẫn mua sắm tài khoản Apple Developer & chi phí
│   ├── dryrun-after-update.png        # Ảnh chụp màn hình app sau cập nhật
│   ├── gatekeeper-quarantine-prompt.png # Hộp thoại Gatekeeper chặn app chưa notarize
│   ├── hardened-runtime-crash.log    # Log lỗi chi tiết khi thiếu JIT / library-validation
│   ├── notarytool-stapler-output.log # Output lệnh notarytool & stapler khi chưa có cert
│   ├── quarantine-gatekeeper.log     # Đánh giá spctl và hành vi quarantine
│   ├── server-requests.log           # Nhật ký truy vấn HTTP server cập nhật
│   ├── squirrel-shipit-update.log    # Log thực thi của Squirrel.Mac và ShipIt
│   └── squirrel-mismatched-sig-error.log # Log lỗi chặn đứng khi chữ ký không khớp
└── src/
    ├── app/                          # Mã nguồn ứng dụng Electron kiểm thử
    │   ├── entitlements.mac.plist    # Entitlements chuẩn cho Hardened Runtime
    │   ├── entitlements.mac.inherit.plist # Entitlements cho helper processes
    │   ├── index.html                # Giao diện kiểm thử cập nhật và job conflict
    │   ├── main.js                   # Logic chính và quản lý autoUpdater
    │   ├── package.json              # Cấu hình electron-builder
    │   └── preload.js                # IPC bridge
    ├── server/                       # HTTP server phục vụ manifest & update
    │   ├── update-server.js
    │   └── updates/                  # Thư mục chứa latest-mac.yml, zip, dmg
    ├── build-test-apps.sh            # Script đóng gói hai phiên bản
    ├── run-dryrun-test.sh            # Script chạy toàn bộ dry-run auto-update
    ├── test-hardened-runtime.sh      # Script đo Hardened Runtime
    └── test-quarantine-gatekeeper.sh # Script thử nghiệm Gatekeeper
```
