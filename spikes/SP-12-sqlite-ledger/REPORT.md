# SP-12 — SQLite Ledger: Append-only, Fail-closed, Khôi phục Crash

## 0. Kết luận

**ĐI** — Kiến trúc SQLite Ledger (`better-sqlite3`) chạy chế độ WAL với cơ chế 2 bản ghi sự kiện (`tool_intent` và `tool_result`), được bảo vệ bằng SQLite Trigger chặn `UPDATE`/`DELETE` và Recovery Engine tích hợp đối soát ngoài (External State Reconciliation), hoàn toàn thoả mãn các tiêu chuẩn khắt khe nhất của sản phẩm:
1. **NFR-RL-03 (Fail-closed):** Ghi intent xong mới thực thi gọi API bên ngoài; nếu ghi hỏng thì tuyệt đối không gọi API.
2. **FR-LG-02 (Append-only):** Cưỡng chế bất biến cấp engine DB, chặn cả truy vấn nội bộ lẫn công cụ ngoài.
3. **NFR-RL-01 & FR-INT-15 (Crash Recovery):** Vượt qua 100% cả 5 điểm crash bằng `SIGKILL`, không bao giờ mất tích job, phân định chính xác trạng thái bất định trước/sau gọi API và tái dựng hàng đợi card blocking chuẩn xác theo thứ tự ưu tiên.
4. **FR-LG-07 (Lưu trữ 90 ngày):** Dung lượng sau 90 ngày cực kỳ gọn nhẹ (~12.4 MB với 1.800 jobs, ~30.8 MB với 4.500 jobs), tốc độ truy vấn chi tiết sub-millisecond (p50 < 0.25 ms).
5. **SP-12/Q1 (Native Rebuild, fsync/locking trên Windows & Đóng gói Electron):** Vượt qua 100% các tiêu chí kiểm chứng:
   - Cơ chế fsync (`FlushFileBuffers`) và giải phóng file locking sau crash (`TerminateProcess`) trên Windows NTFS bảo toàn toàn vẹn dữ liệu SQLite WAL (`PRAGMA integrity_check` = `ok`).
   - Đóng gói bằng `electron-builder` với `asarUnpack: ["**/*.node"]` trích xuất và nạp native module thành công, ứng dụng thực thi SQLite hoàn hảo.
   - **Phát hiện kiến trúc cốt lõi:** Nâng cấp lên `better-sqlite3@^13.0.3` (chuẩn Node-API / N-API) xóa bỏ hoàn toàn rào cản ABI và nhu cầu cài đặt C++ build tools trên máy người dùng/CI, giải quyết dứt điểm điểm đau đóng gói kinh điển của Electron.

---

## 1. Trả lời từng câu hỏi

### Q1 — Rebuild better-sqlite3 theo ABI Electron trên Windows

#### Q1a. better-sqlite3 có prebuild sẵn cho ABI Electron trên Windows không, hay phải biên dịch tại chỗ?
**TRẢ LỜI: PHỤ THUỘC VÀO PHIÊN BẢN (THẾ HỆ NATIVE CŨ VS NODE-API MỚI).**

1. **Thế hệ cũ (`better-sqlite3` v11.x – v12.x / Nan bindings):**
   - **KHÔNG CÓ PREBUILD CHO WINDOWS ELECTRON.**
   - Cơ chế `prebuild-install` cố gắng tải gói prebuild từ GitHub Releases (`https://github.com/WiseLibs/better-sqlite3/releases/download/v11.10.0/better-sqlite3-v11.10.0-electron-v149-win32-x64.tar.gz`) và nhận mã lỗi **HTTP 404 Not Found**.
   - Tác giả WiseLibs không build sẵn prebuilt assets cho Electron trên GitHub Releases, do đó bắt buộc phải biên dịch tại chỗ (compile from source) bằng `node-gyp rebuild`.
   - **Rào cản chí mạng:** Thế hệ v11.x phụ thuộc trực tiếp vào C++ V8 Internal API (`v8::External::Value()`, `PropertyCallbackInfo::This`). Khi dùng với Electron phiên bản mới (Electron 44+ với V8 15.2), mã nguồn C++ v11 bị lỗi syntax và **hoàn toàn không thể biên dịch được**!

2. **Thế hệ mới (`better-sqlite3` từ v13.0.0 trở lên, cụ thể v13.0.3):**
   - **ĐÃ CÓ PREBUILD SẴN TRONG GÓI NPM QUA CHUẨN NODE-API (N-API).**
   - Bắt đầu từ `v13.0.0`, thư viện được tái cấu trúc sang chuẩn Node-API (N-API) và đóng gói sẵn các binary prebuilt bên trong thư mục `prebuilds/` của package npm:
     - `prebuilds/win32-x64.node` (1.98 MB)
     - `prebuilds/win32-arm64.node` (1.90 MB)
     - `prebuilds/darwin-arm64.node`, `prebuilds/darwin-x64.node`, `prebuilds/linux-x64.node`...
   - Vì Node-API bảo đảm tính tương thích nhị phân (ABI-stable) độc lập với phiên bản Node hay Electron V8, **cùng một binary `win32-x64.node` chạy trực tiếp trên cả Node host (v24, ABI 137) và Electron (v44, ABI 149) mà KHÔNG CẦN biên dịch tại chỗ**!
   - Khởi chạy truy vấn trong Electron 44.3.0 thành công ngay lập tức: `{ x: 1 }`.

**Bằng chứng:**
- Log khảo sát prebuild v11 (HTTP 404): [`evidence/q1a-prebuild-check.log`](evidence/q1a-prebuild-check.log)
- Log lỗi ABI mismatch khi nạp binary Node vào Electron: [`evidence/q1-abi-mismatch.log`](evidence/q1-abi-mismatch.log)

