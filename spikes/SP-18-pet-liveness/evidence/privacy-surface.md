# BÁO CÁO PHÂN TÍCH BỀ MẶT RIÊNG TƯ (PRIVACY SURFACE REPORT) — SP-18 / Q15

## 1. Bối cảnh & Phát biểu Vấn đề
Để pet trở thành một "thực thể sống" có khả năng phản ứng với môi trường desktop (đậu lên mép cửa sổ đang dùng, né vùng đang gõ, chỉ tay vào ứng dụng vừa tương tác), hệ thống bắt buộc phải thu thập dữ liệu về các cửa sổ đang mở trên hệ điều hành qua Win32 API (`EnumWindows`, `GetWindowText`, `SetWinEventHook EVENT_SYSTEM_FOREGROUND`).

Tuy nhiên, việc đọc tiêu đề cửa sổ (`Window Title`) mở ra một bề mặt rò rỉ dữ liệu nhạy cảm cực kỳ lớn, vi phạm nghiêm trọng nguyên tắc **NFR-SEC-02 (Quyền riêng tư & Bảo vệ dữ liệu)** nếu không có ranh giới kiểm soát chặt chẽ.

---

## 2. Danh mục CHÍNH XÁC những gì Win32 API đọc được từ môi trường

Dựa trên kết quả chạy thực nghiệm `[NativeLiveness.Helper]::EnumerateWindows()` ghi nhận tại [`evidence/q10-window-enumeration.json`](q10-window-enumeration.json), hệ thống có thể đọc được tức thì các trường dữ liệu sau từ bất kỳ cửa sổ nào của người dùng:

| Trường dữ liệu | Nguồn API Win32 | Mức độ nhạy cảm | Minh chứng thực tế đọc được trên máy |
| --- | --- | --- | --- |
| **Window Title** | `GetWindowTextW` | 🔴 **CỰC KỲ NGUY HIỂM** | Đọc được chính xác nội dung tab trình duyệt: `"Xuyên Thành Thái Hậu, Ta Chỉ Muốn Nằm Yên Hưởng Phúc! - YouTube - Google Chrome"`, tên file văn bản: `"*Hello Caret Tracking World - Notepad"`, tên dự án/code trong IDE. |
| **Process Name** | `GetWindowThreadProcessId` + `Process.ProcessName` | 🟡 **TRUNG BÌNH** | Tên tiến trình thực thi: `chrome`, `Notepad`, `Code`, `slack`, `telegram`. Tiết lộ danh mục phần mềm người dùng đang cài đặt. |
| **Process ID (PID)** | `GetWindowThreadProcessId` | 🟢 **THẤP** | Số nguyên PID hệ điều hành (ví dụ: `20044`, `17964`). |
| **Window Rect** | `GetWindowRect` | 🟢 **THẤP / AN TOÀN** | Toạ độ hình học `(X, Y, Width, Height)`. Chỉ mô tả kích thước không gian trên màn hình. |
| **Window Class** | `GetClassNameW` | 🟢 **THẤP / AN TOÀN** | Định danh lớp cửa sổ Win32 (ví dụ: `Notepad`, `Chrome_WidgetWin_1`). |
| **Foreground State**| `GetForegroundWindow` / WinEvent | 🟡 **TRUNG BÌNH** | Cho biết cửa sổ nào đang được người dùng chủ động tương tác. |
| **Caret Position** | `GetGUIThreadInfo` / UI Automation | 🟢 **AN TOÀN** | Toạ độ điểm `(X, Y)` nơi con trỏ nhấp nháy trên màn hình. Không chứa ký tự người dùng gõ. |

### Các rủi ro riêng tư cụ thể khi đọc thô `Window Title`:
1. **Lộ URL / Thói quen duyệt web:** Tab trình duyệt Chrome/Edge/Firefox luôn hiển thị tiêu đề trang web (ví dụ: tên tài khoản ngân hàng, video YouTube cá nhân, tiêu đề email công việc, bệnh án tra cứu y tế).
2. **Lộ dữ liệu khách hàng & hợp đồng:** Tên tài liệu Word/PDF/Excel thường đặt theo mẫu `[Hợp đồng] - Khách hàng ABC - 2026.docx`.
3. **Lộ bí mật kinh doanh / source code:** Tên file và nhánh git trong IDE (VS Code, Cursor, JetBrains).
4. **Lộ tin nhắn riêng tư:** Ứng dụng chat (Telegram, Zalo, Slack) thường để tên người chat hoặc tên nhóm trên titlebar.

