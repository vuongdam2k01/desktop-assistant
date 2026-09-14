# SPIKE SP-12/mac — better-sqlite3 trên macOS: ABI, Đóng gói, và Độ bền ghi

Spike kiểm chứng thực nghiệm hạ tầng lưu trữ SQLite Ledger (`better-sqlite3`) trên nền tảng **macOS** (Apple Silicon M1, macOS 26.5.2, APFS với FileVault BẬT), tập trung giải quyết 5 câu hỏi trọng tâm:

1. **Q1:** Khảo sát prebuild Node-API (`prebuilds/darwin-arm64.node`) và tính tương thích nhị phân giữa Node host (v26) và Electron (v44).
2. **Q2:** Đo đạc toolchain biên dịch native C++ tại chỗ (Apple clang 21.0.0, Python 3.9.6) và kiểm chứng `@electron/rebuild`.
3. **Q3 (🔴 Trọng tâm):** Độ bền ghi (`fsync()` vs `F_FULLFSYNC` qua `PRAGMA fullfsync`), chạy 200 lượt tiêm crash bằng `SIGKILL` tại 5 điểm vòng đời, đo lường đánh đổi hiệu năng (writes/sec và latency p50/p95/p99) và xác định cấu hình bắt buộc cho spec ledger.
4. **Q4:** Hành vi file locking, `-shm`/`-wal` đa tiến trình trên APFS khi FileVault đang BẬT, đối chiếu kết luận với SP-21.
5. **Q5:** Đóng gói bằng `electron-builder` (`--arm64` vs `--universal`), kỹ thuật giải quyết lỗi `@electron/universal` với prebuilds, đo lường dung lượng gói `.app` và kiểm tra thực thi.

---

## 1. Cấu trúc thư mục

```
spikes/SP-12-sqlite-ledger/macos/
├── package.json                   # Dependencies & scripts chạy kiểm thử
├── README.md                      # Hướng dẫn cài đặt & tái lập thí nghiệm
├── REPORT.md                      # Báo cáo kết quả đầy đủ (7 mục chuẩn + đối chiếu Windows)
├── src/
│   ├── schema.sql                 # DDL bảng jobs, approval_requests, action_records, triggers & indexes
│   ├── db.js                      # Khởi tạo DB, WAL mode, hỗ trợ PRAGMA fullfsync & synchronous
│   ├── card-queue.js              # Thuật toán sắp xếp ưu tiên hàng đợi card blocking (PRD A.4)
│   ├── mock-notion.js             # Dịch vụ Mock Notion API stateful lưu trạng thái ra đĩa
│   ├── job-repository.js          # Quản lý vòng đời Job và ApprovalRequest
│   ├── ledger.js                  # Repository append-only (chỉ INSERT & query, chặn UPDATE/DELETE)
│   ├── engine.js                  # Engine thực thi tool call tích hợp crash injector (5 điểm)
│   ├── recovery.js                # Recovery Engine: reconciliation đối soát ngoài & dựng lại queue
│   ├── worker.js                  # Worker process phục vụ kiểm thử crash bằng SIGKILL
│   ├── test-single-crash.js       # Script kiểm thử crash tại 1 điểm cụ thể (hỗ trợ Mode A & B)
│   ├── crash-runner.js            # Runner tự động hóa kiểm thử 5 điểm crash cho cả 2 mode & queue
│   ├── test-q1-prebuild.js        # Kiểm chứng prebuild Node-API trên Node v26 và Electron v44
│   ├── test-q2-rebuild.js         # Đo đạc toolchain biên dịch native và @electron/rebuild
│   ├── test-q3-durability-benchmark.js # 200 lượt crash test & benchmark latency/throughput
│   ├── test-q4-apfs-locking.js    # Kiểm tra APFS locking, SHM/WAL và concurrency đa tiến trình
│   ├── test-q5-packaging.js      # Kiểm tra kết quả đóng gói và đo kích thước bundle
│   └── packaging-test/            # Ứng dụng Electron tối giản kiểm chứng electron-builder
│       ├── package.json           # Cấu hình x64ArchFiles cho universal build & asarUnpack
│       ├── main.js                # Code ứng dụng kiểm chứng ghi/đọc DB trong .app đóng gói
│       └── dist/                  # Kết quả đóng gói mac-arm64, mac (x64), mac-universal
└── evidence/
    ├── q1-prebuild-check.log      # Log kiểm tra prebuild Node-API trên Node và Electron
    ├── q2-rebuild-toolchain.log   # Log thông số toolchain, thời gian compile và rebuild
    ├── q3-durability-benchmark.log # Log kết quả 200 lượt crash & số đo writes/sec
    ├── q3-durability-benchmark.json # Số liệu benchmark chi tiết dạng JSON
    ├── q4-apfs-locking.log        # Log kiểm chứng file locking và multi-process trên APFS FileVault
    ├── q5-packaging.log           # Log kết quả đóng gói và đo kích thước gói
    ├── q5-package-sizes.json      # Bảng số đo kích thước gói và cấu trúc binary JSON
    └── crash-point-*-*.log        # Log chi tiết từng điểm crash ở 2 chế độ
```

---

## 2. Yêu cầu môi trường

- **Hệ máy:** macOS (Apple Silicon arm64 hoặc Intel x86_64; đã kiểm chứng trên Apple M1 arm64).
- **Hệ điều hành:** macOS 26.5.2+.
- **Node.js:** v26.8.2+ (hỗ trợ cả v20+).
- **Python:** Python 3.9.6+ (tại `/usr/bin/python3`).
- **Xcode Command Line Tools:** Apple clang 21.0.0+ (`xcode-select --install`).
- **Electron:** 44.3.0.
- **Ổ đĩa:** Định dạng APFS (hỗ trợ FileVault bật/tắt).

---

## 3. Cách chạy lại toàn bộ thí nghiệm từ đầu

### Bước 1: Cài đặt dependencies
```bash
cd spikes/SP-12-sqlite-ledger/macos
npm install
```

### Bước 2: Kiểm tra Q1 (Prebuild Node-API)
```bash
npm run test:q1
```

### Bước 3: Kiểm tra Q2 (Biên dịch native & @electron/rebuild)
```bash
npm run test:q2
```

### Bước 4: Chạy bộ Crash Injection (5 điểm x 2 chế độ)
```bash
npm run test:crash
```

### Bước 5: Chạy Stress Test độ bền ghi & Benchmark Throughput (Q3)
```bash
npm run test:q3
```

### Bước 6: Kiểm tra Locking & Concurrency trên APFS (Q4)
```bash
npm run test:q4
```

### Bước 7: Kiểm tra Đóng gói electron-builder (Q5)
```bash
cd src/packaging-test
npm install
npx electron-builder --mac --arm64 --dir
npx electron-builder --mac --x64 --dir
npx electron-builder --mac --universal --dir
cd ../..
npm run test:q5
```
