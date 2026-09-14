# Kiểm Chứng Q5 — Luồng Connect Chuẩn Cho Notion (FR-CF-02)

## 1. Kết quả kiểm tra endpoint cấp Authorize URL
- Endpoint: `GET /v1/oauth/notion/authorize-url?redirect_uri=http://localhost:8765/callback`
- Trạng thái: 200 OK
- Generated URL: `https://api.notion.com/v1/oauth/authorize?client_id=notion_sp20_client_id_placeholder&redirect_uri=http%3A%2F%2Flocalhost%3A8765%2Fcallback&state=06649886efade493fc6dc8ae632d09e8&owner=user&response_type=code`
- State: `06649886efade493fc6dc8ae632d09e8`

## 2. Đếm số thao tác người dùng (User Interaction Count)
Chu trình thực tế theo thiết kế FR-CF-02:
1. **Thao tác 1 (Trong App)**: Người dùng mở danh mục Connector, bấm nút **"Connect"** trên card Notion.
   -> Desktop client gọi backend lấy authorizeUrl và mở trình duyệt mặc định trên máy.
2. **Thao tác 2 (Trên Browser)**: Tại trang Notion OAuth Consent, người dùng click chọn workspace và trang muốn cấp quyền ("Select pages").
3. **Thao tác 3 (Trên Browser)**: Người dùng bấm nút **"Allow access"**.
   -> Notion tự động redirect về loopback listener của Desktop client (`http://localhost:8765/callback?code=...`).
   -> Desktop client tự động gửi code tới backend broker (`POST /v1/oauth/notion/exchange`) để đổi token.
   -> Token được nhận về và lưu vào Windows Credential Manager. App chuyển sang trạng thái "Đã kết nối".

**TỔNG SỐ THAO TÁC CỦA NGƯỜI DÙNG: ĐÚNG 3 CLICK.**
Người dùng hoàn toàn KHÔNG phải làm bất kỳ bước kỹ thuật nào: không copy token, không dán ID, không cấu hình URL hay port.
