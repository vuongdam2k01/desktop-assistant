# secrets/

Thư mục này chứa file credential dạng file (không phải biến môi trường).
Toàn bộ nội dung bị `.gitignore` loại trừ, trừ chính file README này.

| File | Nguồn | Spike dùng |
| --- | --- | --- |
| `google-oauth-client.json` | Google Cloud Console → Credentials → OAuth client ID loại **Desktop app** → Download JSON | SP-13 |

Kiểm tra nhanh file Google đúng loại: mở ra phải thấy key `installed` ở cấp cao
nhất. Nếu thấy `web` thì đã tạo nhầm loại client, tạo lại với Application type
là "Desktop app".