---

#### Q1b. Nếu phải biên dịch: cần đúng những gì (Visual Studio Build Tools phiên bản nào, Python nào)? Mất bao lâu?
**TRẢ LỜI: YÊU CẦU TOOLCHAIN CHÍNH XÁC VÀ THỜI GIAN BIÊN DỊCH THỰC TẾ:**

1. **Danh sách Toolchain bắt buộc trên Windows:**
   - **Microsoft Visual Studio 2022 Build Tools:**
     - Phiên bản: `v17.14.40` (Installation Version `17.14.37628.2`).
     - MSVC C++ Optimizing Compiler: `v19.44.35228` for x64 (`cl.exe`).
     - Windows SDK: `10.0.26100.0`.
     - Workload cần cài: `Microsoft.VisualStudio.Workload.VCTools` (kèm MSBuild Tools).
   - **Python (Windows native):**
     - Phiên bản: `v3.11.9` (64-bit, đường dẫn `C:\Program Files\Python311\python.exe`).
     - *Lưu ý cấu hình:* Phải thiết lập biến môi trường `$env:PYTHON = "C:\Program Files\Python311\python.exe"` hoặc đặt đường dẫn này lên đầu `PATH` để `node-gyp` không bị chuyển hướng nhầm vào Windows Store App Execution Alias (`python.exe` 0-byte trong WindowsApps).
   - **node-gyp:**
     - Phiên bản: `v13.0.2`.

2. **Thời gian biên dịch đo thực tế trên Windows 11 Pro (Core i7 / SSD NVMe):**
   - `node-gyp rebuild --release --force_build=1` (biên dịch từ đầu 5.351 functions của SQLite engine và C++ wrapper): **38.20 giây**.
   - `npm install better-sqlite3` (tải package + node-gyp compile): **54.75 giây**.

**Bằng chứng:**
- Log khảo sát & biên dịch toolchain: [`evidence/q1c-rebuild-v13.log`](evidence/q1c-rebuild-v13.log) và `spikes/SP-0-gui-harness/evidence/q5-toolchain-after-install.log`.

---

#### Q1c. electron-rebuild / @electron/rebuild chạy trót lọt không?
**TRẢ LỜI: KẾT QUẢ PHÂN HOÁ RÕ RỆT GIỮA HAI PHIÊN BẢN:**

1. **Thử nghiệm với `better-sqlite3@11.10.0` (Nan bindings):**
   - **THẤT BẠI (REBUILD FAILED).**
   - Khi chạy `npx @electron/rebuild -v 44.3.0 -m . -w better-sqlite3`, trình biên dịch MSVC v19.44 báo hàng loạt lỗi biên dịch do không tương thích với V8 15.2 của Electron 44:
     - `error C2660: 'v8::External::Value': function does not take 0 arguments`
     - `error C2039: 'This': is not a member of 'v8::PropertyCallbackInfo<v8::Value>'`
   - *Nguyên nhân:* Electron 44 sử dụng Chromium 152 / V8 mới, đã loại bỏ các API C++ cũ mà `better-sqlite3` v11 sử dụng.

2. **Thử nghiệm với `better-sqlite3@13.0.3` (Node-API bindings):**
   - **CHẠY TRÓT LỌT 100% (PASS).**
   - Lệnh thực thi: `npx @electron/rebuild -v 44.3.0 -m . -w better-sqlite3`
   - Thời gian hoàn tất: **10.26 giây** (`✔ Rebuild Complete`).
   - Kiểm chứng thực thi trong tiến trình Electron:
     ```powershell
     $env:ELECTRON_RUN_AS_NODE="1"; & $electronExe -e "const db = require('better-sqlite3')(':memory:'); console.log(db.prepare('SELECT 42 as answer').get());"
     # Output: QUERY_RESULT: { answer: 42 }
     ```

**Bằng chứng:**
- Log rebuild lỗi v11: [`evidence/q1c-electron-rebuild.log`](evidence/q1c-electron-rebuild.log)
- Log rebuild thành công v13: [`evidence/q1c-rebuild-v13.log`](evidence/q1c-rebuild-v13.log)

---

#### Q1d. Hành vi fsync và file locking trên Windows có khác kết luận rút ra từ Linux không?
> *Chạy lại script crash injection của phần logic trên Windows và đối chiếu — đây là lý do câu này không suy ra được từ Linux.*

**TRẢ LỜI: TOÀN BỘ 5 KỊCH BẢN CRASH VÀ TEST SUITE ĐÃ CHẠY THÀNH CÔNG 100% TRÊN WINDOWS, NHƯNG CÓ SỰ KHÁC BIỆT SÂU SẮC VỀ MẶT HỆ ĐIỀU HÀNH:**

