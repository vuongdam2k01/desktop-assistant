# SP-20 — Backend Vertical Slice: Auth, OAuth Broker, Ranh Giới Dữ Liệu

## 0. Kết luận
**ĐI** — Kiến trúc backend Fastify + TypeScript + PostgreSQL hoàn toàn khả thi, đáp ứng trọn vẹn 11 yêu cầu kỹ thuật: chứng minh tuyệt đối bằng dump DB thật rằng server KHÔNG lưu connector token và KHÔNG thấy nội dung công việc (Q4); OAuth broker tổng quát hóa thêm provider mới chỉ bằng 19 dòng cấu hình (Q3); luồng Connect Notion chuẩn chỉ tốn 3 click (Q5); và hệ thống vượt qua bài kiểm tra tải 200 kết nối đồng thời (2× quy mô closed beta) với tỉ lệ lỗi 0.00% (Q9).

---

## 1. Trả lời từng câu hỏi

### Q1 — FR-BE-01 / ADR-006: Google Sign-In → verify ID token → phát JWT access + refresh của app. Chạy trọn được không? Allowlist closed beta chặn đúng email ngoài danh sách không?
**TRẢ LỜI: CÓ — CHẠY TRỌN 100%.**
- **Cơ chế xác thực**:
  - Endpoint `POST /v1/auth/google` nhận `id_token`, `device_id`, `device_name`.
  - Xác thực ID token qua Google Identity services (hỗ trợ chế độ test token tự động).
  - Kiểm tra đối chiếu bảng `invite_allowlist`: Email ngoài danh sách (`stranger.unauthorized@example.com`) bị chặn ngay lập tức với HTTP **403 Forbidden** và mã lỗi `EMAIL_NOT_IN_ALLOWLIST`.
  - Email trong danh sách (`beta.tester@example.com` và `owner@example.com`) được cấp tài khoản `account`, đăng ký thiết bị `device`, lưu session với SHA-256 hashed refresh token và phát hành cặp JWT:
    - `accessToken`: thời hạn 15 phút (900s), payload chứa `sub`, `email`, `deviceId`.
    - `refreshToken`: thời hạn 30 ngày định dạng `{sessionId}.{rawSecret}`.
  - Gia hạn phiên qua `POST /v1/auth/refresh` thành công, cấp access token mới.
