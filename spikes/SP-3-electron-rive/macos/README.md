# SP-3/mac — Stack render pet (Electron + Rive) trên macOS

Spike kiểm chứng thực nghiệm stack render pet (Electron + Rive canvas WASM runtime) đã chốt tại ADR-001/002 trên nền tảng **macOS (Apple Silicon M1, arm64)**. Thí nghiệm đo đạc lại cùng các chỉ số đã thực hiện trên Windows (`spikes/SP-3-electron-rive/REPORT.md`) và kiểm chứng các ca đặc thù của macOS (mức tiêu thụ năng lượng, che khuất occlusion, Spaces, Metal GPU compositing, sleep/wake, dynamic asset swap).

---

## 1. Chuẩn bị máy (Theo `SP-0/mac`)

Trước khi chạy kiểm thử, đảm bảo:
1. **Màn hình & Chống ngủ**:
   - Màn hình Mac mini bật, không khoá màn hình.
   - Ngăn máy tự ngủ: `caffeinate -dimsu &` hoặc tuỳ chọn trong System Settings.
2. **Quyền TCC cho Antigravity / Terminal**:
   - **Screen Recording**: Đã cấp (cho phép chụp màn hình qua `screencapture`).
   - **Accessibility**: Đã cấp.
3. **Môi trường phần cứng & phần mềm**:
   - Máy: Mac mini (Apple M1, 8 cores GPU, 8 cores CPU).
   - Màn hình: 1920x1080 @ 60.00Hz (Màn hình rời 1x scale, không có ProMotion 120Hz tích hợp).
   - Nguồn điện: Nguồn điện lưới trực tiếp (không có pin).
   - Node.js `v26.8.2` (arm64), Electron `v44.3.0` (arm64).
   - Xác nhận chạy native: `sysctl sysctl.proc_translated` trả `0` (không chạy qua Rosetta 2).

---

## 2. Cách chạy kiểm thử

### Cách 1: Chạy toàn bộ suite tự động (Khuyến nghị)
```bash
./spikes/SP-3-electron-rive/macos/src/run_all_benchmarks.sh
```
Script sẽ tự động:
1. Biên dịch công cụ native `measure_pixels` (AppKit / CoreGraphics).
2. Khởi động ứng dụng Pet Electron nền trên cổng 3838 nếu chưa chạy.
3. Đo FPS baseline 10s và FPS khi tải CPU 70-80% đa luồng 10s (Q1).
4. Đo độ trễ chuyển 5 trạng thái pet và chụp ảnh màn hình (Q2).
5. Phân tích ma trận pixel RGBA quét các đường cắt ngang Y tìm viền quầng xám/đen (Q3).
6. Đo tài nguyên RAM, CPU, công suất tiêu thụ của hệ thống, và hành vi phục hồi sau khi bị cửa sổ khác che kín (Q4).
7. Kiểm tra trạng thái tăng tốc phần cứng Metal GPU của Electron/Chromium (Q5).
8. Xác thực xử lý sự kiện sleep/wake (Q6).
9. Thực nghiệm nạp hoán đổi asset `.riv` động khi app đang chạy mà không cần rebuild (Q7).

---

### Cách 2: Chạy từng bài đo thủ công

1. **Khởi động Pet Window:**
   ```bash
   npx electron spikes/SP-3-electron-rive/macos/src/electron-rive/main.js &
   ```

2. **Q1 — Tạo tải CPU 70% bằng script đa luồng:**
   ```bash
   node spikes/SP-3-electron-rive/macos/src/scripts/cpu-load.js 70 10
   ```
   Kiểm tra FPS:
   ```bash
   curl -s http://127.0.0.1:3838/metrics | jq '{currentFps, avgFps, minFps, maxFps, p95Fps}'
   ```

3. **Q2 — Chuyển trạng thái và đo độ trễ:**
   ```bash
   curl -s -X POST http://127.0.0.1:3838/state -d '{"state":"working"}'
   curl -s -X POST http://127.0.0.1:3838/state -d '{"state":"idle"}'
   ```

4. **Q3 — Phân tích điểm ảnh viền nhân vật:**
   ```bash
   # Chụp ảnh isolated RGBA:
   curl -s "http://127.0.0.1:3838/capture-page?path=$(pwd)/test.png"
   # Quét ma trận pixel:
   ./spikes/SP-3-electron-rive/macos/src/scripts/measure_pixels --image test.png --output result.json
   ```

5. **Q4 — Giả lập che khuất (Occlusion):**
   ```bash
   # Tạo cửa sổ che kín pet:
   curl -s -X POST http://127.0.0.1:3838/simulate-occlusion
   # Đóng cửa sổ che khuất và kiểm tra phục hồi:
   curl -s -X POST http://127.0.0.1:3838/remove-occlusion
   ```

6. **Q5 — Kiểm tra GPU:**
   ```bash
   curl -s http://127.0.0.1:3838/gpu-info | jq .
   ```

7. **Q7 — Đổi skin/asset động:**
   ```bash
   curl -s -X POST http://127.0.0.1:3838/load-asset -d '{"asset":"marty.riv"}'
   curl -s -X POST http://127.0.0.1:3838/load-asset -d '{"asset":"skills.riv"}'
   ```

8. **Đóng ứng dụng:**
   ```bash
   curl -s -X POST http://127.0.0.1:3838/close
   ```

---

## 3. Cấu trúc thư mục

```
spikes/SP-3-electron-rive/macos/
├── REPORT.md                 # Báo cáo kết quả chính thức đối chiếu với Windows
├── README.md                 # Hướng dẫn này
├── evidence/                 # Bằng chứng dữ liệu thực nghiệm
│   ├── q0-environment.json
│   ├── q1-fps-baseline.json
│   ├── q1-fps-70pct-load.json
│   ├── q1-fps-summary.log
│   ├── q2-transitions.json
│   ├── q2-state-idle.png
│   ├── q2-state-idle-rgba.png
│   ├── q2-state-receiving_order.png
│   ├── q2-state-receiving_order-rgba.png
│   ├── q2-state-working.png
│   ├── q2-state-working-rgba.png
│   ├── q2-state-waiting_approval.png
│   ├── q2-state-waiting_approval-rgba.png
│   ├── q2-state-has_result.png
│   ├── q2-state-has_result-rgba.png
│   ├── q3-edge-alpha-analysis.json
│   ├── q4-idle-resources.json
│   ├── q4-occlusion-test.json
│   ├── q5-gpu-status.json
│   ├── q6-sleep-wake.json
│   └── q7-dynamic-asset.json
└── src/
    ├── electron-rive/        # Ứng dụng Electron chạy Rive
    │   ├── assets/           # Rive runtime (.wasm, .js) và các file .riv
    │   ├── index.html        # Khung giao diện HTML
    │   ├── renderer.js       # Bộ đếm FPS, WebGL query, state machine logic
    │   └── main.js           # Cửa sổ Electron frameless trong suốt, HTTP server
    ├── scripts/              # Các công cụ kiểm thử tự động
    │   ├── cpu-load.js       # Sinh tải CPU đa luồng trên Apple Silicon M1
    │   ├── measure_pixels.m  # Công cụ native đọc ma trận điểm ảnh AppKit/CoreGraphics
    │   └── run-benchmarks.js # Kịch bản kiểm thử tự động hoá Node.js
    └── run_all_benchmarks.sh # Shell script tổng điều phối
```