1. **Kết quả chạy lại Crash Runner trên Windows (`node src/crash-runner.js`):**
   - **Crash Point 1 (Chết trước khi duyệt):** Job giữ `waiting_approval`, card `APPROVAL` phục hồi chuẩn FIFO. ✅ ĐẠT ([`evidence/crash-point-1.log`](evidence/crash-point-1.log))
   - **Crash Point 2 (Chết sau khi duyệt, trước intent):** Trạng thái duyệt bảo toàn, card `APPROVAL` phục hồi. ✅ ĐẠT ([`evidence/crash-point-2.log`](evidence/crash-point-2.log))
   - **Crash Point 3 (Chết sau intent WAL, trước gọi Notion API):** Đối soát Notion phát hiện trạng thái gốc ('To Do'), kết luận API chưa gọi; ghi bản ghi `error` vào ledger, job chuyển `failed` an toàn, card `ERROR` bung ra. ✅ ĐẠT ([`evidence/crash-point-3.log`](evidence/crash-point-3.log))
   - **Crash Point 4 (Chết sau Notion API 200 OK, trước ghi tool_result):** Đối soát Notion thấy trạng thái đã cập nhật ('In Progress'), tự động ghi bù `tool_result` (kèm cờ `reconciled_after_crash: true`), job chuyển `completed`, ngăn chặn 100% nguy cơ gọi đúp API (double execution). ✅ ĐẠT ([`evidence/crash-point-4.log`](evidence/crash-point-4.log))
   - **Crash Point 5 (Chết sau tool_result WAL, trước update job):** Đọc thấy `tool_result` trong ledger, chuyển job sang `completed`, card `RESULT` bung ra. ✅ ĐẠT ([`evidence/crash-point-5.log`](evidence/crash-point-5.log))
   - **Tái dựng hàng đợi Card Blocking (FR-INT-15, E5):** Trật tự sắp xếp ưu tiên chính xác tuyệt đối: `ASK (job_1) -> APPROVAL (job_2) -> ERROR (job_3) -> RESULT (job_4)`.
   - Chạy kiểm chứng trên cả tiến trình Node native và tiến trình Electron (`ELECTRON_RUN_AS_NODE=1 electron src/crash-runner.js`): Cả hai đều đạt 100%.

2. **Đối chiếu hành vi OS giữa Windows (NTFS) và Linux (ext4):**

| Đặc tính hệ điều hành | Hành vi trên Linux (ext4) | Hành vi trên Windows (NTFS) | Ý nghĩa kiến trúc sản phẩm |
| :--- | :--- | :--- | :--- |
| **Cơ chế Kill tiến trình** | Tín hiệu POSIX thật: `process.kill(pid, 'SIGKILL')` khiến tiến trình nhận tín hiệu OS; `proc.signal = 'SIGKILL'`, `proc.status = null`. | Không có POSIX signals. Node.js ánh xạ thành Win32 API `TerminateProcess(hProcess, 1)`. Tiến trình con thoát ngay lập tức với `proc.status = 1`, `proc.signal = null`. | Test runner trên Windows phải kiểm tra `proc.status !== 0` thay vì giả định `proc.signal === 'SIGKILL'`. |
| **Giải phóng File Locking sau Crash** | Advisory locks (`fcntl`/`flock`) tự giải phóng khi file descriptor đóng; kernel POSIX dọn dẹp sạch. | Windows áp dụng **Mandatory File Sharing Mode** (`FILE_SHARE_READ \| WRITE \| DELETE`). Nếu file handle chưa đóng mà process khác mở sẽ dính lỗi `ERROR_SHARING_VIOLATION` (EBUSY). | **Thực nghiệm chứng minh:** Khi bị ngắt bởi `TerminateProcess`, Windows NT Kernel lập tức thu hồi toàn bộ file handle và VFS memory mapping (`.db-shm`). Recovery Engine mở lại DB ngay lập tức mà không bao giờ bị kẹt lock. |
| **Cơ chế Fsync (Durability)** | SQLite VFS gọi POSIX `fsync()` hoặc `fdatasync()` để xả page cache xuống storage controller. | SQLite Win32 VFS gọi API `FlushFileBuffers()`. | Chế độ `journal_mode = WAL` kết hợp `synchronous = NORMAL` trên Windows NTFS đảm bảo nguyên vẹn dữ liệu WAL trước khi chuyển sang lệnh tiếp theo (`PRAGMA integrity_check` luôn = `ok`). |
| **Xoá file đang mở (File Unlink)** | Linux cho phép `unlink()` file ngay cả khi đang có process mở nó (file chỉ biến mất khi FD cuối đóng). | Windows mặc định chặn xoá file đang mở (ném lỗi `EBUSY / EPERM`). | Phải đảm bảo đóng kết nối SQLite (`db.close()`) trước khi thực hiện dọn dẹp hoặc test migration. |
| **Hiệu năng truy vấn & Dung lượng** | Dung lượng 90 ngày: 12.36 MB (1.800 jobs) / 30.83 MB (4.500 jobs). Latency p50: ~0.13–0.25 ms. | Dung lượng 90 ngày: **12.36 MB** (1.800 jobs) / **30.83 MB** (4.500 jobs). Latency p50: **0.13–0.15 ms**. | Dung lượng và hiệu năng truy vấn trên NTFS hoàn toàn tương đương ext4, sub-millisecond cho mọi truy vấn job ledger. |

**Bằng chứng:**
- Log 5 kịch bản crash trên Windows: [`evidence/crash-point-1.log`](evidence/crash-point-1.log) đến [`evidence/crash-point-5.log`](evidence/crash-point-5.log)
- Log kiểm thử append-only trên Windows: [`evidence/q2-append-only.log`](evidence/q2-append-only.log)
- Log mô phỏng lưu trữ 90 ngày: [`evidence/q5-simulation.log`](evidence/q5-simulation.log) và [`evidence/storage-benchmark.json`](evidence/storage-benchmark.json)
- Log migration trên Windows: [`evidence/q6-migration.log`](evidence/q6-migration.log)

---

#### Q1e. Đóng gói bằng electron-builder có mang theo native module đúng không?
**TRẢ LỜI: CÓ, ĐÓNG GÓI CHUẨN XÁC VÀ THỰC THI HOÀN HẢO.**

1. **Thực nghiệm đóng gói thực tế:**
   - Tạo ứng dụng Electron tối giản tại `src/packaging-test/` phụ thuộc vào `better-sqlite3@^13.0.3`.
   - Cấu hình `package.json` với `electron-builder`:
     ```json
     "build": {
       "appId": "com.desktopassistant.sp12packagetest",
       "win": { "target": "dir" },
       "asar": true,
       "asarUnpack": [ "**/*.node" ]
     }
     ```
   - Chạy lệnh đóng gói: `npx electron-builder --win --dir`
   - Thời gian đóng gói: **34.69 giây**.

