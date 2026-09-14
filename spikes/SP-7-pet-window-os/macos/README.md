# SP-7/mac — Hành vi cửa sổ pet ở tầng OS (macOS)

Spike kiểm chứng hành vi cửa sổ Pet và Dialogue Card ở tầng hệ điều hành macOS (Apple Silicon arm64), đối chiếu trực tiếp với kết quả đo đạc trên Windows tại `spikes/SP-7-pet-window-os/REPORT.md`.

---

## 1. Chuẩn bị máy (Theo `SP-0/mac`)

Trước khi chạy kiểm thử, đảm bảo:
1. **Màn hình & Chống ngủ**:
   - Màn hình Mac mini bật, không khoá màn hình (`displaysleep 0`).
   - Ngăn máy tự ngủ: `caffeinate -dimsu &` hoặc thiết lập trong System Settings.
2. **Quyền TCC cho Antigravity**:
   - **Accessibility**: Đã cấp (cho phép bơm phím `CGEvent` và di chuột).
   - **Screen Recording**: Đã cấp (cho phép chụp màn hình qua `screencapture`).
3. **Môi trường**:
   - Node.js `v26.8.2` (arm64), Electron `v44.3.0` (arm64).
   - Xác nhận chạy native: `sysctl sysctl.proc_translated` trả `0`.

---

## 2. Cách chạy kiểm thử

### Chạy toàn bộ bài test tự động (Master Runner)
```bash
./spikes/SP-7-pet-window-os/macos/src/run_all_tests.sh
```

### Chạy từng bài test riêng lẻ

1. **Khởi động ứng dụng Pet Electron (nếu chưa chạy):**
   ```bash
   npx electron spikes/SP-7-pet-window-os/macos/src/electron-pet/main.js &
   ```

2. **Q1 — Kiểm chứng cướp focus (10 lần liên tiếp bơm 200 ký tự vào TextEdit):**
   ```bash
   ./spikes/SP-7-pet-window-os/macos/src/test-q1-focus.sh 10 panel show
   ```

3. **Q2 — Kiểm chứng click-through theo pixel (xuyên qua vùng trong suốt, nhận click ở thân pet):**
   ```bash
   ./spikes/SP-7-pet-window-os/macos/src/test-q2-clickthrough.sh
   ```

4. **Q3 — Kiểm chứng Always-On-Top đè ứng dụng Fullscreen & Spaces:**
   ```bash
   ./spikes/SP-7-pet-window-os/macos/src/test-q3-fullscreen.sh
   ```

5. **Q4 — Khảo sát màn hình & thuật toán Fallback tháo màn hình (E2):**
   ```bash
   ./spikes/SP-7-pet-window-os/macos/src/test-q4-multimonitor.sh
   ```

6. **Q5 — Kiểm chứng tự chọn hướng mở tại 4 góc & trừ Menu bar / Dock:**
   ```bash
   ./spikes/SP-7-pet-window-os/macos/src/test-q5-corners.sh
   ```

7. **Q7 — Kiểm chứng Dock, App Switcher (Cmd-Tab) và chuyển đổi chính sách 2 cửa sổ:**
   ```bash
   ./spikes/SP-7-pet-window-os/macos/src/test-q7-dock-switcher.sh
   ```

---

## 3. Cấu trúc thư mục

```
spikes/SP-7-pet-window-os/macos/
├── README.md                           # Tài liệu hướng dẫn chuẩn bị và thực thi
├── REPORT.md                           # Báo cáo kết luận chi tiết (Q1-Q7, đối chiếu Windows)
├── package.json                        # Cấu hình Electron runner
├── src/
│   ├── electron-pet/                   # Prototype Electron macOS (Pet, Card, Fullscreen, Tray)
│   │   ├── main.js
│   │   ├── preload.js
│   │   ├── index.html
│   │   ├── card.html
│   │   ├── fullscreen.html
│   │   ├── style.css
│   │   └── icon.png
│   ├── test-q1-focus.sh                # Script test 10 lần gõ phím không cướp focus
│   ├── test-q2-clickthrough.sh         # Script test click-through theo pixel
│   ├── test-q3-fullscreen.sh           # Script test always-on-top trên fullscreen & Spaces
│   ├── test-q4-multimonitor.sh         # Script test khảo sát hiển thị & fallback E2
│   ├── test-q5-corners.sh              # Script test adaptive corner orientation 4 góc
│   ├── test-q7-dock-switcher.sh        # Script test Dock & Cmd-Tab activation policy
│   └── run_all_tests.sh                # Script chạy toàn bộ test
└── evidence/                           # Log và ảnh chụp màn hình kiểm chứng thị giác
    ├── q1-expected-200chars.txt
    ├── q1-focus-summary.log
    ├── q1-focus-editor-during-popup.png
    ├── q2-clickthrough.log
    ├── q2-clickthrough.png
    ├── q3-fullscreen.log
    ├── q3-fullscreen-simple.png
    ├── q3-fullscreen-native.png
    ├── q3-mission-control.png
    ├── q4-multimonitor.log
    ├── q5-corners.log
    ├── q5-corner-top-left.png
    ├── q5-corner-top-right.png
    ├── q5-corner-bottom-left.png
    ├── q5-corner-bottom-right.png
    ├── q6-tray-notification.png
    ├── q7-dock-switcher.log
    ├── q7-dock-hidden.png
    └── q7-dock-visible.png
```
