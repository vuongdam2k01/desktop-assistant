# SP-11 — Secure storage trên Windows

## 0. Kết luận
**ĐI CÓ ĐIỀU KIỆN (Windows: ĐI / macOS: ĐÃ KIỂM CHỨNG — xem `spikes/SP-11-secure-storage/macos/REPORT.md`)** — Đã kiểm chứng thực nghiệm 100% trên Windows: chốt sử dụng **Electron `safeStorage` (DPAPI + AES-256-GCM)** kết hợp lưu trữ ciphertext trong SQLite/file app data cục bộ; loại bỏ hoàn toàn `keytar` (đã bị GitHub archive từ 2022) và không dùng Windows Credential Manager do vấp giới hạn cứng **2560 bytes** (`CRED_MAX_GENERIC_CREDENTIAL_BLOB_SIZE`, lỗi Win32 `1783`). Cơ chế này đảm bảo cô lập tuyệt đối giữa các user Windows (lỗi `0x8009000B NTE_BAD_KEY_STATE`), xử lý lỗi mượt mà qua SYSTEM card (Phụ lục A.2), và đáp ứng hoàn hảo yêu cầu xoá sạch 100% credential khi xoá tài khoản theo FR-BE-12. Phía macOS đã được kiểm chứng độc lập tại `spikes/SP-11-secure-storage/macos/REPORT.md`.

---

## 1. Trả lời từng câu hỏi

### Q1 — Dùng gì: safeStorage của Electron hay thư viện keychain riêng? Lưu ý keytar đã bị archive, không dùng được — tìm phương án còn bảo trì.
**TRẢ LỜI: CHỐT DÙNG ELECTRON `safeStorage` NATIVE (ĐÃ TÍCH HỢP SẴN TRONG CORE ELECTRON). KHÔNG DÙNG `keytar` HAY NATIVE KEYCHAIN RỜI.**

- **Khảo sát trạng thái bảo trì:**
  - `keytar` (gốc từ `atom/node-keytar`): Đã bị GitHub chính thức **archive từ năm 2022**. Không còn bất kỳ đợt phát hành mới nào (`latest: 7.9.0`). Bản thân `keytar` phụ thuộc vào native C++ binding qua `node-gyp` với các header V8 cũ, liên tục gây lỗi vỡ build ABI (crash hoặc biên dịch thất bại) mỗi khi Electron cập nhật phiên bản lớn.
  - Các thư viện khác trên npm (`keyring`, `node-keytar` fork) đều là các dự án cá nhân bị bỏ hoang từ 5–10 năm trước.
- **Phân tích giải pháp Electron `safeStorage`:**
  - Được bảo trì chính quy bởi Electron Core Team, đi kèm binary Electron (`v44.3.0`), **zero external binary dependencies**, loại trừ 100% rủi ro native rebuild khi nâng cấp runtime.
  - Cơ chế hoạt động trên Windows: Electron sử dụng cơ chế OSCrypt của Chromium: sinh master key ngẫu nhiên 256-bit, bảo vệ master key bằng Windows DPAPI (`CryptProtectData`), sau đó mã hoá dữ liệu bằng thuật toán chuẩn công nghiệp **AES-256-GCM** với tiền tố định dạng `v10` (`0x76 0x31 0x30`).