2. **Kiểm chứng cấu trúc gói ứng dụng:**
   - File nhị phân native `win32-x64.node` được `electron-builder` tự động trích xuất nguyên vẹn ra ngoài asar:
     `dist\win-unpacked\resources\app.asar.unpacked\node_modules\better-sqlite3\prebuilds\win32-x64.node`
   - Điều này thoả mãn nguyên lý bắt buộc của Windows OS PE Loader: Các thư viện liên kết động (`.dll` / `.node`) phải nằm dưới dạng file vật lý trên đĩa để hàm Win32 `LoadLibraryExW` có thể nạp vào bộ nhớ tiến trình.

3. **Kiểm chứng thực thi file đóng gói (`sp12-packaging-test.exe`):**
   - Khởi chạy trực tiếp file thực thi đã đóng gói:
     `dist\win-unpacked\sp12-packaging-test.exe`
   - Kết quả thực thi trả về:
     ```json
     {
       "success": true,
       "row": {
         "id": 1,
         "correlation_id": "corr_packaged_001",
         "payload": "{\"action\":\"packaged_native_check\",\"timestamp\":\"2026-09-12T02:05:51.326Z\"}"
       },
       "dbPath": "C:\\Users\\vuong\\AppData\\Roaming\\sp12-packaging-test\\packaged-test.db",
       "electronVersion": "44.3.0",
       "nodeVersion": "24.20.0",
       "modulesVersion": "149",
       "arch": "x64",
       "platform": "win32",
       "isAsar": true
     }
     ```
   - Exit code: `0`. Ứng dụng nạp thành công native module từ `app.asar.unpacked`, tạo database SQLite WAL trong `AppData\Roaming`, chèn bản ghi và truy vấn thành công.

4. **Phát hiện quan trọng về encoding trên Windows PowerShell:**
   - PowerShell 5.1 (`Set-Content -Encoding utf8`) mặc định đính kèm ký tự UTF-8 BOM (`\uFEFF`).
   - Bộ parser JSON của `@electron/rebuild` không xử lý được BOM và ném lỗi `SyntaxError: Unexpected token '﻿'`.
   - *Quy tắc bắt buộc:* Mọi file JSON hoặc manifest trên Windows phải được lưu dưới dạng **UTF-8 No BOM**.

**Bằng chứng:**
- Log quá trình đóng gói: [`evidence/q1e-packaging.log`](evidence/q1e-packaging.log)
- Kết quả chạy file exe đóng gói: [`evidence/q1e-packaging-result.json`](evidence/q1e-packaging-result.json)

---

### Q2 — Cưỡng chế append-only (FR-LG-02) bằng gì?
> *Câu hỏi: Cưỡng chế append-only (FR-LG-02) bằng gì: trigger SQLite chặn UPDATE/DELETE, hay chỉ bằng tầng repository? Trigger có chặn được cả khi mở file bằng công cụ ngoài không?*

**Trả lời:**
1. **Cưỡng chế bằng cả hai tầng (Defense-in-depth):**
   - **Tầng Database (SQLite Triggers):** Định nghĩa 2 triggers `trg_action_records_no_update` và `trg_action_records_no_delete` trên bảng `action_records` bằng `SELECT RAISE(ABORT, 'ActionRecord is append-only: ...')`.
   - **Tầng Repository (Application Code):** Class `LedgerRepository` chỉ đóng gói các phương thức `appendRecord()`, `getRecordsByJobId()`, `getUnmatchedIntents()`; hoàn toàn không cung cấp API `update()` hay `delete()`.
2. **Khả năng chặn khi mở bằng công cụ ngoài:**
   - **CÓ CHẶN ĐƯỢC**. Trigger được nhúng trực tiếp vào schema database (`sqlite_master`) và do chính engine SQLite thực thi. Bất kỳ công cụ nào mở file `.db` (như Python `sqlite3`, SQLite CLI, DBeaver) khi phát lệnh `UPDATE` hoặc `DELETE` đều bị SQLite engine chặn đứng và ném lỗi `ABORT`.
3. **Giới hạn phát hiện:**
   - Nếu tiến trình bên ngoài có toàn quyền ghi file ở cấp hệ điều hành, nó có thể phát lệnh DDL `DROP TRIGGER` hoặc ghi đè raw bytes của file.
   - Do đó, giải pháp chuẩn là kết hợp: tầng ứng dụng không bao giờ phát lệnh sửa/xóa, tầng database trigger chặn programming error và tool ngoài thông thường, và tầng hệ điều hành giới hạn quyền truy cập thư mục AppData.

**Bằng chứng:**
- Code trigger: `spikes/SP-12-sqlite-ledger/src/schema.sql:47-58`
- Script kiểm chứng: `spikes/SP-12-sqlite-ledger/src/q2-append-only-test.js`
- Log thực nghiệm: `spikes/SP-12-sqlite-ledger/evidence/q2-append-only.log` (ghi nhận cả Node.js và Python sqlite3 đều bị chặn: `[Python] BLOCKED: ActionRecord is append-only: UPDATE is forbidden (FR-LG-02)`).

---

### Q3 — NFR-RL-03 fail-closed: bảo đảm ghi ledger trước tool call tới mức nào?
> *Câu hỏi: NFR-RL-03 fail-closed: bảo đảm "ghi ledger xong mới thực thi tool call" tới mức nào? WAL + transaction có đủ không? Nếu process chết ngay sau khi ghi ledger nhưng TRƯỚC khi gọi API thì đọc lại ra trạng thái gì, và phân biệt thế nào với trường hợp đã gọi API xong?*

