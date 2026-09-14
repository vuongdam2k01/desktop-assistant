# SP-12 — SQLite Ledger: Append-only, Fail-closed, Khôi phục Crash

Spike kiểm chứng kiến trúc lưu trữ local-first bằng SQLite (`better-sqlite3`) cho Desktop Assistant, tập trung vào:
1. Cơ chế cưỡng chế append-only cho ledger (`action_records`) bằng SQLite Triggers kết hợp Repository layer (**Q2**).
2. Bảo đảm nguyên tắc fail-closed (ghi ledger trước khi gọi API mạng) và xử lý trạng thái bất định sau crash (**Q3**).
3. Tiêm crash bằng `SIGKILL` tại 5 điểm vòng đời tool call, kiểm chứng khôi phục trạng thái job và tái dựng hàng đợi card blocking chuẩn thứ tự ưu tiên (**Q4**).
4. Định dạng snapshot và mô phỏng dung lượng ledger sau 90 ngày hoạt động thực tế (**Q5**).
5. Chiến lược migration schema trên ledger bất biến (**Q6**).

*(Lưu ý: Mục **Q1** về native rebuild `better-sqlite3` theo ABI Electron, đối soát fsync/locking và đóng gói `electron-builder` trên Windows đã được hoàn thành đầy đủ trong session Windows Đợt 2).*

---

## 1. Cấu trúc thư mục

```
spikes/SP-12-sqlite-ledger/
├── package.json                   # dependencies (better-sqlite3 v13) & scripts
├── README.md                      # Tài liệu hướng dẫn cài đặt & tái lập thí nghiệm
├── REPORT.md                      # Báo cáo kết quả đầy đủ theo cấu trúc chuẩn (gồm cả Q1 Windows)
├── src/
│   ├── schema.sql                 # DDL bảng jobs, approval_requests, action_records, triggers & indexes
│   ├── db.js                      # Kết nối SQLite, bật WAL, synchronous NORMAL, foreign keys
│   ├── ledger.js                  # Repository append-only (chỉ INSERT & query, không UPDATE/DELETE)
│   ├── job-repository.js          # Quản lý vòng đời Job và ApprovalRequest
│   ├── card-queue.js              # Mô hình hàng đợi card & thuật toán sắp xếp ưu tiên (PRD A.4)
│   ├── mock-notion.js             # Mock dịch vụ Notion API lưu trạng thái stateful ra đĩa
│   ├── engine.js                  # Engine thực thi tool call tích hợp crash injector (5 điểm)
│   ├── recovery.js                # Recovery Engine: reconciliation đối soát ngoài & dựng lại queue
│   ├── worker.js                  # Worker process phục vụ kiểm thử crash bằng SIGKILL / TerminateProcess
│   ├── test-single-crash.js       # Kiểm thử crash tại 1 điểm cụ thể (hỗ trợ cả POSIX & Windows)
│   ├── crash-runner.js            # Suite tự động hóa crash injection 5 điểm & verify khôi phục
│   ├── q2-append-only-test.js     # Script kiểm chứng trigger chặn UPDATE/DELETE (nội bộ & tool ngoài)
│   ├── q5-storage-sim.js          # Script sinh dữ liệu 90 ngày, benchmark dung lượng & query
│   ├── q6-migration-test.js       # Script kiểm chứng chiến lược migration v1 -> v2 -> v3
│   └── packaging-test/            # Ứng dụng Electron tối giản kiểm chứng đóng gói electron-builder
│       ├── package.json           # Cấu hình electron-builder với asarUnpack .node
│       └── main.js                # Khởi chạy Electron, nạp better-sqlite3 từ asar.unpacked & test DB
└── evidence/
    ├── q1a-prebuild-check.log     # Log khảo sát prebuild-install trên Windows (HTTP 404)
    ├── q1-abi-mismatch.log        # Log lỗi ABI mismatch (NODE_MODULE_VERSION 137 vs 149)
    ├── q1c-electron-rebuild.log   # Log lỗi compile v11 trên V8 15.2
    ├── q1c-rebuild-v13.log        # Log @electron/rebuild thành công v13 (10.26s)
    ├── q1e-packaging.log          # Log đóng gói electron-builder --win --dir (34.69s)
    ├── q1e-packaging-result.json  # Kết quả thực thi file exe đã đóng gói thành công
    ├── q2-append-only.log         # Log chứng minh trigger chặn UPDATE/DELETE trên Windows
    ├── crash-point-1.log          # Log crash & khôi phục tại Point 1 (Before approval decision)
    ├── crash-point-2.log          # Log crash & khôi phục tại Point 2 (After approval, before intent)
    ├── crash-point-3.log          # Log crash & khôi phục tại Point 3 (After intent, before API call)
    ├── crash-point-4.log          # Log crash & khôi phục tại Point 4 (After API call, before result)
    ├── crash-point-5.log          # Log crash & khôi phục tại Point 5 (After result, before complete)
    ├── storage-benchmark.json     # Số đo dung lượng thực tế sau 90 ngày (normal & heavy profile)
    ├── q5-simulation.log          # Log chi tiết mô phỏng 90 ngày trên Windows
    └── q6-migration.log           # Log thực thi migration schema và tính bất biến trên Windows
```

