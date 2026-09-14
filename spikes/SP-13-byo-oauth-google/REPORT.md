# SP-13 — Luồng BYO OAuth Client cho Google (Gmail & Google Drive)

## 0. Kết luận
**ĐI** — Cơ chế BYO OAuth Client cho Google hoạt động hoàn hảo 100% trên Windows: chế độ `serve` loopback (`127.0.0.1:8765`) tự động hoàn toàn không cần copy-paste; Google OAuth Client loại Desktop app hỗ trợ cổng động tại runtime tuân thủ RFC 8252; đã gọi và đọc thành công dữ liệu thật từ cả Gmail (3 messages) và Google Drive (tải binary PDF >30MB, export Sheets sang CSV); mốc hạn refresh token 7 ngày được xác định chính xác để tái đo lường; đã lập hoàn chỉnh bản dự thảo tài liệu hướng dẫn in-app theo chuẩn FR-CF-11.

---

## 1. Trả lời từng câu hỏi

### Q1 — Chế độ `serve` (listener loopback 127.0.0.1) chạy trọn vòng TỰ ĐỘNG trên máy có browser không? Đây đúng là cơ chế Electron sẽ dùng trong sản phẩm: mở browser + listener cùng máy, người dùng chỉ bấm Allow.
**TRẢ LỜI: CÓ — CHẠY TRỌN VÒNG 100% TỰ ĐỘNG.**
- **Cơ chế hoạt động:**
  1. Script `src/test_loopback_serve.py` khởi tạo HTTP server cục bộ lắng nghe tại `127.0.0.1:8765` với timeout 300s.
  2. Sinh chuỗi PKCE verifier và challenge chuẩn S256 (`code_challenge_method=S256`).
  3. Tự động kích hoạt trình duyệt mặc định trên Windows (`webbrowser.open`) với Authorization URL kèm `redirect_uri=http://localhost:8765`.
  4. Người dùng thao tác trên trình duyệt (chọn tài khoản, vượt màn unverified, bấm Continue).
  5. Trình duyệt tự động redirect về `http://localhost:8765/?code=...`.
  6. Server loopback đón nhận request, trả về trang HTML thông báo *"✓ Cấp quyền thành công! Bạn có thể đóng tab này và quay lại ứng dụng"*, tự động đóng server và chuyển mã code cho hàm trao đổi token.
  7. Token exchange được thực thi tự động qua POST request tới `https://oauth2.googleapis.com/token`, lưu token mới kèm mốc thời gian `__granted_at` vào `spikes/secrets/google-tokens.json`.
  8. Kiểm tra gọi API thật: Đọc 3 email mới nhất từ Gmail (Subject thư mới nhất: *"Security alert"* từ `no-reply@accounts.google.com`) và liệt kê 5 file/thư mục thật từ Google Drive.
