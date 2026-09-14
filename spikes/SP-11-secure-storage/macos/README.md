# SP-11/mac — Secure storage trên macOS (Keychain)

Spike kiểm chứng thực nghiệm cơ chế bảo mật lưu trữ bí mật (OAuth tokens, BYO Client JSON, LLM API keys) trên macOS sử dụng Electron `safeStorage` kết hợp macOS Keychain.

---

## 1. Chuẩn bị máy & Điều kiện môi trường

- **Hệ điều hành:** macOS 26.5.2 (Build 25F84, Apple Silicon arm64).
- **Màn hình:** 1 màn hình `1920x1080` @ 60Hz.
- **Node.js:** `v26.8.2` (arm64).
- **Electron:** `44.3.0` (darwin-arm64).
- **Quyền bảo mật:** Chạy trong GUI interactive user session (`<user>:staff`). Khi chạy thử nghiệm ACL Q3, các hộp thoại SecurityAgent được kiểm thử và tự động hoá xử lý.

---

## 2. Cấu trúc thư mục

```text
spikes/SP-11-secure-storage/macos/
├── README.md                           # Hướng dẫn chạy lại từ đầu
├── REPORT.md                           # Báo cáo kết quả đầy đủ (7 mục bắt buộc)
├── evidence/                           # Log thực nghiệm, benchmark, screenshots
│   ├── q2-payload-benchmarks.json      # Kết quả đo tốc độ/overhead các payload
│   ├── q2-raw-keychain-limits.log      # Đo giới hạn kích thước raw Keychain
│   ├── q3-prompt-adhoc_v2.png          # Screenshot SecurityAgent prompt (ad-hoc)
│   ├── q3-prompt-certA_v2.png          # Screenshot SecurityAgent prompt (cert)
│   ├── q3-adhoc-v2-result.log          # Log thực thi cross-read adhoc v1 -> v2
│   ├── q4-deny-and-locked-keychain.log # Log kiểm chứng Deny & locked keychain
│   ├── q5-cross-user-isolation.log     # Phân tích quyền & cách ly user
│   └── q5-q6-service-suite-results.json# Kết quả kiểm thử taxonomy, tamper, wipe
└── src/                                # Mã nguồn kiểm chứng
    ├── bin/                            # Binary biên dịch kiểm thử ACL
    ├── certs/                          # Chứng chỉ tự ký A và B
    ├── bench-safestorage.js            # Đo đạc tải & overhead Electron safeStorage
    ├── probe-safestorage.js            # Thăm dò hành vi safeStorage trước/sau ready
    ├── keychain-acl-test.c             # Công cụ C gọi trực tiếp SecKeychain APIs
    ├── build-q3-binaries.sh            # Script build 5 binary với 3 cấu hình chữ ký
    ├── test-adhoc-cross-read.sh        # Test cross-read adhoc v1 -> adhoc v2
    ├── test-keychain-raw-limit.sh      # Test giới hạn kích thước raw Keychain
    ├── test-locked-keychain.c          # Test tương tác với Keychain bị khoá
    │                                   # Biên dịch lại khi cần:
    │                                   #   clang -framework Security -framework CoreFoundation \
    │                                   #     -o test-locked-keychain test-locked-keychain.c
    ├── test-q4-evidence.sh             # Thu thập log cho Q4 (Deny + Lock)
    ├── test-cross-user-keychain.sh     # Phân tích cách ly người dùng
    ├── secure-storage-service.js       # Module SecureStorageService cho macOS
    └── test-service-suite.js           # Bộ test hoàn chỉnh taxonomy, tamper, wipe
```

---

## 3. Cách chạy lại toàn bộ kiểm chứng từ đầu

```bash
# 1. Đo đạc tải và overhead safeStorage (Q1, Q2)
npx electron spikes/SP-11-secure-storage/macos/src/bench-safestorage.js

# 2. Đo giới hạn dung lượng raw Keychain (Q2)
./spikes/SP-11-secure-storage/macos/src/test-keychain-raw-limit.sh

# 3. Biên dịch các binary kiểm thử ACL (Q3)
./spikes/SP-11-secure-storage/macos/src/build-q3-binaries.sh

# 4. Kiểm chứng hành vi Deny và Locked Keychain (Q4)
./spikes/SP-11-secure-storage/macos/src/test-q4-evidence.sh

# 5. Phân tích quyền và cách ly user (Q5)
./spikes/SP-11-secure-storage/macos/src/test-cross-user-keychain.sh

# 6. Chạy bộ kiểm thử hoàn chỉnh SecureStorageService (Q5, Q6)
npx electron spikes/SP-11-secure-storage/macos/src/test-service-suite.js
```
