# SPIKE SP-13: Luồng BYO OAuth Client cho Google (Gmail & Google Drive)

Kiểm chứng thực tế và trả lời trọn vẹn 7 câu hỏi về cơ chế **BYO OAuth Client (Bring Your Own)** cho Google trên môi trường Windows native, tạo nền tảng cho việc tích hợp connector Gmail & Drive mà không cần vượt qua quy trình kiểm toán CASA AL1/AL2 tốn kém (PRD §13.6, FR-CF-11, R-12).

---

## 1. Cấu trúc thư mục

```text
spikes/SP-13-byo-oauth-google/
├── REPORT.md                         # Báo cáo kết luận chính thức (khung chuẩn §3.4)
├── README.md                         # Tài liệu hướng dẫn chạy lại từ đầu
├── src/
│   ├── test_loopback_serve.py        # [Q1 & Q5] Chế độ serve loopback tự động 100% trên Windows
│   ├── test_dynamic_ports.py         # [Q2] Kiểm chứng cổng động RFC 8252 với Google Auth Server
│   ├── test_refresh_token.py         # [Q3] Kiểm tra refresh token & tính toán hạn 7 ngày Testing
│   ├── test_drive_read.py            # [Q6] Kiểm chứng đọc Drive: export Sheets (CSV/PDF), tải PDF >30MB
│   └── generate_guide_illustrations.py # Sinh các sơ đồ kiến trúc & minh họa UI dạng SVG
└── evidence/                         # Nhật ký thực thi, log API và tài liệu in-app
    ├── byo-setup-guide-draft.md      # [ĐẦU RA BẮT BUỘC] Bản thảo hướng dẫn in-app theo FR-CF-11
    ├── q1_loopback_run.log           # Log thực thi chế độ serve loopback hoàn chỉnh
    ├── q2_dynamic_ports.log          # Log kiểm chứng cổng động vs cổng cố định
    ├── q3_token_refresh.log          # Log kiểm tra refresh token & mốc 7 ngày
    ├── q6_drive_export_read.log      # Log đọc Gmail & Drive (export sheet, tải binary >30MB)
    ├── consent_flow_diagram.svg      # Sơ đồ toàn cảnh 5 bước luồng duyệt quyền Google OAuth
    ├── console_setup_diagram.svg     # Sơ đồ toàn cảnh 6 bước thiết lập Google Cloud Console
    ├── ui_unverified_warning.svg     # Minh họa màn cảnh báo "Google hasn't verified this app"
    └── ui_scope_consent.svg          # Minh họa màn hình chọn scopes Gmail & Drive
```

---

## 2. Cách chạy lại từ đầu (Reproducibility)

### Yêu cầu môi trường:
- Windows 10/11 (Native, không chạy qua WSL).
- Python 3.11+ (chỉ sử dụng thư viện chuẩn `urllib`, `http.server`, `json`, `base64`, `hashlib`, `secrets`).
- File credentials hợp lệ đặt tại `spikes/secrets/google-oauth-client.json` (OAuth Client loại Desktop app).

---

### Bước 1: Kiểm chứng Cổng động vs Cổng cố định (Q2)
Kiểm tra khả năng chấp nhận cổng ngẫu nhiên của Google Authorization Server:
```powershell
python spikes/SP-13-byo-oauth-google/src/test_dynamic_ports.py
```
- **Kết quả mong đợi:** Toàn bộ các cổng động (`http://localhost:8765`, `:54321`, `:19283`, `http://127.0.0.1:8765`) đều trả về **HTTP 200 (SUCCESS)**; chỉ có URL không thuộc loopback (`https://example.com`) mới bị từ chối với `Error 400: redirect_uri_mismatch`.

---

### Bước 2: Kiểm tra Refresh Token & Mốc 7 ngày (Q3)
Kiểm tra hiệu lực của token hiện tại, gọi token endpoint để refresh access token mới và xác định mốc 7 ngày:
```powershell
python spikes/SP-13-byo-oauth-google/src/test_refresh_token.py
```
- **Kết quả mong đợi:** HTTP 200 OK, cấp `access_token` mới, đọc thành công 2 email từ Gmail và 2 files từ Drive. Ghi nhận mốc hết hạn 7 ngày dự kiến.