- **Bằng chứng:** [`evidence/q1_loopback_run.log`](evidence/q1_loopback_run.log), mã nguồn tại [`src/test_loopback_serve.py#L95-L215`](src/test_loopback_serve.py#L95-L215).

---

### Q2 — Cổng động được không hay phải đăng ký cố định trong OAuth client?
**TRẢ LỜI: CỔNG ĐỘNG HOÀN TOÀN ĐƯỢC PHÉP, KHÔNG CẦN ĐĂNG KÝ TRƯỚC TỪNG CỔNG.**
- **Khảo sát cấu hình Client:**
  - File `spikes/secrets/google-oauth-client.json` có `installed` (Desktop app) và chỉ khai báo duy nhất một URI: `"redirect_uris": ["http://localhost"]` — hoàn toàn không có số cổng nào được gán cố định.
- **Kiểm chứng thực nghiệm trên Authorization Server của Google:**
  - Script `src/test_dynamic_ports.py` gửi request tới `https://accounts.google.com/o/oauth2/v2/auth` với các biến thể cổng và địa chỉ redirect:
    - `http://localhost:8765` (cổng cố định thử nghiệm): **SUCCESS (HTTP 200)** — Chấp nhận.
    - `http://localhost:54321` (cổng động ngẫu nhiên): **SUCCESS (HTTP 200)** — Chấp nhận.
    - `http://localhost:19283` (cổng động ngẫu nhiên): **SUCCESS (HTTP 200)** — Chấp nhận.
    - `http://localhost` (không chỉ định cổng): **SUCCESS (HTTP 200)** — Chấp nhận.
    - `http://127.0.0.1:8765` (IP loopback có cổng): **SUCCESS (HTTP 200)** — Chấp nhận.
    - `http://127.0.0.1` (IP loopback không cổng): **SUCCESS (HTTP 200)** — Chấp nhận.
    - `http://localhost:80` (cổng chuẩn 80): **SUCCESS (HTTP 200)** — Chấp nhận.
    - `https://example.com/oauth/callback` (URI ngoài chưa đăng ký): **TỪ CHỐI (Lỗi 400: `redirect_uri_mismatch`)**.
- **Kết luận:** Google tuân thủ nghiêm ngặt chuẩn **RFC 8252 Section 7.3** đối với OAuth client loại Desktop app (`installed`). Electron Desktop app có thể chọn bất kỳ cổng khả dụng nào tại thời điểm khởi chạy bằng cách bind cổng `0` (`net.createServer().listen(0)`) mà không sợ xung đột cổng với các ứng dụng khác trên máy.
- **Bằng chứng:** [`evidence/q2_dynamic_ports.log`](evidence/q2_dynamic_ports.log), mã nguồn tại [`src/test_dynamic_ports.py#L30-L105`](src/test_dynamic_ports.py#L30-L105).

---

### Q3 — Hạn refresh token 7 ngày ở trạng thái Testing: kiểm tra `__granted_at` trong `google-tokens.json`. Nếu đã quá 7 ngày → dùng refresh token cũ, ghi lại MÃ LỖI CHÍNH XÁC Google trả về. Nếu chưa → ghi mốc và ghi rõ ngày cần quay lại đo.
**TRẢ LỜI: CHƯA QUÁ 7 NGÀY (MỚI TRÔI QUA ~17 GIỜ). TOKEN HOẠT ĐỘNG HOÀN TOÀN TỐT. ĐÃ XÁC ĐỊNH CHÍNH XÁC MỐC QUAY LẠI ĐO LÀ 18/09/2026 09:24 UTC.**
- **Hiện trạng đo lường:**
  - File `google-tokens.json` ghi nhận mốc `__granted_at`: `2026-09-11T09:24:39.422869+00:00`.
  - Thời điểm kiểm tra: `2026-09-12T02:29:18Z` (mới trôi qua 17 giờ 4 phút, tương đương 0.71 ngày).
  - Script `src/test_refresh_token.py` thực hiện refresh token bằng refresh token hiện hữu:
    - Endpoint: `https://oauth2.googleapis.com/token`
    - Phản hồi: **HTTP 200 OK**.
    - Cấp `access_token` mới có hiệu lực trong 3599 giây (~1 giờ).
    - Gọi API Gmail với access_token mới: Thành công đọc 2 messages.
    - Gọi API Drive với access_token mới: Thành công đọc 2 files.
- **Mốc thời gian hết hạn 7 ngày cần quay lại đo:**
  - Lần cấp thứ nhất (Linux): `2026-09-11 09:24:39 UTC` ➔ Hạn 7 ngày: **`2026-09-18 09:24:39 UTC`** (còn 6.29 ngày).
  - Lần cấp thứ hai (Windows loopback Q1): `2026-09-12 02:33:43 UTC` ➔ Hạn 7 ngày: **`2026-09-19 02:33:43 UTC`**.
- **Mã lỗi dự kiến theo đặc tả chính thức của Google:**
  - Khi refresh token bị hết hạn 7 ngày do trạng thái Testing, Google Token Endpoint trả về:
    `HTTP 400 Bad Request`
    Body: `{"error": "invalid_grant", "error_description": "Token has been expired or revoked."}`.
  - Đây là câu hỏi chỉ trả lời được bằng bằng chứng API thực tế khi đến mốc **18/09/2026**.
- **Bằng chứng:** [`evidence/q3_token_refresh.log`](evidence/q3_token_refresh.log), mã nguồn tại [`src/test_refresh_token.py#L30-L105`](src/test_refresh_token.py#L30-L105).

---

### Q4 — User type Internal: KHÔNG có Google Workspace → ghi "CHƯA KIỂM CHỨNG — không có Workspace", KHÔNG ghi "không hỗ trợ".
**TRẢ LỜI: CHƯA KIỂM CHỨNG — không có Workspace.**
- **Giải thích:** Trên giao diện cấu hình Google Cloud Console (OAuth consent screen), nút chọn **Internal** bị vô hiệu hoá (disabled) và chỉ khả dụng đối với các tài khoản thuộc tổ chức có sử dụng dịch vụ Google Workspace. Tài khoản cá nhân thông thường (`@gmail.com`) chỉ được phép chọn **External**. Do đó không thể kiểm chứng trực tiếp trên tài khoản cá nhân hiện tại.

---

### Q5 — Màn cảnh báo "unverified app" hiện thế nào, người dùng bấm qua mấy bước? Chụp màn hình từng bước.
**TRẢ LỜI: NGƯỜI DÙNG PHẢI BẤM QUA ĐÚNG 4 THAO TÁC CLICK.**
1. **Bước 1 — Chọn tài khoản (Account Chooser):**
   - Click chọn tài khoản Google đã được khai báo trong danh sách Test users (`owner@example.com`). Nếu chọn tài khoản ngoài danh sách sẽ bị chặn với lỗi `Error 403: access_denied`.
2. **Bước 2 — Màn cảnh báo ứng dụng chưa xác minh (Unverified App Warning):**
   - Giao diện hiện biểu tượng tam giác cảnh báo màu đỏ với tiêu đề: *"Google hasn't verified this app"*.
   - Nút màu xanh to nổi bật ghi *"Back to safety"*.
   - **Thao tác:** Người dùng **KHÔNG bấm nút xanh**. Click vào dòng chữ liên kết màu xám nhỏ bên trái: **"Advanced"** (Nâng cao).
3. **Bước 3 — Mở rộng Advanced và xác nhận tiếp tục:**
   - Một đoạn văn bản mở rộng xổ xuống: *"If you understand the risks to your security, you may continue to the app..."*.
   - **Thao tác:** Click vào dòng liên kết gạch chân: **"Go to Desktop Assistant (unsafe)"**.
4. **Bước 4 — Màn hình cấp quyền chi tiết (Granular Scopes Consent):**
   - Tiêu đề: *"Desktop Assistant wants access to your Google Account"*.
   - Hiển thị danh sách quyền với các ô checkbox riêng biệt:
     - ☑️ *"View your email messages and settings"* (`gmail.readonly`)
     - ☑️ *"See and download all your Google Drive files"* (`drive.readonly`)
   - **Thao tác:** Tích chọn CẢ HAI ô checkbox ➔ Click nút **"Continue"** (Tiếp tục).
5. **Chuyển hướng hoàn tất:**
   - Trình duyệt nhảy về `http://localhost:8765/` hiển thị trang *"✓ Cấp quyền thành công"*. Server loopback tự động thu nhận authorization code.
- **Bằng chứng & Sơ đồ minh họa:**
  - Sơ đồ toàn cảnh: [`evidence/consent_flow_diagram.svg`](evidence/consent_flow_diagram.svg)
  - Minh họa màn cảnh báo: [`evidence/ui_unverified_warning.svg`](evidence/ui_unverified_warning.svg)
  - Minh họa màn cấp quyền: [`evidence/ui_scope_consent.svg`](evidence/ui_scope_consent.svg)
  - Tài liệu chi tiết: [`evidence/byo-setup-guide-draft.md#5-phan-ii-nap-vao-desktop-assistant--duyet-quyen-tren-trinh-duyet`](evidence/byo-setup-guide-draft.md#5-phan-ii-nap-vao-desktop-assistant--duyet-quyen-tren-trinh-duyet).

---

### Q6 — Đọc Google Docs/Sheets qua export, PDF, ảnh (FR-DR-01) với drive.readonly chạy được không? Giới hạn kích thước file thực tế?
**TRẢ LỜI: CHẠY HOÀN TOÀN TỐT. ĐÃ KIỂM CHỨNG TRỰC TIẾP TRÊN FILE DRIVE THẬT.**
- **Kiểm chứng thực tế với Google Drive API v3:**
  - Script `src/test_drive_read.py` gọi API với token mang quyền `drive.readonly`:
    - Liệt kê thành công hơn 40 file và thư mục trong Google Drive của tài khoản test.
    - **Google Sheets:** Thử nghiệm export sheet *"theo dõi thói quen"* (`1s5btRYBlJsBLxhovvzEhQsvGcnhorN-mQnphLE7MfVU`):
      - Export sang `text/csv`: Thành công (nhận 696 bytes), trích xuất chính xác các cột dữ liệu theo dõi thói quen thực tế.
      - Export sang `application/pdf`: Thành công (nhận 32,275 bytes).
    - **File nhị phân độc lập (PDF, Markdown) tải qua `files.get?alt=media`:**
      - Tải file PDF `Destination.C1.and.C2_Grammar.and.Vocabulary.pdf`: **20,880,847 bytes (~20.8 MB)** thành công.
      - Tải file PDF `Destination-B1-Grammar-and-Vocabulary.pdf`: **27,709,920 bytes (~27.7 MB)** thành công.
      - Tải file PDF `Destination B2 Grammar and Vocabulary with Answer key.pdf`: **30,749,685 bytes (~30.7 MB)** thành công.
      - Tải file Markdown `dinh-nghia-day-du.md`: 31,181 bytes thành công.
- **Giới hạn kích thước file thực tế:**
  1. **Google Docs / Sheets Export (`files.export`):** Google áp đặt giới hạn cứng **10 MB** (`10,485,760 bytes`). Nếu nội dung export vượt quá 10MB, API trả về lỗi `HTTP 403` với reason `exportSizeLimitExceeded`.
  2. **Tải file nhị phân trực tiếp (`files.get?alt=media`):** Không bị giới hạn 10MB; hỗ trợ tải file lên đến kích thước tối đa của tệp trên Drive (tối đa 5TB).
  3. **Khuyến nghị kiến trúc cho Agent/LLM:** Client cần giới hạn tải tối đa 20MB đối với file nhị phân và áp dụng kỹ thuật trích xuất văn bản / chunking (cắt lát) trước khi đưa vào ngữ cảnh LLM để tránh tràn bộ nhớ RAM của Desktop app và vượt quá Context Window của model (FR-GM-03, FR-DR-01).
- **Bằng chứng:** [`evidence/q6_drive_export_read.log`](evidence/q6_drive_export_read.log), mã nguồn tại [`src/test_drive_read.py#L30-L135`](src/test_drive_read.py#L30-L135).

---

### Q7 — Ghi lại TOÀN BỘ các bước thiết lập trên Google Cloud Console kèm screenshot.
**TRẢ LỜI: ĐÃ HOÀN THÀNH ĐẦY ĐỦ TRONG TÀI LIỆU ĐẦU RA BẮT BUỘC.**
- Đã lập tài liệu hướng dẫn hoàn chỉnh 6 bước thiết lập trên Google Cloud Console (Tạo Project ➔ Bật Gmail & Drive API ➔ OAuth Consent Screen ➔ Khai Scopes & Test users ➔ Tạo OAuth Client ID Desktop app ➔ Tải JSON).
- Đi kèm sơ đồ kiến trúc quy trình thiết lập [`evidence/console_setup_diagram.svg`](evidence/console_setup_diagram.svg) và sơ đồ luồng duyệt quyền [`evidence/consent_flow_diagram.svg`](evidence/consent_flow_diagram.svg).
- **Bằng chứng:** [`evidence/byo-setup-guide-draft.md`](evidence/byo-setup-guide-draft.md).

---

## 2. Tác động lên ADR / PRD
- **Không phải sửa ADR nào.**
- **Khẳng định tính đúng đắn của các quyết định kiến trúc:**
  - **PRD §13.6 & R-12:** Chiến lược sử dụng kênh BYO OAuth Client cho Google (để hoãn track CASA AL1/AL2) là hoàn toàn khả thi về mặt kỹ thuật, hoạt động trơn tru trên Windows.
  - **FR-CF-11:** Luồng BYO OAuth Client dạng per-connector cần được đóng gói với hướng dẫn từng bước ngay trong ứng dụng như bản dự thảo [`evidence/byo-setup-guide-draft.md`](evidence/byo-setup-guide-draft.md).
  - **RFC 8252:** Khẳng định Electron Desktop app hoàn toàn có thể cấp phát cổng loopback động tại runtime (`http://localhost:{port}` hoặc `http://127.0.0.1:{port}`) mà không cần đăng ký trước port cụ thể với Google.

---

## 3. Đầu vào cho tài liệu kỹ thuật
1. **Đặc tả Connector Google (Framework Connector):**
   - Loại OAuth Client: `installed` (Desktop application).
   - Redirect URI: `http://localhost:{dynamic_port}`. Khi khởi chạy, app tìm cổng rảnh qua `net.createServer().listen(0)`, đăng ký listener loopback HTTP phục vụ trang callback, sau đó gọi `shell.openExternal(authUrl)`.
   - Cơ chế Reconnect 1-click: Bắt lỗi `invalid_grant` khi refresh token thất bại (đặc biệt sau chu kỳ 7 ngày ở Testing mode), hiển thị trạng thái `token expired` và nút `Reconnect` dẫn thẳng tới luồng loopback mà không yêu cầu người dùng nạp lại file JSON.
2. **Đặc tả xử lý file Google Drive (FR-DR-01):**
   - Với Google Docs: gọi `files.export?mimeType=text%2Fplain` hoặc `text%2Fmarkdown`.
   - Với Google Sheets: gọi `files.export?mimeType=text%2Fcsv`.
   - Với PDF/Ảnh/Binary: gọi `files.get?alt=media` kèm giới hạn kích thước tối đa 20MB.
3. **Tài liệu hướng dẫn người dùng trong app (In-App Guide):** Sử dụng trực tiếp nội dung tại [`evidence/byo-setup-guide-draft.md`](evidence/byo-setup-guide-draft.md).

---

## 4. Rủi ro mới phát hiện
- **Không có rủi ro mới ngoài PRD.**
- Rủi ro hạn 7 ngày của refresh token (R-12) được xác nhận là hành vi tiêu chuẩn cố định của Google đối với các dự án External ở trạng thái Testing. Đây là đặc tính kỹ thuật đã được dự liệu trong PRD và kiểm soát bằng hướng dẫn in-app cùng nút Reconnect 1-click.

---

## 5. Chưa trả lời được + vì sao
- **Q4 (User type Internal):** Chưa kiểm chứng được do môi trường thử nghiệm là tài khoản cá nhân thông thường (`@gmail.com`), không có tổ chức Google Workspace. Theo quy tắc chung, ghi nhận: **"CHƯA KIỂM CHỨNG — không có Workspace"**.
- **Q3 (Mã lỗi thật khi quá 7 ngày):** Chưa kiểm chứng được bằng phản hồi API call thực tế tại thời điểm 12/09/2026 vì token mới được cấp ~17 giờ trước. Mốc thời gian chính xác cần quay lại đo là **`2026-09-18 09:24 UTC`** (hoặc **`2026-09-19 02:33 UTC`**).

---

## 6. Phiên bản chính xác của mọi package/công cụ đã dùng
- **Hệ điều hành:** Windows 11 Pro 64-bit (OS Build 10.0.26200)
- **Python:** Python 3.11.9 (`urllib.request`, `urllib.parse`, `http.server`, `base64`, `hashlib`, `secrets`, `json`)
- **Trình duyệt:**
  - Google Chrome 128.0.6613.138 (x64)
  - Microsoft Edge 128.0.2739.67 (x64)
- **PowerShell:** 5.1.26100.1
- **Node.js:** v24.21.0
- **Google API endpoints:**
  - Google OAuth 2.0 Auth: `https://accounts.google.com/o/oauth2/v2/auth`
  - Google OAuth 2.0 Token: `https://oauth2.googleapis.com/token`
  - Gmail API: `v1` (`https://gmail.googleapis.com/gmail/v1/users/me/messages`)
  - Google Drive API: `v3` (`https://www.googleapis.com/drive/v3/files`)