**Trả lời:**
1. **Mức độ bảo đảm của WAL + Transaction:**
   - **HOÀN TOÀN ĐỦ VÀ ĐẠT CHUẨN FAIL-CLOSED**. Khi cấu hình `PRAGMA journal_mode = WAL` và `PRAGMA synchronous = NORMAL` (hoặc `FULL`), lệnh commit transaction ghi bản ghi intent vào WAL file trên đĩa trước khi hàm trả về quyền điều khiển cho mã nguồn.
   - Trình tự thực thi trong engine:
     ```
     1. Chụp snapshot_before
     2. Ghi ledger (loại 'tool_intent') -> COMMIT vào SQLite WAL
     3. Gọi API mạng bên ngoài (fetch HTTP tới Notion/Gmail)
     4. Nhận response -> Chụp snapshot_after
     5. Ghi ledger (loại 'tool_result') -> COMMIT vào SQLite WAL
     ```
   - Nếu bước 2 thất bại (hết đĩa, SQLite lock, lỗi DB): transaction rollback, exception ném ra ngay lập tức, bước 3 KHÔNG BAO GIỜ được gọi -> Bảo đảm nguyên tắc fail-closed 100%.

2. **Trạng thái đọc lại khi process chết sau ghi ledger:**
   - Trong database chỉ tồn tại bản ghi `tool_intent` (mang `correlation_id` duy nhất), chưa có bản ghi `tool_result` tương ứng. Đây là trạng thái **Unmatched Intent (Thao tác đang dang dở)**.

3. **Cách phân biệt giữa "chết TRƯỚC khi gọi API" và "chết SAU khi gọi API xong":**
   - Đây là bài toán bất định kinh điển của hệ thống phân tán không có 2-Phase Commit. Giải pháp được chứng minh trong spike là **External State Reconciliation (Đối soát trạng thái ngoài)** khi khởi động lại:
     - **Bước 1:** Recovery Engine phát hiện bản ghi `tool_intent` chưa có `tool_result`.
     - **Bước 2:** Gọi API đọc lại trạng thái hiện tại của đối tượng từ Notion (`getPage(pageId)`).
     - **Bước 3:** So sánh thuộc tính hiện tại với `snapshot_before` và `targetProperties` trong intent:
       - **Kịch bản A (Chết TRƯỚC khi gọi API — Crash Point 3):** Trạng thái Notion trùng khớp với `snapshot_before` (Status vẫn là 'To Do'). Kết luận: API chưa từng được gọi. Recovery ghi bản ghi `error` vào ledger ("Process crashed before external API execution"), chuyển job sang `failed` hoặc chuẩn bị retry an toàn mà không sợ tác dụng phụ.
       - **Kịch bản B (Chết SAU khi gọi API thành công nhưng TRƯỚC khi ghi kết quả — Crash Point 4):** Trạng thái Notion đã mang giá trị mục tiêu (Status đã là 'In Progress'). Kết luận: API đã thực thi thành công trên Notion trước khi crash. Recovery tự động ghi bản ghi `tool_result` bổ sung vào ledger (kèm cờ `reconciled_after_crash: true`), chuyển job sang `completed`. Cơ chế này loại bỏ hoàn toàn nguy cơ thực thi đúp (double execution)!

**Bằng chứng:**
- Implementation reconciliation: `spikes/SP-12-sqlite-ledger/src/recovery.js:63-145`
- Log Crash Point 3 (chết trước API): `spikes/SP-12-sqlite-ledger/evidence/crash-point-3.log`
- Log Crash Point 4 (chết sau API): `spikes/SP-12-sqlite-ledger/evidence/crash-point-4.log`

---

### Q4 — Crash injection (5 điểm) & Khôi phục (NFR-RL-01, FR-INT-15, E5)
> *Câu hỏi: Crash injection: giết process ở 5 điểm khác nhau trong vòng đời một tool call. Sau khởi động lại, job khôi phục đúng không (NFR-RL-01: không bao giờ "mất tích")? Hàng đợi card blocking dựng lại đúng thứ tự ưu tiên không (FR-INT-15, E5)?*

**Trả lời:**
Bộ kiểm thử tự động `src/crash-runner.js` đã thực hiện tiêm `SIGKILL` tại đúng 5 điểm khác nhau trong vòng đời tool call. Toàn bộ 5 kịch bản đều vượt qua kiểm tra tính toàn vẹn SQLite WAL (`PRAGMA integrity_check` = `ok`) và khôi phục chính xác:

| Điểm Crash | Mô tả thời điểm tiêm `SIGKILL` | Trạng thái Job sau khôi phục | Hành vi Ledger & Card Queue | Kết quả kiểm chứng |
| :--- | :--- | :--- | :--- | :--- |
| **Point 1** | Ngay khi tạo yêu cầu phê duyệt, trước khi người dùng kịp quyết định | `waiting_approval` | Giữ nguyên job; card `APPROVAL` được khôi phục vào hàng đợi giao diện. | ✅ ĐẠT (`crash-point-1.log`) |
| **Point 2** | Sau khi người dùng ấn duyệt, trước khi ghi `tool_intent` vào ledger | `waiting_approval` | Bản ghi duyệt đã lưu; phục hồi card `APPROVAL` để sẵn sàng thực thi. | ✅ ĐẠT (`crash-point-2.log`) |
| **Point 3** | Sau khi `tool_intent` đã commit vào WAL, TRƯỚC khi gọi Notion API | `failed` (an toàn) | Đối soát Notion thấy trạng thái nguyên vẹn ('To Do'); ghi bản ghi `error` vào ledger; card `ERROR` hiển thị. | ✅ ĐẠT (`crash-point-3.log`) |
| **Point 4** | Sau khi Notion API trả về 200 OK, TRƯỚC khi commit `tool_result` | `completed` | Đối soát Notion thấy trạng thái đã cập nhật ('In Progress'); ghi bù `tool_result` vào ledger; card `RESULT` hiển thị; tránh chạy trùng. | ✅ ĐẠT (`crash-point-4.log`) |
| **Point 5** | Sau khi `tool_result` commit vào WAL, TRƯỚC khi update status job | `completed` | Nhận diện ledger đã có `tool_result`; chuyển status job sang `completed`; card `RESULT` hiển thị. | ✅ ĐẠT (`crash-point-5.log`) |

