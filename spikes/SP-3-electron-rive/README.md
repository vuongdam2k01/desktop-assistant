# SPIKE SP-3 — Kiểm chứng stack render pet (Electron + Rive) trên Windows

Spike kiểm chứng tính khả thi và đo lường hiệu năng của stack render pet hoạt hình: **Electron** (cửa sổ trong suốt frameless) + **Rive Runtime** (animation engine 2D vector chạy qua WebAssembly).

---

## 1. Cấu trúc thư mục

```
spikes/SP-3-electron-rive/
├── REPORT.md                          # Báo cáo kết quả đầy đủ theo format chuẩn mục 3.4
├── README.md                          # Tài liệu hướng dẫn chạy lại từ đầu
├── evidence/                          # Toàn bộ bằng chứng đo lường thực tế
│   ├── q1-fps-baseline.json           # Dữ liệu đo FPS 10s khi máy không tải
│   ├── q1-fps-70pct-load.json         # Dữ liệu đo FPS 10s khi máy chịu tải ~70% CPU
│   ├── q1-fps-summary.log             # Báo cáo tóm tắt FPS và kết luận NFR-PF-04
│   ├── q2-state-idle.png              # Ảnh chụp desktop thực tế trạng thái 1: idle
│   ├── q2-state-receiving_order.png   # Ảnh chụp desktop thực tế trạng thái 2: receiving_order
│   ├── q2-state-working.png           # Ảnh chụp desktop thực tế trạng thái 3: working
│   ├── q2-state-waiting_approval.png  # Ảnh chụp desktop thực tế trạng thái 4: waiting_approval
│   ├── q2-state-has_result.png        # Ảnh chụp desktop thực tế trạng thái 5: has_result
│   ├── q2-state-*-rgba.png            # 5 ảnh RGBA 32-bit trích xuất trực tiếp từ renderer
│   ├── q2-transitions.json            # Đo lường độ trễ đổi trạng thái từ code (<2s)
│   ├── q3-edge-alpha-analysis.json    # Bảng phân tích giá trị RGBA của từng pixel tại viền
│   ├── q4-idle-resources.json         # Thống kê RAM / CPU của cụm tiến trình Electron
│   ├── state-machine-contract-v0.md   # Hợp đồng State Machine v0 giữa Designer & Dev
│   └── licensing-pricing-proof.md     # Bản tổng hợp khảo sát giấy phép MIT & giá công bố
└── src/
    ├── electron-rive/                 # Ứng dụng Electron + Rive Pet
    │   ├── package.json
    │   ├── main.js                    # Main process (transparent window + HTTP server)
    │   ├── index.html                 # HTML canvas container
    │   ├── renderer.js                # Rive runtime, state machine & RAF FPS counter
    │   └── assets/                    # Engine Rive và file asset .riv
    │       ├── rive.js                # @rive-app/canvas v2.42.1
    │       ├── rive.wasm              # WebAssembly engine
    │       └── skills.riv             # File .riv mẫu công khai
    └── scripts/
        ├── launch.ps1                 # Khởi chạy GUI trên WinSta0\Default (SP-0)
        ├── screenshot.ps1             # Chụp màn hình vùng cửa sổ ra PNG (SP-0)
        ├── launch-pet.ps1             # Script khởi động app pet
        ├── cpu-load.js                # Worker đa luồng tạo tải CPU chính xác cao
        ├── cpu-load.ps1               # Wrapper PowerShell tạo tải ~70% CPU
        ├── measure-pixels.ps1         # Script đọc và phân tích pixel viền RGBA
        └── run-sp3-benchmark.ps1      # Runner tự động hóa toàn bộ suite kiểm thử
```

---

## 2. Cách chạy lại toàn bộ Benchmark tự động

Mở PowerShell trên Windows và chạy lệnh sau:

```powershell
cd d:\projects\desktop-assistant\spikes\SP-3-electron-rive\src\scripts
powershell -ExecutionPolicy Bypass -File .\run-sp3-benchmark.ps1
```

Kịch bản sẽ tự động thực hiện:
1. Khởi động ứng dụng Electron Rive trên desktop tương tác (`WinSta0\Default`).
2. Đo FPS cơ sở (Baseline) trong 10 giây khi máy nhàn rỗi.
3. Kích hoạt worker đa luồng tạo tải ~70% CPU và đo FPS trong 12 giây tiếp theo.
4. Chuyển đổi tuần tự qua 5 trạng thái State Machine của pet, đo độ trễ từng lần chuyển và chụp ảnh màn hình lưu vào `evidence/`.
5. Đọc giá trị ma trận pixel RGBA ở viền nhân vật để kiểm tra lỗi viền đen/halo.
6. Lấy mẫu tài nguyên RAM (Working Set / Private Memory) và CPU của toàn bộ cây tiến trình Electron.
7. Đóng ứng dụng an toàn và cập nhật toàn bộ báo cáo trong `evidence/`.

---

## 3. Cách chạy ứng dụng Pet để tương tác thủ công

Nếu muốn mở cửa sổ pet để quan sát trực tiếp trên màn hình:

```powershell
cd d:\projects\desktop-assistant\spikes\SP-3-electron-rive\src\scripts
powershell -ExecutionPolicy Bypass -File .\launch-pet.ps1
```

Ứng dụng sẽ hiển thị trên góc màn hình với always-on-top. Các endpoint điều khiển qua HTTP:
- Chuyển trạng thái:
  ```powershell
  Invoke-RestMethod -Uri "http://127.0.0.1:3838/state" -Method Post -Body '{"state":"working"}' -ContentType "application/json"
  ```
  *(Các trạng thái hỗ trợ: `idle`, `receiving_order`, `working`, `waiting_approval`, `has_result`)*
- Xem chỉ số FPS và RAM thời gian thực:
  ```powershell
  Invoke-RestMethod -Uri "http://127.0.0.1:3838/metrics"
  ```
- Đóng ứng dụng:
  ```powershell
  Invoke-RestMethod -Uri "http://127.0.0.1:3838/close" -Method Post
  ```
