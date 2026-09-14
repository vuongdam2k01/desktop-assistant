# SP-18/mac — Pet như một thực thể sống trên desktop macOS

Thư mục này chứa mã nguồn thực thi, kịch bản kiểm thử tự động, và các bằng chứng số liệu đo đạc thực nghiệm cho **Spike SP-18/mac** trên nền tảng macOS (Apple Silicon M1 arm64).

---

## 1. Chuẩn bị máy (Kế thừa từ SP-0/mac §README)

Trước khi thực hiện hoặc tái hiện các bài đo đạc, môi trường trên máy Mac mini cần được xác lập và duy trì:
1. **Chống ngủ và chống khoá màn hình:**  
   Máy không được tự khoá màn hình và không được ngủ trong suốt thời gian chạy kiểm thử (đặc biệt là tiến trình 8 giờ chạy nền). Đảm bảo chạy `caffeinate -d -i -s -u` hoặc tắt tự động khoá màn hình trong **System Settings > Lock Screen**.
2. **Quyền TCC đã cấp:**  
   - **Accessibility (Trợ năng):** Cấp cho Antigravity / Terminal để điều khiển con trỏ chuột, gõ phím `CGEvent`, và đọc toạ độ Caret.
   - **Screen Recording (Ghi màn hình):** Cấp cho Antigravity / Terminal để chụp ảnh màn hình bằng `screencapture`.
3. **Môi trường kiến trúc:**  
   - macOS 26.5.2 (Build 25F84, Darwin 25.5.0)
   - Kiến trúc: `arm64` (Apple Silicon M1 8-core)
   - Node.js: `v26.8.2` (arm64, `sysctl sysctl.proc_translated` = 0, không chạy qua Rosetta)
   - Electron: `v44.3.0`

---

## 2. Cấu trúc thư mục

```
spikes/SP-18-pet-liveness/macos/
├── README.md                               # Hướng dẫn tái hiện & chuẩn bị máy
├── REPORT.md                               # Báo cáo kỹ thuật tổng kết SP-18/mac (khung §3.4)
├── package.json                            # Cấu hình dự án Electron
├── evidence/                               # Dữ liệu đo đạc thực nghiệm
│   ├── architecture-decision.md            # Đầu ra bắt buộc #1: Quyết định Kiến trúc A vs B
│   ├── interaction-catalogue.md            # Đầu ra bắt buộc #2: Danh mục tương tác Q1–Q30
│   ├── privacy-surface.md                  # Đầu ra bắt buộc #3: Bề mặt riêng tư & Zero-Persistent Title
│   ├── q0-architecture-comparison.json     # Số đo so sánh A vs B
│   ├── q1-motion-results.json              # Số đo FPS 0% vs 70% CPU
│   ├── q2-q4-boundary-results.json         # Số đo biên và clamping
│   ├── q3-durability-slope.json            # Số đo độ dốc RAM trong session
│   ├── q3-8hour-durability.log             # Log tiến trình 8 giờ chạy nền
│   ├── q5-q9-drag-results.json             # Số đo kéo thả & quán tính
│   ├── q10-q16-screen-awareness.json       # Số đo nhận diện cửa sổ & caret
│   ├── q17-q19-non-interference.json       # Kết quả 10 lần gõ phím khi pet di chuyển (FR-INT-04)
│   ├── q20-q22-state-results.json          # Số đo state machine phân tầng & lật thẻ hội thoại
│   ├── q23-q30-edgecases-results.json      # Số đo ca biên & trả focus
│   └── *.png                               # Các ảnh chụp bằng chứng màn hình
└── src/                                    # Mã nguồn thực thi & benchmark
    ├── bin/
    │   └── liveness_helper                 # Binary native Objective-C (CoreGraphics, AppKit, proc)
    ├── electron-liveness/                  # Ứng dụng Electron prototype
    │   ├── main.js                         # Điều khiển cửa sổ, HTTP control server, motion engine
    │   ├── preload.js                      # Context bridge bảo mật
    │   ├── style.css                       # CSS trong suốt & comic speech bubble
    │   ├── index-a.html / renderer-a.js    # Prototype Kiến trúc A (Cửa sổ nhỏ 200x200)
    │   ├── card-a.html                     # Thẻ hội thoại Dialogue Card (340x180)
    │   ├── index-b.html / renderer-b.js    # Prototype Kiến trúc B (Fullscreen Overlay 1920x1080)
    │   └── assets/                         # File Rive (.riv, runtime wasm)
    ├── liveness_helper.m                   # Mã nguồn C/Objective-C native helper
    ├── start_electron.sh                   # Script khởi động Electron tin cậy
    ├── bench_q0_architecture.js            # Benchmark so sánh định lượng A vs B
    ├── bench_q1_motion.js                  # Benchmark đo 60fps & chụp ảnh kiểm tra xé hình
    ├── bench_q2_q4_boundary.js             # Benchmark kiểm tra clamping và biên màn hình
    ├── measure_durability_slope.js         # Phép đo độ dốc rò rỉ bộ nhớ trong session
    ├── run_8h_durability_daemon.sh         # Tiến trình nền 8 giờ đo độ bền NFR-RL-04
    ├── bench_q5_q9_drag_drop.js            # Benchmark kéo thả, trễ con trỏ, quán tính
    ├── bench_q10_q16_screen_awareness.js   # Benchmark quyền truy cập cửa sổ, caret, foreground
    ├── bench_q17_q19_non_interference.js   # Benchmark FR-INT-04 gõ 200 ký tự khi pet di chuyển
    ├── bench_q20_q22_state_motion.js       # Benchmark Rive state machine & lật thẻ hội thoại
    └── bench_q23_q30_edge_cases.js         # Benchmark ca biên & trả focus về app trước
```

---

## 3. Quy trình chạy và tái hiện các bài test

```bash
# 1. Khởi động app Electron Pet Liveness
./spikes/SP-18-pet-liveness/macos/src/start_electron.sh

# 2. Chạy lần lượt các bộ kiểm thử tự động
node spikes/SP-18-pet-liveness/macos/src/bench_q0_architecture.js
node spikes/SP-18-pet-liveness/macos/src/bench_q1_motion.js
node spikes/SP-18-pet-liveness/macos/src/bench_q2_q4_boundary.js
node spikes/SP-18-pet-liveness/macos/src/measure_durability_slope.js
node spikes/SP-18-pet-liveness/macos/src/bench_q5_q9_drag_drop.js
node spikes/SP-18-pet-liveness/macos/src/bench_q10_q16_screen_awareness.js
node spikes/SP-18-pet-liveness/macos/src/bench_q17_q19_non_interference.js
node spikes/SP-18-pet-liveness/macos/src/bench_q20_q22_state_motion.js
node spikes/SP-18-pet-liveness/macos/src/bench_q23_q30_edge_cases.js

# 3. Khởi động tiến trình đo độ bền 8 giờ chạy nền
nohup ./spikes/SP-18-pet-liveness/macos/src/run_8h_durability_daemon.sh > /dev/null 2>&1 &
```