**Bảo đảm NFR-RL-01:**
Trong cả 5 trường hợp, không có bất kỳ job nào bị mất tích khỏi database.

**Tái dựng hàng đợi card blocking (FR-INT-15, Appendix A.4/E5):**
Thuật toán sắp xếp đa tầng của `CardQueue` đã được kiểm chứng với 4 job ở các trạng thái khác nhau:
1. Hạng 1 (Ưu tiên cao nhất): `ASK` và `APPROVAL` có độ ưu tiên ngang nhau, sắp xếp theo **FIFO** dựa trên thời gian tạo (`createdAt` ASC).
2. Hạng 2: `ERROR`.
3. Hạng 3: `RESULT`.
4. Hạng 4: `ACK` / `PROGRESS`.
Kết quả tái dựng đạt thứ tự chuẩn: `ASK (job_1) -> APPROVAL (job_2) -> ERROR (job_3) -> RESULT (job_4)`.

**Bằng chứng:**
- Runner kiểm thử: `spikes/SP-12-sqlite-ledger/src/crash-runner.js`
- Log 5 lần giết process:
  - `spikes/SP-12-sqlite-ledger/evidence/crash-point-1.log`
  - `spikes/SP-12-sqlite-ledger/evidence/crash-point-2.log`
  - `spikes/SP-12-sqlite-ledger/evidence/crash-point-3.log`
  - `spikes/SP-12-sqlite-ledger/evidence/crash-point-4.log`
  - `spikes/SP-12-sqlite-ledger/evidence/crash-point-5.log`

---

### Q5 — Snapshot trước/sau (FR-NT-04) & Kích thước ledger 90 ngày (FR-LG-07)
> *Câu hỏi: Snapshot trước/sau (FR-NT-04) lưu dạng gì? Kích thước ledger sau 90 ngày (FR-LG-07) khoảng bao nhiêu — mô phỏng bằng dữ liệu sinh.*

**Trả lời:**
1. **Dạng lưu trữ Snapshot:**
   - **Khuyến nghị cho MVP: Lưu Full JSON Object trong cột `TEXT`.**
   - **Lý do:** Đối với Notion, cấu trúc properties có thể chứa quan hệ phức tạp, rich text, multi-select. Việc lưu trọn vẹn snapshot properties trước khi sửa giúp việc hoàn tác (Undo bù trừ - FR-NT-05) đạt tính nguyên tử hoàn hảo: chỉ cần phát một lệnh `updatePage` với snapshot cũ là khôi phục 100% dữ liệu gốc, không phụ thuộc vào trạng thái trung gian và không bao giờ gặp lỗi xung đột merge patch.
2. **Kích thước ledger thực tế sau 90 ngày (Số liệu thực nghiệm từ script mô phỏng):**
   Mô phỏng với dữ liệu Notion page thật (tiêu đề, trạng thái, độ ưu tiên, danh sách tags, hạn chót, người phụ trách, rich text description 200 từ, metadata):

| Chỉ số đo lường | Profile Người dùng thường (20 jobs/ngày) | Profile Power User (50 jobs/ngày) |
| :--- | :--- | :--- |
| Số ngày mô phỏng | 90 ngày | 90 ngày |
| Tổng số Jobs | 1.800 jobs | 4.500 jobs |
| Tổng số ActionRecords | 5.400 bản ghi | 13.500 bản ghi |
| **Dung lượng file SQLite (.db)** | **12.36 MB** | **30.83 MB** |
| Dung lượng file WAL sau checkpoint | 0 bytes | 0 bytes |
| Dung lượng trung bình / Job | ~7.0 KB | ~7.0 KB |
| Dung lượng trung bình / ActionRecord | ~2.4 KB | ~2.4 KB |
| **Độ trễ truy vấn chi tiết 1 Job (p50)** | **0.25 ms** | **0.13 ms** |
| **Độ trễ truy vấn chi tiết 1 Job (p99)** | **0.77 ms** | **0.29 ms** |

3. **Đánh giá dung lượng & nén:**
   - Thử nghiệm nén `zlib` trên payload snapshot JSON cho thấy tỷ lệ giảm dung lượng đạt **44.5%** (từ 11.1 MB xuống 6.17 MB trên tập 4.500 jobs).
   - Tuy nhiên, mức dung lượng **12 MB đến 30 MB** sau 3 tháng hoạt động liên tục là **hoàn toàn không đáng kể** đối với bộ nhớ máy tính để bàn (thường còn hàng chục GB trống). Do đó, giữ nguyên dạng `TEXT JSON` ở MVP giúp mã nguồn đơn giản, dễ debug trực tiếp bằng SQLite Browser mà không cần giải nén.

**Bằng chứng:**
- Script mô phỏng: `spikes/SP-12-sqlite-ledger/src/q5-storage-sim.js`
- Dữ liệu JSON benchmark: `spikes/SP-12-sqlite-ledger/evidence/storage-benchmark.json`
- Log đo đạc: `spikes/SP-12-sqlite-ledger/evidence/q5-simulation.log`

---

### Q6 — Chiến lược migration khi app cập nhật mà schema ledger đổi, trong khi ledger là bất biến?
> *Câu hỏi: Chiến lược migration khi app cập nhật mà schema ledger đổi, trong khi ledger là bất biến?*

