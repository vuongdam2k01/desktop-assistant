# Hướng dẫn chạy lại từ đầu: SPIKE SP-22 — Quyền hệ thống (TCC) và Onboarding trên macOS

Tài liệu này ghi lại toàn bộ quy trình tái lập và kiểm chứng thực nghiệm các kết luận của SPIKE `SP-22`.

---

## 1. Môi trường kiểm nghiệm

- **Hệ điều hành:** macOS 26.5.2 (Build 25F84)
- **Kiến trúc:** Apple Silicon M1 (`arm64`), native 100% (`sysctl sysctl.proc_translated` trả `0`)
- **Node.js:** `v26.8.2` (Homebrew arm64) và `v24.20.0` (trong Electron)
- **Electron:** `v44.3.0`
- **Compiler:** Clang (`Apple clang version 21.0.0`)

---

## 2. Các kịch bản kiểm chứng độc lập

### Kịch bản 1: Đo đạc trạng thái quyền TCC & Preflight APIs
Kiểm tra các API truy vấn quyền âm thầm (`AXIsProcessTrusted`, `CGPreflightScreenCaptureAccess`, `AEDeterminePermissionToAutomateTarget`) trên cả binary thô lẫn trong App Bundle:
```bash
# Biên dịch probe native Objective-C
clang -fobjc-arc -framework Cocoa -framework CoreGraphics -framework ApplicationServices -framework CoreFoundation spikes/SP-22-macos-permissions/src/probe_tcc_apis.m -o spikes/SP-22-macos-permissions/src/bin/probe_tcc_apis

# Chạy kiểm tra preflight không pop-up
./spikes/SP-22-macos-permissions/src/bin/probe_tcc_apis

# Đóng gói và chạy thử nghiệm trong App Bundle riêng (com.desktopassistant.spike22.test)
tccutil reset All com.desktopassistant.spike22.test
open -W -a "$PWD/spikes/SP-22-macos-permissions/src/TestPermissions.app"
cat /tmp/test_permissions_output.log
```

---

### Kịch bản 2: Kiểm chứng URL Schemes mở trực tiếp System Settings
Kiểm chứng 6 deep link mở thẳng các trang cấu hình quyền trong System Settings của macOS 13+:
```bash
./spikes/SP-22-macos-permissions/src/test_system_settings_urls.sh
```

---

### Kịch bản 3: Khảo sát Khởi động cùng máy (Login Items)
Kiểm chứng đăng ký qua `SMAppService.mainApp` và Electron `app.setLoginItemSettings()`:
```bash
npx electron spikes/SP-22-macos-permissions/src/test_electron_login_item.js
```

---

### Kịch bản 4: Phân tích Designated Requirement & Chữ ký mã TCC
Khảo sát cách TCC lưu giữ định danh mã nguồn giữa bản ad-hoc và Developer ID:
```bash
./spikes/SP-22-macos-permissions/src/test_signing_identity.sh
```

---

### Kịch bản 5: 🔴 THỰC NGHIỆM CỐT LÕI — MVP Chạy với ZERO Quyền TCC
Thực nghiệm chứng minh phiên bản MVP (cửa sổ Pet trong suốt, thẻ hội thoại, lưu ledger SQLite, mã hoá SafeStorage, gửi lệnh connector) chạy trọn vẹn 100% trên trạng thái quyền đã reset sạch:
```bash
# Đóng gói DesktopAssistantMVP.app (bundle ID: com.desktopassistant.mvp.clean)
./spikes/SP-22-macos-permissions/src/build_mvp_app.sh

# Chạy kịch bản khép kín: reset TCC -> khởi chạy app -> chụp ảnh màn hình -> đối soát kết quả
./spikes/SP-22-macos-permissions/src/run_mvp_clean_test.sh
```
Kết quả trả về đạt `PASS (100%)` và ghi nhận chi tiết tại:
- Log thực thi: `spikes/SP-22-macos-permissions/evidence/mvp-zero-tcc-run.log`
- Dữ liệu đối soát: `spikes/SP-22-macos-permissions/evidence/mvp_zero_tcc_result.json`
- Ảnh chụp màn hình: `spikes/SP-22-macos-permissions/evidence/mvp-zero-tcc-screenshot.png`

---

## 3. Quy trình Reset Quyền TCC An Toàn (Không làm hỏng máy Agent)

Để mô phỏng môi trường "máy mới tinh" cho việc kiểm thử onboarding mà không thu hồi nhầm quyền của chính Antigravity hay Terminal:
```bash
# TUYỆT ĐỐI KHÔNG DÙNG: tccutil reset All (sẽ xóa quyền của cả hệ thống)
# BẮT BUỘC DÙNG KÈM BUNDLE ID CỤ THỂ:
tccutil reset All com.desktopassistant.mvp.clean
tccutil reset ScreenCapture com.desktopassistant.mvp.clean
tccutil reset Accessibility com.desktopassistant.mvp.clean
```