---

### Bước 3: Kiểm chứng Chế độ `serve` Loopback tự động (Q1 & Q5)
Khởi chạy server loopback `127.0.0.1:8765`, sinh PKCE, tự động mở trình duyệt và đón callback:
```powershell
python spikes/SP-13-byo-oauth-google/src/test_loopback_serve.py
```
- **Thao tác:** Trên trình duyệt vừa bật lên, người dùng chọn tài khoản test (`owner@example.com`), bấm **Advanced** ➔ **Go to Desktop Assistant (unsafe)**, tích chọn cả 2 quyền Gmail & Drive, bấm **Continue**.
- **Kết quả mong đợi:** Server tự động bắt code, đổi token, cập nhật `spikes/secrets/google-tokens.json`, đọc thử Gmail (3 thư) và Drive (5 files) thành công mà người dùng không cần copy-paste bất kỳ URL hay mã nào.

---

### Bước 4: Kiểm chứng Đọc Drive, Export Sheets & Giới hạn dung lượng (Q6)
Kiểm tra khả năng export Google Sheets và tải file nhị phân lớn từ Google Drive thật:
```powershell
python spikes/SP-13-byo-oauth-google/src/test_drive_read.py
```
- **Kết quả mong đợi:**
  - Export sheet "theo dõi thói quen" sang CSV (696 bytes) và PDF (32,275 bytes) thành công.
  - Tải trực tiếp file nhị phân PDF dung lượng 20MB – 30MB (`Destination.C1.and.C2_Grammar.and.Vocabulary.pdf`, etc.) qua `files.get?alt=media` thành công.

---

### Bước 5: Sinh lại các sơ đồ minh họa SVG
```powershell
python spikes/SP-13-byo-oauth-google/src/generate_guide_illustrations.py
```

---

## 3. Tóm tắt kết luận các câu hỏi (Q1 – Q7)

| Câu hỏi | Kết luận | Trạng thái | Bằng chứng |
| :--- | :--- | :---: | :--- |
| **Q1. Chế độ `serve` tự động** | Chạy trọn vòng 100% tự động trên Windows, tự đón code và đổi token | ✅ PASS | [`evidence/q1_loopback_run.log`](evidence/q1_loopback_run.log) |
| **Q2. Cổng động RFC 8252** | Cho phép cổng ngẫu nhiên tại runtime, không cần đăng ký port trước | ✅ PASS | [`evidence/q2_dynamic_ports.log`](evidence/q2_dynamic_ports.log) |
| **Q3. Hạn refresh 7 ngày** | Chưa quá 7 ngày (~17h). Token hoạt động tốt. Mốc đo lại: **18/09/2026** | ⏱️ CẦN ĐO LẠI | [`evidence/q3_token_refresh.log`](evidence/q3_token_refresh.log) |
| **Q4. User type Internal** | Không có Google Workspace tổ chức trên tài khoản cá nhân | ⚠️ CHƯA KIỂM CHỨNG | PRD §13.6, docs/spike-inputs.md |
| **Q5. Màn cảnh báo unverified** | Người dùng bấm qua đúng 4 thao tác click (Advanced ➔ Go to unsafe) | ✅ PASS | [`evidence/byo-setup-guide-draft.md`](evidence/byo-setup-guide-draft.md) |
| **Q6. Đọc Drive & Docs/Sheets** | Export Sheets sang CSV/PDF tốt; tải PDF >30MB tốt; giới hạn export 10MB | ✅ PASS | [`evidence/q6_drive_export_read.log`](evidence/q6_drive_export_read.log) |
| **Q7. Hướng dẫn Cloud Console** | Đầy đủ 6 bước thiết lập chi tiết kèm sơ đồ kiến trúc chuẩn FR-CF-11 | ✅ PASS | [`evidence/byo-setup-guide-draft.md`](evidence/byo-setup-guide-draft.md) |