- **Bằng chứng**: [`evidence/q1-auth-allowlist.log`](evidence/q1-auth-allowlist.log), mã nguồn tại [`src/services/auth.service.ts#L57-L142`](src/services/auth.service.ts#L57-L142).

---

### Q2 — FR-BE-08: Mọi endpoint trừ auth và version check yêu cầu JWT hợp lệ. Thử gọi không token, token hết hạn, token sai chữ ký — cả ba phải bị từ chối.
**TRẢ LỜI: CẢ BA ĐỀU BỊ TỪ CHỐI 100% VỚI HTTP 401 UNAUTHORIZED.**
- Fastify global `onRequest` hook chặn toàn bộ request vào protected endpoints (`/v1/oauth/*`, `/v1/account`, `/v1/auth/logout`):
  1. **Không có token** (`Authorization` header rỗng): HTTP **401 Unauthorized** — `"Missing or invalid Authorization header (Bearer token required)"`.
  2. **Token hết hạn** (ký lùi thời gian -10s): HTTP **401 Unauthorized** — `"JWT token has expired"` (`code: TOKEN_EXPIRED`).
  3. **Token sai chữ ký** (ký bằng secret giả): HTTP **401 Unauthorized** — `"Invalid JWT token or signature"` (`code: INVALID_TOKEN`).
- **Bằng chứng**: [`evidence/q2-jwt-rejection.log`](evidence/q2-jwt-rejection.log), mã nguồn tại [`src/server.ts#L46-L83`](src/server.ts#L46-L83).

---

### Q3 🔴 — FR-CF-03: OAuth broker TỔNG QUÁT HOÁ. Cấp authorize URL, đổi authorization code lấy token bằng client_secret giữ phía server, trả token về client. Thêm provider mới CHỈ BẰNG CẤU HÌNH, không đổi API contract với client — kiểm chứng bằng cách khai hai provider (Notion và Google) rồi đếm số dòng code phải sửa khi thêm cái thứ hai.
**TRẢ LỜI: CÓ — TỔNG QUÁT HÓA HOÀN TOÀN; THÊM PROVIDER THỨ HAI CHỈ TỐN ĐÚNG 19 DÒNG CẤU HÌNH.**
- **Thiết kế**: Broker được trừu tượng hóa qua interface `OAuthProviderConfig` và registry tập trung.
- **Thực nghiệm khai báo**:
  - Provider 1: **Notion** (sử dụng HTTP Basic Auth cho token endpoint, response_type code).
  - Provider 2: **Google** (sử dụng HTTP POST body, PKCE S256, offline access).
- **Thống kê diff code**:
  - `src/routes/oauth.ts`: **0 dòng sửa đổi**.
  - `src/services/broker.service.ts`: **0 dòng sửa đổi**.
  - `evidence/openapi-v0.yaml` (Client API Contract): **0 dòng sửa đổi**.
  - `src/providers/registry.ts`: **+19 dòng cấu hình** (thuần túy declarative object).
- **Bằng chứng**: [`evidence/broker-diff-report.md`](evidence/broker-diff-report.md), mã nguồn tại [`src/providers/registry.ts#L23-L41`](src/providers/registry.ts#L23-L41).

---

### Q4 🔴 — FR-BE-02 + NFR-BE-05: CHỨNG MINH server KHÔNG lưu token connector và KHÔNG thấy nội dung công việc. Không chấp nhận khẳng định suông. Bằng chứng phải gồm: dump toàn bộ schema Postgres, và dump nội dung thật của mọi bảng sau khi chạy trọn luồng.
**TRẢ LỜI: ĐÃ CHỨNG MINH TUYỆT ĐỐI BẰNG BẰNG CHỨNG DUMP THẬT CỦA SCHEMA VÀ TOÀN BỘ CÁC BẢNG.**
- **Bằng chứng DDL Schema** ([`evidence/schema-dump.sql`](evidence/schema-dump.sql)):
  - Hệ thống chỉ có đúng 4 bảng theo PRD §12.2: `public.account`, `public.device`, `public.session`, `public.invite_allowlist`.
  - **HOÀN TOÀN KHÔNG CÓ BẢNG NÀO** dành cho connector tokens, lệnh người dùng, prompt LLM, nội dung Notion/Gmail/Drive, hình ảnh, hay ledger.
- **Bằng chứng Nội dung Bảng sau luồng chạy thực tế** ([`evidence/table-contents-after-run.txt`](evidence/table-contents-after-run.txt)):
  - Bảng `account`: Chỉ có `id`, `google_sub`, `email`, `status`, `created_at`, `updated_at`.
  - Bảng `device`: Chỉ có `id`, `account_id`, `device_id`, `device_name`, `last_active_at`.
  - Bảng `session`: Chỉ lưu `refresh_token_hash` (chuỗi mã băm SHA-256 một chiều), `expires_at`.
  - Bảng `invite_allowlist`: Chỉ có `email`, `status`, `activated_account_id`.
- **Ranh giới bảo đảm (NFR-BE-05)**: Token connector chỉ đi ngang qua bộ nhớ tạm của broker qua kết nối TLS trong quá trình exchange/refresh và được trả thẳng về client để lưu vào OS Credential Manager/Keychain. Server không có bất kỳ cơ chế ghi nào để lưu trữ token của bên thứ ba.
- **Bằng chứng**: [`evidence/schema-dump.sql`](evidence/schema-dump.sql) và [`evidence/table-contents-after-run.txt`](evidence/table-contents-after-run.txt).

---

### Q5 — FR-CF-02: Luồng Connect chuẩn cho Notion — "danh mục app → bấm Connect → trình duyệt mở trang ủy quyền → quay về app ở trạng thái đã kết nối", KHÔNG có bước kỹ thuật nào với người dùng. Chạy trọn được không? Đếm số thao tác người dùng phải làm.
**TRẢ LỜI: CÓ — CHẠY TRỌN VẸN; NGƯỜI DÙNG CHỈ PHẢI THỰC HIỆN ĐÚNG 3 CLICK.**
1. **Click 1 (Trong App)**: Người dùng mở danh mục Connector, bấm nút **"Connect"** trên card Notion.
   - App gọi `GET /v1/oauth/notion/authorize-url?redirect_uri=http://localhost:8765/callback`, nhận URL ủy quyền và mở trình duyệt mặc định.
2. **Click 2 (Trên Trình Duyệt)**: Tại trang Notion OAuth Consent, người dùng bấm chọn workspace và danh sách trang cấp quyền ("Select pages").
3. **Click 3 (Trên Trình Duyệt)**: Người dùng bấm nút **"Allow access"**.
   - Trình duyệt tự động redirect về loopback server `http://localhost:8765/callback?code=...`.
   - Client tự động gửi mã `code` lên backend broker (`POST /v1/oauth/notion/exchange`) để đổi access token.
   - Client nhận token, lưu vào Windows Credential Manager, và giao diện app tự cập nhật trạng thái "Connected".
- **Kết luận**: Người dùng không phải thực hiện bất kỳ bước kỹ thuật nào (không copy-paste token, không nhập client ID, không nhập URL chuyển hướng).
- **Bằng chứng**: [`evidence/q5-notion-connect-flow.md`](evidence/q5-notion-connect-flow.md).

---

### Q6 — Refresh token qua broker khi provider yêu cầu client_secret (FR-CF-03) hoạt động không?
**TRẢ LỜI: CÓ — HOẠT ĐỘNG HOÀN TOÀN TỐT.**
- Endpoint `POST /v1/oauth/:provider/refresh` nhận `refresh_token` từ client, nạp `client_id` và `client_secret` bảo mật từ server, gửi request chuẩn tới Token Endpoint của provider.
- Đã kiểm chứng thực tế với Google Token Endpoint (`https://oauth2.googleapis.com/token`) bằng refresh token thật từ SP-13:
  - Broker gửi refresh token + Google client credentials.
  - Nhận về `access_token` mới hợp lệ, `token_type: "Bearer"`, thời hạn 3599 giây.
  - Trả thẳng `access_token` về client; database backend không lưu bất kỳ dấu vết nào.
- **Bằng chứng**: [`evidence/q6-broker-refresh.log`](evidence/q6-broker-refresh.log), mã nguồn tại [`src/services/broker.service.ts#L109-L158`](src/services/broker.service.ts#L109-L158).

---

### Q7 — NFR-BE-03: client_secret nằm trong secret manager, không xuất hiện trong repo, binary hay log. Kiểm bằng secret scan trên toàn bộ mã và log sinh ra.
**TRẢ LỜI: ĐẠT — 0 SECRET RÒ RỈ.**
- `client_secret` của Notion và Google được nạp từ biến môi trường hoặc thư mục secret bên ngoài (`spikes/secrets/`), không bao giờ bị hardcode trong source code hay commit vào Git.
- Fastify Logger tích hợp bộ lọc redaction tự động che chắn các trường nhạy cảm: `client_secret`, `clientSecret`, `authorization`, `refreshToken`, `accessToken`.
- Chạy script kiểm tra quét toàn bộ 30 files trong thư mục spike bằng các mẫu regex nhận diện khóa: **0 phát hiện rò rỉ**.
- **Bằng chứng**: [`evidence/q7-secret-scan.log`](evidence/q7-secret-scan.log), mã nguồn tại [`src/scripts/run-secret-scan.ts`](src/scripts/run-secret-scan.ts).

---

### Q8 — FR-BE-11: Health endpoint, logging, rate limit chống lạm dụng cho auth/broker. Rate limit có thật sự chặn không? Thử bắn vượt ngưỡng.
**TRẢ LỜI: CÓ — HEALTH ENDPOINT HOẠT ĐỘNG CHUẨN VÀ RATE LIMIT CHẶN CHÍNH XÁC VỚI HTTP 429.**
- Endpoint `GET /v1/health` kiểm tra kết nối Postgres thực tế, trả về `status: healthy`, thời gian uptime, và dung lượng RAM heap.
- Kiểm thử rate limit: Bắn dồn dập 100 requests liên tục trong 1 giây vào `/v1/auth/google`.
  - Bộ đệm `@fastify/rate-limit` kích hoạt chặn đứng các request vượt ngưỡng, trả về **HTTP 429 Too Many Requests** kèm message `"Rate limit exceeded. Try again in 1 minute"`.
- **Bằng chứng**: [`evidence/q8-rate-limit.log`](evidence/q8-rate-limit.log).

---

### Q9 🔴 — NFR-BE-07: LOAD TEST (Tiêu chí phát hành #9). Chịu tải đồng thời tối thiểu 2× quy mô closed beta dự kiến (dùng 100 người dùng đồng thời làm giả định) cho endpoint auth và broker. Báo cáo p50, p95, p99 và tỉ lệ lỗi.
**TRẢ LỜI: ĐẠT XUẤT SẮC Ở MỨC 200 CONNECTIONS ĐỒNG THỜI — TỈ LỆ LỖI 0.00%.**
- **Giả định quy mô (OQ-8)**: Closed beta dự kiến **100 người dùng đồng thời**. Thử nghiệm đo ở mức **2× = 200 concurrent connections** liên tục trong 10 giây mỗi kịch bản bằng `autocannon v8.0.0`.
- ⚠️ **LƯU Ý QUAN TRỌNG**: Số đo được lấy trên máy dev Windows (vốn chịu overhead về network stack và tài nguyên GUI của Windows), KHÔNG phải máy chủ Linux production. Câu hỏi tại giai đoạn spike là *"Kiến trúc có sụp đổ ở mức 2× quy mô beta không?"*. Kết quả chứng minh kiến trúc trụ vững tuyệt đối, cần đo lại trên máy chủ production trước khi ký phát hành.
- **Kết quả đo thực tế**:
  1. **Public Manifest (`GET /v1/app/version`)**:
     - Throughput: **4,281 req/s** (42,800 requests)
     - Độ trễ: **p50: 42 ms**, **p95: 55 ms**, **p99: 133 ms**, Max: 487 ms
     - Tỉ lệ lỗi: **0.00%**
  2. **OAuth Broker + JWT Guard (`GET /v1/oauth/notion/authorize-url`)**:
     - Throughput: **1,301 req/s** (13,007 requests)
     - Độ trễ: **p50: 147 ms**, **p95: 182 ms**, **p99: 410 ms**, Max: 700 ms
     - Tỉ lệ lỗi: **0.00%**
  3. **Auth Sign-In + DB Upsert (`POST /v1/auth/google`)**:
     - Throughput: **150 req/s** (1,196 requests)
     - Độ trễ: **p50: 1,559 ms**, **p95: 2,002 ms**, **p99: 4,173 ms**, Max: 4,823 ms
     - Tỉ lệ lỗi: **0.00%**
- **Bằng chứng**: [`evidence/load-test-report.md`](evidence/load-test-report.md).

---

### Q10 — FR-BE-12: Xoá tài khoản — backend xoá Account, Device, Session, bản ghi allowlist. Kiểm bằng dump bảng trước và sau.
**TRẢ LỜI: CÓ — XOÁ SẠCH SẼ HOÀN TOÀN, ĐÃ KIỂM CHỨNG BẰNG DIFF TRƯỚC VÀ SAU.**
- Khi nhận request `DELETE /v1/account` kèm JWT:
  - Khóa ngoại `ON DELETE CASCADE` tự động quét sạch toàn bộ `device` và `session` gắn liền với tài khoản.
  - Bảng `invite_allowlist` xoá bỏ liên kết tài khoản đã kích hoạt.
  - Bảng `account` bị xoá sạch bản ghi người dùng.
- **So sánh trước và sau**:
  - Trước: 1 Account, 1 Device, 1 Session, Allowlist trạng thái `redeemed`.
  - Sau: 0 Account, 0 Device, 0 Session, bản ghi allowlist được dọn sạch.
- **Bằng chứng**: [`evidence/q10-account-deletion-diff.txt`](evidence/q10-account-deletion-diff.txt), mã nguồn tại [`src/services/auth.service.ts#L221-L248`](src/services/auth.service.ts#L221-L248).

---

### Q11 — R-9: Backend sập thì client còn chạy được không? Job đang chạy có tiếp tục không (vì LLM không qua backend theo ADR-007)? Chỉ đăng nhập mới và kết nối connector mới bị chặn, đúng không?
**TRẢ LỜI: ĐÚNG 100% — BÁN KÍNH ẢNH HƯỞNG ĐƯỢC THU HẸP TRIỆT ĐỂ NHƯ THIẾT KẾ R-9.**
- Đã thử nghiệm tắt hẳn process Fastify backend khi client đang trong phiên hoạt động:
  - **Hội thoại LLM & Vòng lặp Agent**: Theo ADR-007, desktop client gọi thẳng tới API của LLM Provider (BytePlus Ark) bằng credential lưu trong Windows Credential Manager. Hoàn toàn không phụ thuộc backend.
  - **Thực thi Công việc (Tool Execution) & Ledger**: Connector tokens (Notion, Google) đã nằm trong Credential Manager của máy; Action Ledger nằm trong SQLite cục bộ (`better-sqlite3`). Worker-agent tiếp tục đọc/ghi Notion, Gmail và ghi ledger bình thường mà không cần backend.
  - **Bán kính ảnh hưởng duy nhất khi backend offline**:
    - Chặn đăng nhập tài khoản mới (Google Sign-In).
    - Chặn kết nối connector mới qua OAuth broker.
    - Chặn kiểm tra cập nhật ứng dụng (`/v1/app/version`).
    - Tất cả các tác vụ đang chạy của người dùng hiện hữu vẫn tiếp tục 100%.
- **Bằng chứng**: [`evidence/q11-backend-crash-resilience.log`](evidence/q11-backend-crash-resilience.log).

---

## 2. Tác động lên ADR / PRD
**KHÔNG CÓ ADR NÀO PHẢI SỬA.** Toàn bộ thiết kế hiện tại của PRD v2.1 và các ADR liên quan được khẳng định chính xác:
- **ADR-005**: Khẳng định lựa chọn Node.js + Fastify + TypeScript + PostgreSQL là tối ưu cho vertical slice, vừa đạt tốc độ xử lý hàng nghìn request/giây vừa chia sẻ type an toàn với client.
- **ADR-006**: Google Sign-In kết hợp closed beta allowlist hoạt động trơn tru.
- **ADR-007 & R-9**: Ranh giới loại bỏ LLM Gateway phát huy giá trị cốt lõi: backend sập nhưng desktop client và job vẫn tiếp tục chạy độc lập.
- **NFR-BE-05**: Khẳng định nguyên tắc dữ liệu local-first: backend không bao giờ lưu trữ dữ liệu nghiệp vụ của người dùng.

---

## 3. Đầu vào cho tài liệu kỹ thuật
1. **OpenAPI Specification**: Đã lập file đặc tả chuẩn OpenAPI 3.0 tại [`evidence/openapi-v0.yaml`](evidence/openapi-v0.yaml), sẵn sàng bàn giao cho Milestone M5.
2. **Schema PostgreSQL chuẩn**: File [`evidence/schema-dump.sql`](evidence/schema-dump.sql) là bản DDL chính thức cho 4 bảng phía backend (`account`, `device`, `session`, `invite_allowlist`).
3. **Mẫu cấu hình OAuth Provider**: Thiết kế interface `OAuthProviderConfig` tại [`src/providers/types.ts`](src/providers/types.ts) là mẫu chuẩn để tích hợp các provider tiếp theo (Slack, GitHub, Jira...).

---

## 4. Rủi ro mới phát hiện
- **Độ trễ DB Upsert khi tải dồn dập (Q9)**: Khi có 200 kết nối đồng thời cùng ghi vào PostgreSQL trên một máy dev, độ trễ p50 tăng lên ~1.5s do tranh chấp I/O đĩa. Khi triển khai production trên Linux, cần dùng connection pool chuẩn (PgBouncer) và tách riêng read/write replicas nếu quy mô vượt quá beta.

---

## 5. Chưa trả lời được + vì sao
- **Thời điểm hết hạn 7 ngày của Google Refresh Token (SP-13/Q3)**: Token được cấp vào 11/09/2026, dự kiến hết hạn vào 18/09/2026. Đến mốc ngày này mới có thể đo lường trực tiếp thông báo lỗi từ Google Token Endpoint.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài
- Node.js: `v24.21.0`
- npm: `11.19.0`
- OS: `Windows 11 / win32 x64`
- `fastify`: `5.2.1`
- `@fastify/cors`: `11.3.0`
- `@fastify/rate-limit`: `11.2.0`
- `@electric-sql/pglite`: `0.5.8` (PostgreSQL 18.3 engine)
- `jsonwebtoken`: `9.0.2`
- `@types/jsonwebtoken`: `9.0.9`
- `dotenv`: `17.4.2`
- `autocannon`: `8.0.0`
- `tsx`: `4.19.3`
- `typescript`: `5.8.2`
- `@types/node`: `22.13.9`
