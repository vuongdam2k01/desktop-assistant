# SP-0/mac — Hạ tầng chạy spike GUI trên macOS

Hạ tầng tự động hoá GUI cho các spike macOS (`SP-3/mac`, `SP-7/mac`, `SP-11/mac`, `SP-18/mac`), chạy trực tiếp trong session đồ hoạ của Antigravity trên Apple Silicon (Mac mini).

---

## 1. Chuẩn bị máy (BẮT BUỘC TRƯỚC MỌI SESSION)

Trước khi mở bất kỳ session spike macOS nào, kỹ sư hoặc người vận hành phải hoàn tất các bước chuẩn bị thủ công sau trên Mac mini:

### 1.1. Tắt khoá màn hình và chống ngủ (Sleep & Screen Lock)
Máy Mac mini để bàn có thể tự tắt màn hình sau 10 phút mặc định (`displaysleep 10`), làm gián đoạn việc chụp màn hình hoặc ngắt kết nối GUI trong các bài test chạy dài (như soak test 8 giờ của `SP-18/mac`).
- **Thực hiện trong System Settings**:
  - Vào **System Settings > Lock Screen**:
    - *Turn display off on adapter when inactive*: Đặt thành **Never**.
    - *Require password after screen saver begins or display turns off*: Đặt thành **Never**.
  - Vào **System Settings > Energy Saver**:
    - Bật tuỳ chọn *Prevent automatic sleeping when the display is off*.
- **Hoặc thực hiện qua Terminal**:
  ```bash
  sudo pmset -a displaysleep 0 sleep 0 disksleep 0
  ```
- **Chống ngủ tức thời trong session chạy dài**:
  ```bash
  caffeinate -dimsu &
  ```

### 1.2. Cấu hình màn hình gắn vào máy
- **Độ phân giải**: `1920 x 1080` (1080p FHD).
- **Tần số quét**: `60.00 Hz`.
- **Hệ số Scale (Backing Scale Factor)**: `1.00` (1 logical point = 1 physical pixel).
- **Số màn hình**: 1 màn hình duy nhất.
> *Cảnh báo*: Không thay đổi độ phân giải hoặc cắm thêm màn hình giữa loạt spike macOS để đảm bảo kết quả đo đạc toạ độ và thị giác có thể đối soát nhất quán.

### 1.3. Cấp quyền TCC (Privacy & Security) cho tiến trình Agent
Toàn bộ chuỗi lệnh gọi công cụ của Antigravity có tiến trình gốc là:
`/Volumes/Antigravity/Antigravity.app` (hoặc `/Applications/Antigravity.app` nếu đã chép vào Applications).

Cần đảm bảo cấp đủ 2 quyền sống còn trong **System Settings > Privacy & Security**:
1. **Accessibility (Trợ năng)**:
   - Thêm và bật công tắc cho **Antigravity**.
   - *Tác dụng*: Cho phép agent gửi sự kiện bàn phím/chuột qua `CGEventPost` và `osascript keystroke` (kiểm tra bằng `AXIsProcessTrusted()` trả về `1`).
   - *Hiệu lực*: Ngay lập tức khi gạt switch, **không cần khởi động lại app**.
2. **Screen & System Audio Recording (Ghi màn hình & âm thanh hệ thống)**:
   - Thêm và bật công tắc cho **Antigravity**.
   - *Tác dụng*: Cho phép agent chụp toàn màn hình (`screencapture`), chụp theo Window ID (`screencapture -l <wid>`), và đọc danh sách tiêu đề cửa sổ qua `CGWindowListCopyWindowInfo`.
   - *Hiệu lực*: Cần chấp nhận hộp thoại hệ thống hoặc chọn "Later" / khởi động lại app nếu macOS yêu cầu.

---

## 2. Bộ 3 script tái sử dụng (`macos/src/`)

Các spike sau (`SP-3/mac`, `SP-7/mac`, `SP-11/mac`, `SP-18/mac`) sử dụng lại trực tiếp 3 script này:

### 2.1. `src/launch`
Khởi động ứng dụng GUI, chờ cửa sổ xuất hiện, kích hoạt ra tiền cảnh (focus), và in thông tin cửa sổ.
```bash
# Mở app theo tên:
./macos/src/launch --app TextEdit

# Mở app theo bundle ID:
./macos/src/launch --bundle com.apple.TextEdit

# Chạy lệnh tuỳ biến:
./macos/src/launch --cmd "/path/to/electron app.js"

# Xuất kết quả dạng JSON:
./macos/src/launch --app TextEdit --json
# Output: {"id": 629, "layer": 0, "owner": "TextEdit", "title": "Untitled", "x": 213, "y": 77, "w": 586, "h": 488}
```

### 2.2. `src/screenshot`
Chụp ảnh màn hình ra file PNG sắc nét:
```bash
# Chụp toàn màn hình:
./macos/src/screenshot --full /path/to/screenshot.png

# Chụp theo Window ID cụ thể (loại bỏ bóng viền cửa sổ):
./macos/src/screenshot --wid 629 /path/to/window.png

# Chụp theo tên ứng dụng sở hữu cửa sổ:
./macos/src/screenshot --app TextEdit /path/to/textedit.png

# Liệt kê các cửa sổ đang hiển thị trên màn hình:
./macos/src/screenshot --list
./macos/src/screenshot --list --json
```

### 2.3. `src/sendkeys`
Bơm sự kiện phím, phím tắt, di chuột và click chuột:
```bash
# Bơm chuỗi văn bản Unicode (sử dụng CGEvent, an toàn 100% với tiếng Việt có dấu):
./macos/src/sendkeys --text "Tiếng Việt có dấu: Trăm năm trong cõi người ta"

# Gửi tổ hợp phím tắt (cmd shift opt ctrl key):
./macos/src/sendkeys --combo 1 0 0 0 s   # Cmd + S
./macos/src/sendkeys --combo 1 0 0 0 q   # Cmd + Q

# Gửi phím đặc biệt:
./macos/src/sendkeys --key return
./macos/src/sendkeys --key esc
./macos/src/sendkeys --key delete

# Thao tác chuột theo toạ độ Logical Points (Quartz):
./macos/src/sendkeys --mouse-move 450 320
./macos/src/sendkeys --mouse-click 680 510
./macos/src/sendkeys --mouse-dclick 500 400
```

---

## 3. Chạy bài test khép kín (Closed-Loop Test)

Bài test tự động mở TextEdit, bơm 200 ký tự mẫu (chứa tiếng Việt có dấu và ký tự đặc biệt), chụp màn hình, lưu file và kiểm tra khớp 200/200 ký tự (100% bit-by-bit):
```bash
./macos/src/run_closed_loop_test.sh
```
Kết quả kiểm tra sẽ được ghi vào `evidence/closed-loop-run.log` và ảnh chụp tại `evidence/closed-loop-textedit.png`.

---

## 4. Cấu trúc thư mục

```
spikes/SP-0-gui-harness/macos/
├── README.md               # Hướng dẫn chuẩn bị máy và sử dụng hạ tầng
├── REPORT.md               # Báo cáo kết quả nghiên cứu và kiểm chứng (Q1-Q9)
├── src/
│   ├── launch              # Script khởi động app GUI & lấy window ID
│   ├── screenshot          # Script chụp màn hình (toàn màn / window ID / app)
│   ├── sendkeys            # Script bơm phím Unicode & thao tác chuột
│   ├── harness_helper.m    # Mã nguồn C/Objective-C native CoreGraphics / AppKit
│   ├── bin/
│   │   └── harness_helper  # Binary ARM64 biên dịch native
│   └── run_closed_loop_test.sh # Kịch bản chạy bài test khép kín 200 ký tự
└── evidence/
    ├── closed-loop-run.log
    ├── closed-loop-textedit.png
    ├── closed-loop-textedit-output.txt
    ├── q1-electron-screenshot.png
    ├── q1-fullscreen-screenshot.png
    ├── q1-textedit-screenshot.png
    ├── q3-cgevent-output.txt
    ├── q3-osascript-output.txt
    ├── q3-comparison.log
    ├── q4-mouse-test.log
    ├── q5-display-config.log
    ├── q6-sleep-survey.log
    ├── q7-toolchain-survey.log
    └── permission-prompts/
        ├── screen-recording-prompt.png
        └── accessibility-granted.png
```