---

## 2. Yêu cầu môi trường

### Môi trường Windows (SP-12/Q1):
- Windows 10/11 64-bit (chạy native trên desktop, TUYỆT ĐỐI không dùng WSL)
- Node.js >= 20.0 (đã kiểm chứng trên Node v24.21.0 x64)
- Python 3.11+ (cài đặt tại `C:\Program Files\Python311\python.exe`)
- Visual Studio Build Tools 2022 (Workload C++ Desktop / MSVC v19.44+, Windows SDK 10.0.26100.0)
- Electron 44.3.0 & @electron/rebuild

### Môi trường Linux (SP-12 Logic Q2–Q6):
- Linux (x86_64 hoặc ARM64)
- Node.js >= 20.0 (đã kiểm chứng trên Node v24.21.0)
- Python 3 (dùng để kiểm thử mở DB từ công cụ ngoài trong Q2)
- Build tools: `gcc`, `g++`, `make`

---

## 3. Cài đặt & Chạy lại toàn bộ thí nghiệm trên Windows

### Bước 1: Thiết lập môi trường Toolchain (PowerShell)
```powershell
$env:PYTHON = "C:\Program Files\Python311\python.exe"
$env:Path = "C:\Program Files\Python311;" + $env:Path
```

### Bước 2: Cài đặt dependencies & Biên dịch native
```powershell
cd spikes/SP-12-sqlite-ledger
npm install
```
*Ghi chú: `better-sqlite3@^13.0.3` sử dụng Node-API (N-API). Binary `prebuilds/win32-x64.node` chạy trực tiếp trên cả Node.js lẫn Electron mà không cần build-from-source. Nếu muốn ép buộc biên dịch lại bằng C++ compiler: `npm run build-release`.*

### Bước 3: Rebuild theo ABI Electron (Q1c)
```powershell
npx @electron/rebuild -v 44.3.0 -m . -w better-sqlite3
```

### Bước 4: Chạy toàn bộ bộ test logic & crash injection (Q1d, Q2, Q4, Q5, Q6)
```powershell
npm run test:all
```
Lệnh trên sẽ tuần tự chạy 4 bộ test trên Windows:
1. `npm run test:q2`: Kiểm chứng trigger chặn `UPDATE`/`DELETE` từ cả Node.js lẫn Python SQLite trên NTFS.
2. `npm run test:q4`: Chạy crash injection tự động qua 5 điểm `TerminateProcess` và kiểm tra phục hồi sau crash.
3. `npm run test:q5`: Sinh dữ liệu mô phỏng 90 ngày (1.800 - 4.500 jobs), đo dung lượng và latency query trên Windows.
4. `npm run test:q6`: Kiểm tra migration DDL (`ALTER TABLE`, `PRAGMA user_version`, transaction migration).

### Bước 5: Kiểm tra đóng gói bằng electron-builder (Q1e)
```powershell
cd src/packaging-test
npm install
npx electron-builder --win --dir
# Chạy file thực thi đã đóng gói:
.\dist\win-unpacked\sp12-packaging-test.exe
```