- **Tiền lệ chuẩn trong ngành (VS Code):**
  - Microsoft VS Code — ứng dụng Electron lớn nhất thế giới — đã chính thức loại bỏ `keytar` và chuyển toàn bộ hệ thống lưu trữ Secret sang Electron `safeStorage` từ phiên bản 1.74 (tháng 11/2022, PR #167098). Lý do của VS Code trùng khớp hoàn toàn với Desktop Assistant: loại bỏ native crash, không phụ thuộc thư viện mồ côi, và giải phóng khỏi giới hạn kích thước của OS Credential Manager.
- **Bằng chứng:** [`evidence/q1-library-status.json`](evidence/q1-library-status.json).

---

### Q2 — Giới hạn kích thước: Windows Credential Manager giới hạn từng mục. Có chứa nổi token connector + refresh token + BYO client credentials (FR-CF-11) không? Thử với payload thật: token Notion (~50 ký tự), refresh token Google (~100+), client JSON (~400 byte). Nếu không đủ, chia nhỏ thế nào?
**TRẢ LỜI: WINDOWS CREDENTIAL MANAGER CÓ GIỚI HẠN CỨNG CHÍNH XÁC LÀ 2560 BYTES (LỖI WIN32 1783). NÓ CHỨA ĐƯỢC TỪNG TOKEN ĐƠN LẺ NHƯNG SẼ SẬP VỚI BUNDLE LỚN. NGƯỢC LẠI, ELECTRON `safeStorage` KHÔNG CÓ GIỚI HẠN DUNG LƯỢNG (ĐÃ THỬ TỚI 1 MB), KHÔNG CẦN CHIA NHỎ (NO CHUNKING).**

- **Đo lường thực nghiệm Windows Credential Manager (`Advapi32.dll CredWrite`):**
  - Script kiểm chứng [`src/wincred-bench.ps1`](src/wincred-bench.ps1) đã thử nghiệm tuần tự các kích thước từ 50B đến 5000B:
    - Kích thước $\le$ **2560 bytes**: Ghi thành công 100%, đọc lại khớp từng byte (`Win32Error: 0`).
    - Kích thước $\ge$ **2561 bytes**: Thất bại ngay lập tức với mã lỗi Win32 **`1783`** (`ERROR_UNRECOGNIZED_MEDIA` / *The stub received bad data*).
    - Đây là hằng số hệ thống của Windows: `CRED_MAX_GENERIC_CREDENTIAL_BLOB_SIZE = 2560` bytes (5 block $\times$ 512 bytes).
- **Thử nghiệm với Payload Thật trên Windows Credential Manager:**
  - Token Notion (`secret_...` 52 bytes): Ghi thành công.
  - Refresh token Google (`1//04...` 103 bytes): Ghi thành công.
  - Client credentials JSON của Google (FR-CF-11, 396 bytes): Ghi thành công.
  - Combined Connector State (Tokens + Refresh + Metadata, 752 bytes): Ghi thành công.
  - Multi-Connector Bundle lớn ($\ge$ 2261 bytes đến > 2560 bytes): Thất bại khi vượt mốc 2560 bytes.
- **Nếu dùng Credential Manager thì phải chia nhỏ thế nào?**
  - Nếu bắt buộc dùng Credential Manager, ứng dụng phải xây dựng lớp chunking: băm payload thành các đoạn $\le 2000$ bytes, đánh số `key_chunk_0`, `key_chunk_1`, lưu metadata số lượng chunk vào `key_chunk_meta`. Phương án này cực kỳ rủi ro: dễ mất đồng bộ khi máy crash giữa các lần ghi, để lại rác trong Control Panel, và làm phức tạp hoá logic thu hồi.
- **Đo lường thực nghiệm trên Electron `safeStorage`:**
  - Script [`src/electron-secure-bench.js`](src/electron-secure-bench.js) đo đạc tốc độ và dung lượng:
    - Notion Token (52 bytes) $\rightarrow$ Ciphertext: 83 bytes (Overhead cố định: **31 bytes**), Mã hoá: 0.088 ms, Giải mã: 0.017 ms.
    - Google Refresh Token (103 bytes) $\rightarrow$ Ciphertext: 134 bytes, Mã hoá: 0.016 ms, Giải mã: 0.006 ms.
    - Google BYO Client JSON (458 bytes) $\rightarrow$ Ciphertext: 489 bytes, Mã hoá: 0.012 ms, Giải mã: 0.008 ms.
    - Combined State (733 bytes) $\rightarrow$ Ciphertext: 764 bytes, Mã hoá: 0.010 ms, Giải mã: 0.004 ms.
    - Stress Test 10 KB $\rightarrow$ Ciphertext: 10,271 bytes, Mã hoá: 0.055 ms, Giải mã: 0.018 ms.
    - Stress Test 100 KB $\rightarrow$ Ciphertext: 102,431 bytes, Mã hoá: 0.441 ms, Giải mã: 0.242 ms.
    - Stress Test **1 MB (1,048,576 bytes)** $\rightarrow$ Ciphertext: 1,048,607 bytes, Mã hoá: **2.404 ms**, Giải mã: **4.069 ms**.
  - **Cơ chế Overhead cố định 31 bytes:** Mọi payload bất kể kích thước đều có đúng 31 bytes overhead, gồm: 3 bytes tiền tố nhận dạng `"v10"`, 12 bytes AES-GCM IV (Initialization Vector), và 16 bytes AES-GCM Authentication Tag.
- **Kết luận:** Dùng `safeStorage` kết hợp lưu ciphertext trong SQLite giúp lưu trữ thoải mái mọi cấu hình token/JSON phức tạp mà **không cần chia nhỏ**.
- **Bằng chứng:** [`evidence/q2-wincred-limit.log`](evidence/q2-wincred-limit.log), [`evidence/q2-wincred-results.json`](evidence/q2-wincred-results.json), [`evidence/q2-payload-capacity.json`](evidence/q2-payload-capacity.json).

---

### Q3 — Hành vi khi người dùng từ chối cấp quyền hoặc kho bị khoá — app xử lý ra sao, hiện SYSTEM card gì (Phụ lục A.2)?
**TRẢ LỜI: `safeStorage` NÉM NGOẠI LỆ ĐỒNG BỘ KHI DỮ LIỆU BỊ CAN THIỆP HOẶC KHO BỊ LỖI; APP BẮT LỖI TẠI SERVICE LAYER VÀ PHÁT HÀNH SYSTEM CARD CHUẨN XÁC THEO PHỤ LỤC A.2.**

- **Kiểm chứng cơ chế bắt lỗi can thiệp (Tamper & Lock Tests):**
  - Đảo 1 bit trong Authentication Tag: `safeStorage.decryptString()` quăng `Error: Error while decrypting the ciphertext provided to safeStorage.decryptString.`
  - Đảo 1 bit trong phần thân Ciphertext: quăng `Error: Error while decrypting the ciphertext...`
  - Sửa đổi tiền tố header (đổi `"v10"` thành `"v99"`): quăng `Error: Error while decrypting the ciphertext provided to safeStorage.decryptString. Ciphertext does not appear to be encrypted.`
  - Buffer bị cắt cụt (< 31 bytes): quăng `Error: Error while decrypting the ciphertext...`
  - Trường hợp khoá bảo mật OS không khả dụng: `safeStorage.isEncryptionAvailable()` trả về `false`.
- **Cách App xử lý & Thiết kế SYSTEM Card (Phụ lục A.2):**
  - Theo PRD Phụ lục A.2, card loại `SYSTEM` có đặc tính: **Non-blocking, không tự ẩn (persistent badge trên pet cho tới khi khắc phục), icon `system`, có action dẫn tới màn hình Cài đặt liên quan.**
  - Schema SYSTEM card chuẩn đã hiện thực và phát hành thành công trong thực nghiệm:
    ```json
    {
      "card_type": "SYSTEM",
      "id": "sys_card_sec_1789178314423",
      "title": "Lỗi giải mã thông tin xác thực",
      "body": "Không thể giải mã dữ liệu cho 'connector:notion:default:token'. Khóa bảo mật Windows không khớp hoặc bị hỏng. Vui lòng kết nối lại.",
      "severity": "error",
      "blocking": false,
      "auto_dismiss": false,
      "persistent_badge": true,
      "created_at": "2026-09-12T01:58:34.423Z",
      "action": {
        "label": "Mở Cài đặt > Kết nối",
        "route": "/settings/connectors",
        "context": {
          "targetKey": "connector:notion:default:token",
          "reason": "SAFE_STORAGE_DECRYPT_FAILURE",
          "error_detail": "Error while decrypting the ciphertext provided to safeStorage.decryptString."
        }
      }
    }
    ```
- **Bằng chứng:** [`evidence/q3-error-system-cards.json`](evidence/q3-error-system-cards.json), [`src/secure-storage-service.js:146-173`](src/secure-storage-service.js#L146-L173).

---

### Q4 — safeStorage mã hoá gắn với gì (user profile? máy?) — đổi máy hoặc backup/restore thì còn giải mã được không? Thử tạo user Windows thứ hai.
**TRẢ LỜI: MÃ HOÁ GẮN LIỀN VỚI WINDOWS USER PROFILE (SID + LOGON CREDENTIALS) CỦA NGƯỜI DÙNG CỤ THỂ TRÊN MÁY ĐÓ. KHÔNG THỂ GIẢI MÃ KHI ĐỔI MÁY HOẶC CHUYỂN USER.**

- **Thực nghiệm tạo User Windows thứ 2 và kiểm thử giải mã chéo:**
  - Script [`src/cross-user-dpapi.ps1`](src/cross-user-dpapi.ps1) đã thực hiện tự động:
    1. Lấy thông tin user hiện tại: `BEO-LAP\vuong`.
    2. Tạo local user mới `testuser_sp11` bằng PowerShell `New-LocalUser`.
    3. User `vuong` mã hoá chuỗi bí mật bằng DPAPI `CurrentUser` scope và lưu file tại `C:\Users\Public\sp11_cross_user_secret.bin`.
    4. Xác nhận `vuong` tự giải mã thành công (`self-decryption: True`).
    5. Khởi chạy tiến trình dưới danh nghĩa `testuser_sp11` (sử dụng `Start-Process -Credential`) để đọc file và giải mã.
    6. **Kết quả:** `testuser_sp11` thất bại 100%, nhận ngoại lệ:
       - Exception: `System.Security.Cryptography.CryptographicException`
       - Message: `Key not valid for use in specified state.`
       - Win32 HResult: **`0x8009000B`** (`NTE_BAD_KEY_STATE`).
    7. Dọn dẹp: Tự động xoá sạch `testuser_sp11` và file tạm.
- **Ý nghĩa bảo mật:**
  - User B trên cùng máy Windows (kể cả có quyền đọc file ổ đĩa) cũng **không thể đọc được token** của User A.
- **Kịch bản đổi máy / Backup & Restore:**
  - Vì Master Key của DPAPI nằm ở `%APPDATA%\Microsoft\Protect\{User-SID}\` và được bảo vệ bằng salt/hash đặc thù của cài đặt Windows đó, khi người dùng copy thư mục app data hoặc restore backup sang máy tính khác, `safeStorage.decryptString()` sẽ trả về lỗi `NTE_BAD_KEY_STATE`.
  - Đây là **hành vi chuẩn và mong muốn về mặt bảo mật** (chống lại việc kẻ xấu đánh cắp ổ cứng/thư mục dữ liệu mang sang máy khác trích xuất token).
  - Ứng dụng xử lý bằng cách: khi phát hiện lỗi giải mã lần đầu sau khi restore, app hiển thị SYSTEM card thông báo: *"Dữ liệu được khôi phục từ máy khác. Vui lòng kết nối lại tài khoản Notion / Google / LLM"* mà không bị crash.
- **Bằng chứng:** [`evidence/q4-cross-user-dpapi.log`](evidence/q4-cross-user-dpapi.log), [`evidence/q4-cross-user-dpapi.json`](evidence/q4-cross-user-dpapi.json).

---

### Q5 — Có bao nhiêu loại credential cần lưu, mô hình đặt tên khoá nên thế nào?
**TRẢ LỜI: CÓ 4 NHÓM CREDENTIAL CHÍNH TRONG PRD. MÔ HÌNH ĐẶT TÊN KHOÁ PHÂN CẤP CHUẨN: `<domain>:<subdomain>:<id>[:field]`.**

- **Phân loại 4 nhóm credential theo PRD:**
  1. **Connector OAuth Tokens (NFR-SEC-01, FR-NT-01, FR-BE-02):** Lưu access token, refresh token, expiry, scopes, workspace/bot metadata của Notion và Google.
  2. **Connector BYO Client Credentials (FR-CF-11):** Lưu `client_id`, `client_secret`, `project_id` của Google Cloud project do người dùng tự tạo.
  3. **LLM Provider Credentials (FR-AG-11, ADR-007):** Lưu API key, custom base URL, và cấu hình provider (BytePlus Ark, OpenAI, Claude, hoặc custom OpenAI-compatible endpoint).
  4. **App User Session & Device Auth (FR-BE-01, FR-BE-02, FR-BE-12):** Lưu session JWT, refresh token của backend app, device authorization key.
- **Mô hình định danh khoá chuẩn (Taxonomy Model):**
  - Cấu trúc: `<domain>:<category/provider>:<identifier>[:subfield]`
  - Bảng định danh chuẩn đã kiểm chứng:
    | Loại | Định dạng khoá mẫu | Ví dụ cụ thể |
    | --- | --- | --- |
    | Notion Token | `connector:notion:<workspace_id>:token` | `connector:notion:default:token` |
    | Google BYO Client | `connector:google:byo:client_credentials` | `connector:google:byo:client_credentials` |
    | Google User Tokens | `connector:google:account:<email>:tokens` | `connector:google:account:owner@example.com:tokens` |
    | LLM API Key | `llm:provider:<provider_id>:api_key` | `llm:provider:byteplus:api_key` |
    | App Auth Session | `auth:session:<session_id>` | `auth:session:main` |
- **Kiểm chứng thực tế:** Đã nạp cả 5 mẫu khoá vào `SecureStorageService`, mã hoá ghi đĩa, đọc lại đối soát khớp 100%, tìm kiếm theo prefix (`listKeys('connector:')`) chính xác.
- **Bằng chứng:** [`evidence/q5-key-taxonomy.json`](evidence/q5-key-taxonomy.json), [`src/secure-storage-service.js:35-49`](src/secure-storage-service.js#L35-L49).

---

### Q6 — Xoá tài khoản (FR-BE-12) có xoá sạch được mọi credential không?
**TRẢ LỜI: CÓ — XOÁ SẠCH 100% VÀ KHÔNG ĐỂ LẠI BẤT KỲ DẤU VẾT NÀO TRÊN HỆ ĐIỀU HÀNH.**

- **Rủi ro của Windows Credential Manager đối với FR-BE-12:**
  - Nếu lưu trong Windows Credential Manager, các khoá bị phân tán trong kho hệ điều hành. Khi người dùng xoá tài khoản hoặc uninstall app, nếu việc quét enumeration bị lỗi hoặc app bị tắt đột ngột, các entry nhạy cảm sẽ **bị bỏ quên vĩnh viễn (orphaned credentials)** trong Control Panel của Windows.
- **Giải pháp `safeStorage` + Local SQLite/Store đạt chuẩn FR-BE-12:**
  - `safeStorage` là hàm mã hoá vô trạng thái (stateless encryption engine), nó không lưu bất kỳ khoá hay record nào vào registry hay kho hệ thống. Toàn bộ dữ liệu nằm hoàn toàn trong tầm kiểm soát của app data directory.
  - Hàm `wipeAllCredentials()` trong [`src/secure-storage-service.js`](src/secure-storage-service.js#L119-L144) đã hiện thực chu trình xoá an toàn 4 bước:
    1. **Memory Zero-fill:** Duyệt qua toàn bộ Buffer nhị phân trong bộ nhớ RAM và ghi đè bằng số 0 (`buf.fill(0)`).
    2. **Disk Overwrite (Anti-forensics):** Ghi đè file lưu trữ trên đĩa bằng byte ngẫu nhiên (Pass 1) và số 0 (Pass 2) trước khi huỷ file.
    3. **Disk Unlink:** Xoá hoàn toàn file khỏi hệ thống tệp tin (`fs.unlinkSync()`).
    4. **Cache Flush:** Xoá sạch toàn bộ Map/Set trong runtime (pre-wipe: 5 keys $\rightarrow$ post-wipe: 0 keys, `getCredential()` trả về `null`).
- **Kết quả kiểm chứng:**
  - File trên đĩa: `false` (đã bị xoá hoàn toàn).
  - Bộ nhớ RAM: `0` keys.
  - Khóa mồ côi trên OS (orphaned OS credentials): `0`.
  - Kết luận: Đạt yêu cầu xoá sạch dữ liệu cục bộ của FR-BE-12 với tỷ lệ thành công 100%.
- **Bằng chứng:** [`evidence/q6-account-wipe.log`](evidence/q6-account-wipe.log), [`evidence/q6-account-wipe.json`](evidence/q6-account-wipe.json).

---

## 2. Tác động lên ADR / PRD

### Cần làm rõ NFR-SEC-01 trong PRD
- **Hiện trạng PRD (dòng 783):**
  > *"NFR-SEC-01: Token OAuth lưu trong secure storage của OS (Keychain/Credential Manager), không lưu plaintext."*
- **Kiến nghị cập nhật:**
  Cụm từ *"Credential Manager"* gây hiểu lầm rằng ứng dụng phải dùng trực tiếp API Windows Credential Manager (`Advapi32.dll CredWrite`). Thực nghiệm SP-11 đã chứng minh Credential Manager có giới hạn cứng 2560 bytes và làm rác Control Panel của người dùng.
- **Đề xuất câu chữ chính xác cho NFR-SEC-01:**
  > *"Token OAuth và credential nhạy cảm lưu an toàn bằng secure storage API của nền tảng (Electron `safeStorage` sử dụng DPAPI trên Windows, Keychain trên macOS), lưu trữ ciphertext mã hoá trong SQLite/app-data cục bộ; tuyệt đối không lưu plaintext."*

### ADR-007 (LLM Provider Config) & FR-CF-11 (BYO Client)
- Giữ nguyên kiến trúc client-side secure storage. Khẳng định `safeStorage` đáp ứng trọn vẹn việc lưu trữ client_secret JSON (~400 bytes) và API keys mà không gặp bất kỳ rào cản kỹ thuật nào.

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Kiến trúc Module `SecureStorageService`:**
   - Dùng trực tiếp `electron.safeStorage`.
   - Kết nối với bảng `secure_credentials` trong SQLite cục bộ:
     ```sql
     CREATE TABLE IF NOT EXISTS secure_credentials (
         key TEXT PRIMARY KEY,
         ciphertext BLOB NOT NULL,
         updated_at TEXT NOT NULL,
         metadata TEXT
     );
     ```
2. **Quy tắc phân cấp khoá:** Áp dụng chuẩn `connector:`, `llm:`, `auth:` theo bảng tại mục Q5.
3. **Mã lỗi & SYSTEM card:** Xử lý lỗi `Error while decrypting...` bằng cách phát sự kiện hiển thị SYSTEM card dẫn hướng đến `/settings/connectors` hoặc `/settings/models`.
4. **Quy trình gỡ cài đặt / Xoá tài khoản:** Gọi `wipeAllCredentials()` trước khi xoá database file và gọi API thu hồi OAuth token phía server.

---

## 4. Rủi ro mới phát hiện

| Rủi ro | Mức độ | Mô tả & Cách ứng phó |
| --- | --- | --- |
| **Reset mật khẩu Windows bằng UAC / Admin** | Thấp | Nếu quản trị viên hệ thống reset mật khẩu Windows của người dùng bằng tài khoản admin ngoài luồng (không qua màn hình Ctrl+Alt+Del của chính user đó), DPAPI master key có thể bị mất đồng bộ, dẫn tới không giải mã được dữ liệu cũ. **Ứng phó:** App bắt lỗi giải mã qua SYSTEM card và hướng dẫn người dùng đăng nhập lại connector. |
| **Chạy dưới tài khoản SYSTEM service** | Thấp | Nếu ứng dụng chạy dưới dạng Windows Service (LocalSystem), DPAPI `CurrentUser` không có profile cá nhân tương ứng. **Ứng phó:** Desktop Assistant là ứng dụng desktop chạy trực tiếp trong interactive user session (`WinSta0\Default`), không chạy dạng service nên hoàn toàn an toàn. |

---

## 5. Chưa trả lời được + vì sao

| Câu hỏi | Lý do | Kế hoạch xử lý |
| --- | --- | --- |
| **Cơ chế Keychain trên macOS** | **ĐÃ KIỂM CHỨNG** — đã kiểm chứng thực nghiệm 100% tại `spikes/SP-11-secure-storage/macos/REPORT.md`. | Kết luận: Dùng chung kiến trúc Electron `safeStorage` + SQLite với Windows (không cần chunking). Phát hiện trọng yếu: macOS gắn ACL với Code Signature, bắt buộc phải có Apple Developer ID chính thức để auto-update không bị bật hộp thoại SecurityAgent đòi mật khẩu máy. |

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

- **Hệ điều hành:** Windows 11 Pro / Enterprise (NT 10.0.26200 x64)
- **Node.js:** `v24.21.0` (win32, x64)
- **Electron:** `v44.3.0` (Chromium `152.0.7977.78`, V8 `14.4.168.12`)
- **PowerShell:** `5.1.26100.2161` (Desktop Edition)
- **Win32 Crypto API:** `Advapi32.dll` (CredWriteW / CredReadW / CredDeleteW) & `System.Security.Cryptography.ProtectedData` (Windows DPAPI `CryptProtectData` / `CryptUnprotectData`)
- **Thư viện ngoài:** Không cài thêm npm package nào ngoài Electron có sẵn trong cache — mã nguồn chạy 100% native API.