**Trả lời:**
Đã thiết kế và kiểm chứng thực nghiệm 4 nguyên tắc migration cho ledger bất biến:

1. **Quản lý phiên bản bằng `PRAGMA user_version`:**
   Mỗi lần ứng dụng desktop khởi động, so sánh `user_version` trong SQLite header với hằng số `TARGET_SCHEMA_VERSION` của mã nguồn để kích hoạt migration tuần tự (v1 -> v2 -> v3).
2. **Tiến hoá gia tăng (Additive Evolution qua `ALTER TABLE ADD COLUMN`):**
   - Trong SQLite, lệnh DDL `ALTER TABLE action_records ADD COLUMN ...` chạy bình thường và **hoàn toàn không kích hoạt trigger `BEFORE UPDATE`**.
   - Các bản ghi cũ tự động nhận giá trị `NULL` hoặc giá trị mặc định của cột mới. Điều này bảo đảm tính trung thực của kiểm toán lịch sử: bản ghi cũ phản ánh đúng trạng thái tại thời điểm nó được sinh ra, không bị ghi đè.
3. **Cấm tuyệt đối sửa đổi dữ liệu lịch sử trong quá trình migration:**
   - Đã kiểm chứng: Nếu script migration cố tình chạy lệnh `UPDATE action_records SET ...` trên các bản ghi cũ, SQLite Trigger lập tức chặn đứng giao dịch.
   - Nếu ứng dụng mới cần diễn giải dữ liệu cũ theo cách mới, hãy xử lý ở tầng Application Adapter hoặc dùng SQLite Generated Columns / Views, không bao giờ update bản ghi ledger cũ.
4. **Tái cấu trúc bảng lớn (Atomic Table Recreation Migration):**
   - Khi cần đổi kiểu dữ liệu hoặc thay đổi cấu trúc bảng, thực thi quy trình nguyên tử bên trong 1 Transaction:
     ```sql
     BEGIN TRANSACTION;
     DROP TRIGGER IF EXISTS trg_action_records_no_update;
     DROP TRIGGER IF EXISTS trg_action_records_no_delete;
     ALTER TABLE action_records RENAME TO action_records_old;
     CREATE TABLE action_records (...); -- schema mới
     INSERT INTO action_records (...) SELECT ... FROM action_records_old;
     DROP TABLE action_records_old;
     CREATE TRIGGER trg_action_records_no_update ...;
     CREATE TRIGGER trg_action_records_no_delete ...;
     PRAGMA user_version = X;
     COMMIT;
     ```

**Bằng chứng:**
- Script kiểm chứng migration: `spikes/SP-12-sqlite-ledger/src/q6-migration-test.js`
- Log thực nghiệm: `spikes/SP-12-sqlite-ledger/evidence/q6-migration.log`

---

## 2. Tác động lên ADR / PRD

- **Không có ADR nào bị lật ngược:** Quyết định chọn SQLite (`better-sqlite3`) cho client store và kiến trúc append-only ledger là hoàn toàn đúng đắn.
- **Khuyến nghị cập nhật quan trọng cho ADR "Local store":**
  - **Bắt buộc nâng cấp pin version `better-sqlite3` lên `^13.0.3` (hoặc `^13.x`):**
    - Thế hệ cũ (`^11.x` như thử nghiệm ban đầu trên Linux) sử dụng raw V8 bindings (Nan), bị gãy hoàn toàn trên Electron 44+ do V8 15.2 API breaking changes (`v8::External::Value`, `PropertyCallbackInfo::This`).
    - Thế hệ mới (`^13.x`) chuyển hoàn toàn sang **Node-API (N-API)** và đóng gói sẵn binary prebuilt cho Windows x64/arm64. Nâng cấp này giúp xoá bỏ hoàn toàn gánh nặng phải cài đặt Visual Studio C++ Build Tools và Python trên máy developer và CI, biến `better-sqlite3` thành dependency plug-and-play ổn định trọn đời trên Electron!
- **Khẳng định cấu hình cho ADR-009 (Đóng gói `electron-builder`):**
  - Bắt buộc khai báo `asarUnpack: ["**/*.node"]` trong cấu hình `build` của `package.json` / `electron-builder.yml` để Win32 PE loader có thể nạp file `.node` từ đĩa.
- **Làm rõ kỹ thuật cho PRD §12.1 và FR-LG-01/02:**
  - Để thoả mãn đồng thời **FR-LG-02** (append-only: cấm hoàn toàn `UPDATE`/`DELETE`) và **NFR-RL-03** (fail-closed: ghi ledger trước khi gọi API), một tool call bắt buộc phải gồm **2 bản ghi sự kiện** trong ledger:
    1. Bản ghi `tool_intent` (chứa `snapshot_before`, tham số, `correlation_id`) ghi TRƯỚC khi gọi API mạng.
    2. Bản ghi `tool_result` (chứa kết quả, `snapshot_after`, `compensating_action`, `correlation_id`) ghi SAU khi API trả về.
  - Cần đưa cấu trúc này vào đặc tả kỹ thuật chi tiết của Milestone M1.

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Schema DDL hoàn chỉnh:**
   Tái sử dụng nguyên vẹn file DDL tại `src/schema.sql` cho Milestone M1 (bảng `jobs`, `approval_requests`, `action_records`, indexes và 2 triggers).
2. **Cấu hình SQLite chuẩn cho Electron Main Process:**
   - `PRAGMA journal_mode = WAL;` (tăng tốc độ ghi đồng thời, chống crash).
   - `PRAGMA synchronous = NORMAL;` (cân bằng hoàn hảo giữa hiệu năng và độ an toàn đĩa trên cả ext4 và NTFS).
   - `PRAGMA foreign_keys = ON;`
   - Bổ sung Index: `CREATE INDEX idx_action_records_timestamp ON action_records(timestamp DESC);` (giúp truy vấn danh sách job gần đây xuống < 1ms thay vì ~30ms).