---

## 3. Đề xuất Ranh giới Tối thiểu Đủ dùng (Minimum Viable Privacy Boundary)

Để thỏa mãn yêu cầu "Pet phản ứng thông minh" mà **TUYỆT ĐỐI KHÔNG vi phạm NFR-SEC-02**, kiến trúc M3 phải áp dụng nguyên tắc **Zero-Persistent Title & Strict Minimization**:

```
┌──────────────────────── Win32 Kernel ────────────────────────┐
│ EnumWindows / GetWindowText / GetWindowRect / CaretPosition   │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌────────────────── Native Privacy Filter Layer ───────────────┐
│ 1. Trích xuất Bounds (X, Y, W, H) & Caret (X, Y) -> CHO QUA  │
│ 2. Trích xuất ProcessName ('chrome', 'notion')   -> CHO QUA  │
│ 3. Window Title thô                              -> BỊ CHẶN   │
│    ├── Chỉ đối chiếu Regex trên RAM để phân loại connector   │
│    └── TUYỆT ĐỐI KHÔNG gửi về Agent / LLM / Ledger           │
└──────────────────────────────┬───────────────────────────────┘
                               │ Clean Data Only
                               ▼
┌───────────────────── Pet Liveness Engine ────────────────────┐
│ - Né vùng gõ phím dựa trên toạ độ Caret (X, Y)                │
│ - Đậu lên mép cửa sổ dựa trên Window Rect                     │
│ - Chỉ tay vào Notion dựa trên ProcessName == 'notion'        │
└──────────────────────────────────────────────────────────────┘
```

### Chi tiết 4 nguyên tắc ranh giới:

1. **Ranh giới 1: Dữ liệu hình học được phép dùng tự do ở client:**
   - Toạ độ cửa sổ (`WindowRect`) và toạ độ con trỏ (`CaretPosition`) chỉ là các con số pixel trên màn hình, hoàn toàn vô hại về mặt nội dung. Được phép dùng thời gian thực để pet né chuột, né chỗ gõ và bám mép.

2. **Ranh giới 2: Phân loại theo ProcessName thay vì Window Title:**
   - Để biết người dùng đang mở Notion hay Chrome, pet engine chỉ cần đọc `ProcessName` (`notion.exe`, `chrome.exe`).
   - `ProcessName` không chứa thông tin nội dung của người dùng.

3. **Ranh giới 3: Quy tắc "Ephemeral In-Memory Title Matching":**
   - Trong trường hợp cực kỳ cần thiết (ví dụ: phân biệt tab Notion chạy trên trình duyệt Chrome với các tab khác), việc đọc `Window Title` **chỉ được diễn ra trong bộ nhớ RAM của module Native Rust**, chỉ kiểm tra khớp chuỗi `EndsWith("Notion - Google Chrome")` để trả về cờ boolean `isNotionTab: true`.
   - Toàn bộ chuỗi tiêu đề gốc phải bị huỷ ngay lập tức sau khi kiểm tra, không được lưu vào biến, không emit qua IPC lên Renderer.

4. **Ranh giới 4: Cấm tuyệt đối đưa Window Title vào Action Ledger và Telemetry:**
   - Không bản ghi `ledger` nào được phép lưu tiêu đề cửa sổ người dùng.
   - Không gửi tiêu đề cửa sổ lên server hay qua bất kỳ API phân tích nào.

---

## 4. Kết luận & Khuyến nghị cho M3
- **Tính khả thi:** ĐẠT. Ta có thể triển khai 100% tính năng của Nhóm C (đậu lên mép cửa sổ, né chỗ gõ, chỉ tay vào app) **mà không cần lưu trữ hay đọc nội dung tiêu đề nhạy cảm của người dùng**.
- **Đầu vào chính sách dữ liệu:** Đề xuất đưa trực tiếp bảng phân loại và 4 nguyên tắc trên vào tài liệu kỹ thuật bảo mật `docs/security-spec.md` và chính sách dữ liệu người dùng cho MVP.