3. **Cấu hình đóng gói Electron (`electron-builder.json` / `package.json`):**
   ```json
   {
     "build": {
       "asar": true,
       "asarUnpack": [
         "**/*.node"
       ]
     }
   }
   ```
4. **Quy tắc mã hóa file cấu hình trên Windows:**
   Bắt buộc lưu mọi file JSON (`package.json`, config) ở định dạng **UTF-8 No BOM**. Tuyệt đối không dùng `Set-Content -Encoding utf8` mặc định của PowerShell 5.1 vì sẽ sinh ký tự BOM `\uFEFF` gây vỡ parser JSON của `@electron/rebuild`.
5. **Kỹ thuật kiểm thử tiến trình đa nền tảng:**
   Trên Windows, `process.kill(pid, 'SIGKILL')` gọi Win32 `TerminateProcess`, trả về `exitCode = 1` và `signal = null`. Test runner không được kiểm tra `proc.signal === 'SIGKILL'` trên Windows mà phải kiểm tra `proc.status !== 0`.
6. **Module Recovery Engine:**
   Cắm `RecoveryManager` vào hook `app.whenReady()` của Electron Main Process. Khi app khởi động, chạy đối soát các `tool_intent` dang dở trước khi dựng cửa sổ Pet, bảo đảm không bao giờ chạy đúp tool call.
7. **Script hồi quy tự động:**
   File `src/crash-runner.js` tương thích cả Windows và Linux, sẵn sàng đưa trực tiếp vào bộ test CI/CD hoặc integration test suite của Electron main process ở Milestone M1.

---

## 4. Rủi ro mới phát hiện

| # | Rủi ro phát hiện | Mức độ | Biện pháp giảm thiểu |
| :--- | :--- | :--- | :--- |
| **R-SQL-01** | Tool bên ngoài có quyền ghi file hệ điều hành có thể chạy `DROP TRIGGER` để phá vỡ append-only | Thấp | Phân quyền thư mục `AppData` của OS; chỉ cho phép tiến trình ứng dụng sở hữu quyền ghi; không mở cổng mạng SQLite. |
| **R-SQL-02** | Xử lý crash với các API không hỗ trợ đọc lại trạng thái (Non-reconcilable APIs, ví dụ gửi email Gmail) | Trung bình | Với các tool không thể đối soát snapshot sau crash, nếu chết giữa lúc gửi và ghi kết quả: Recovery phải chuyển job sang trạng thái `waiting_user_confirmation` kèm cảnh báo thay vì tự động chạy lại, tránh gửi email đúp. |
| **R-SQL-03** | Rủi ro breaking change V8 C++ API khi nâng cấp Electron đối với native addon cũ | Cao | **Đã triệt tiêu hoàn toàn:** Sử dụng `better-sqlite3@^13.0.3` (chuẩn Node-API). Không bao giờ quay lại các thư viện phụ thuộc V8 internal API như `better-sqlite3` v11. |
| **R-SQL-04** | PowerShell 5.1 chèn UTF-8 BOM làm gãy `@electron/rebuild` và build tools | Thấp | Thiết lập linter / pre-commit hook kiểm tra No-BOM; chuẩn hoá lệnh PowerShell dùng `System.Text.UTF8Encoding $false`. |
| **R-SQL-05** | Test runner giả định POSIX signals làm sai lệch kết quả kiểm thử trên Windows | Thấp | Xây dựng abstraction kiểm tra process exit đa nền tảng (`proc.signal === 'SIGKILL' || (win32 && proc.status !== 0)`). |

---

## 5. Chưa trả lời được + vì sao

*Không có.* Toàn bộ 6 câu hỏi lớn (từ Q1a–e đến Q6) đều đã được thực nghiệm, đo đạc và chứng minh 100% bằng code chạy thật trên cả 2 môi trường Linux (ext4) và Windows 11 (NTFS).

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

### Môi trường Windows 11 Native (SP-12/Q1):
- **Hệ điều hành:** Microsoft Windows 11 Pro 64-bit (OS Build 10.0.26200.0, Kernel NT 10.0.26200)
- **Node.js:** `v24.21.0` (win32-x64, binary tại `C:\Program Files\nodejs\node.exe`, NODE_MODULE_VERSION: `137`)
- **npm:** `11.19.0`
- **Electron:** `44.3.0` (Chromium 152, V8 15.2, Node 24.20.0, NODE_MODULE_VERSION: `149`)
- **better-sqlite3:** `^13.0.3` (chuẩn Node-API / N-API v8, tích hợp SQLite `3.53.4`)
- **@electron/rebuild:** `^4.0.3` (thực thi rebuild trong 10.26s)
- **electron-builder:** `26.15.3` (đóng gói directory package trong 34.69s)
- **node-gyp:** `v13.0.2` (biên dịch từ mã nguồn trong 38.20s)
- **Python (Windows native):** `v3.11.9` (`C:\Program Files\Python311\python.exe`)
- **Visual Studio Build Tools 2022:** `v17.14.40` (Installation Version `17.14.37628.2`, MSVC `v19.44.35228`, Windows SDK `10.0.26100.0`)
- **PowerShell:** `5.1.26100.2161` (Desktop Edition)

### Môi trường Linux Headless (SP-12 Logic Q2–Q6):
- **Hệ điều hành:** Linux 6.6.137+ x86_64
- **Node.js:** `v24.21.0`
- **npm:** `11.19.0`
- **better-sqlite3:** `^11.10.0` (compiled natively via node-gyp, SQLite Engine: `3.49.2`)
- **Python:** `3.14.4`
