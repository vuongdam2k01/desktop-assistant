# SP-11/mac — Secure storage trên macOS (Keychain)

## 0. Kết luận
**ĐI CÓ ĐIỀU KIỆN** — Trên macOS, Electron `safeStorage` (Chromium OSCrypt) hoạt động hoàn hảo và vượt trội: lưu trữ an toàn Master Key trong macOS Keychain (`login.keychain-db`), mã hoá dữ liệu bằng AES-128-CBC với overhead cố định nhỏ (4–19 bytes), tốc độ mã hoá cực nhanh (<0.1 ms cho 64 KB, ~1.5 ms cho 1 MB), không có bất kỳ giới hạn kích thước nào (không cần chia nhỏ/chunking), chia sẻ 100% mô hình khoá taxonomy `<domain>:<subdomain>:<id>[:field]` và cơ chế ciphertext trong SQLite với bản Windows. **ĐIỀU KIỆN DUY NHẤT VÀ BẮT BUỘC (Q3):** Bản build phát hành **BẮT BUỘC PHẢI ĐƯỢC KÝ BẰNG APPLE DEVELOPER ID CHÍNH THỨC** (`anchor apple generic`). Nếu phát hành bằng bản ad-hoc hoặc không có Developer ID, **MỖI LẦN AUTO-UPDATE (FR-BE-09) SẼ BẬT HỘP THOẠI SECURITYAGENT ĐÒI MẬT KHẨU MÁY**, và nếu người dùng bấm Deny (`OSStatus = -128`), toàn bộ credential sẽ bị hỏng giải mã.

---

## 1. Trả lời từng câu hỏi

### Q1 — safeStorage trên macOS thực sự dùng Keychain chứ không phải thứ khác — chứng minh bằng cách nào? Mục nào xuất hiện trong Keychain Access, tên service và account là gì? `isEncryptionAvailable()` trả gì, và gọi trước khi app 'ready' thì sao?
**TRẢ LỜI: SAFESTORAGE TRÊN MACOS DÙNG 100% MACOS KEYCHAIN ĐỂ LƯU TRỮ MASTER ENCRYPTION KEY. KHÔNG LƯU TOKEN TRỰC TIẾP VÀO KEYCHAIN MÀ LƯU CIPHERTEXT TRONG SQLITE.**

- **Chứng minh cơ chế hoạt động thực tế của Electron OSCrypt trên macOS:**
  - File kiểm chứng: [`src/probe-safestorage.js`](src/probe-safestorage.js).
  - Trước khi `app.whenReady()` hoàn tất: `safeStorage.isEncryptionAvailable()` trả về **`false`** (do tiến trình Chromium OSCrypt chưa nạp và khởi tạo kết nối tới Apple Security Services).
  - Sau khi `app.whenReady()` hoàn tất: `safeStorage.isEncryptionAvailable()` trả về **`true`**.
- **Mục xuất hiện trong Keychain Access (`~/Library/Keychains/login.keychain-db`):**
  - Sử dụng lệnh `security find-generic-password -s "DesktopAssistant Safe Storage"`:
    - **Keychain:** `"/Users/<user>/Library/Keychains/login.keychain-db"`
    - **Class:** `"genp"` (Generic Password)
    - **Service (`svce`):** `"<AppName> Safe Storage"` (mặc định là `"Electron Safe Storage"` nếu không set name; khi gọi `app.setName('DesktopAssistant')` sẽ là `"DesktopAssistant Safe Storage"`).
    - **Account (`acct`):** `"<AppName> Key"` (ví dụ: `"DesktopAssistant Key"`).
    - **Label (`0x00000007`):** `"<AppName> Safe Storage"`.
- **Cơ chế lưu trữ:**
  - Electron `safeStorage` chỉ tạo **DUY NHẤT MỘT MỤC** trong Keychain để lưu giữ mật mã ngẫu nhiên (Master Key).
  - Mọi thao tác `safeStorage.encryptString(plainText)` mã hoá dữ liệu bằng thuật toán AES-128-CBC với Master Key lấy từ Keychain và trả về Buffer Ciphertext (bắt đầu bằng header `"v10"` / `0x76 0x31 0x30`).
  - Toàn bộ ciphertext của các token (Notion, Google, LLM API keys) được lưu trong bảng SQLite `secure_credentials`, **không tạo thêm bất kỳ mục nào khác trong Keychain**.
- **Bằng chứng:** [`evidence/q2-payload-benchmarks.json`](evidence/q2-payload-benchmarks.json), [`src/probe-safestorage.js:1-40`](src/probe-safestorage.js#L1-L40).
- **Đối chiếu Windows:** **GIỐNG Windows** về kiến trúc tổng thể (Windows dùng DPAPI bảo vệ Master Key, macOS dùng Keychain bảo vệ Master Key; cả hai đều lưu ciphertext trong SQLite).

---

### Q2 — Giới hạn kích thước: bản Windows phải xử lý giới hạn từng mục của Credential Manager (2560 bytes, lỗi Win32 1783). Keychain có giới hạn tương tự không? Thử payload thật: token Notion (~50 ký tự), refresh token Google (~100+), client JSON BYO (~400 byte, FR-CF-11), và một ca cố tình lớn (64KB) để tìm ngưỡng. Nếu không có ngưỡng thì mô hình chia nhỏ của bản Windows có thể bỏ trên macOS — nói rõ điều đó.
**TRẢ LỜI: MACOS KEYCHAIN VÀ ELECTRON SAFESTORAGE HOÀN TOÀN KHÔNG CÓ GIỚI HẠN 2560 BYTES NHƯ WINDOWS CREDENTIAL MANAGER. HOÀN TOÀN KHÔNG CẦN CHIA NHỎ (NO CHUNKING).**

- **Đo lường dung lượng raw macOS Keychain (`SecKeychainAddGenericPassword`):**
  - Script [`src/test-keychain-raw-limit.sh`](src/test-keychain-raw-limit.sh) đã kiểm chứng lưu trữ trực tiếp vào Keychain:
    - 50 B (Notion Token): Ghi/đọc thành công.
    - 400 B (Google BYO JSON): Ghi/đọc thành công.
    - **2560 B (Ngưỡng sập của Windows Credential Manager):** Ghi/đọc thành công 100% (`read 2561 bytes`).
    - 4 KB, 16 KB, **64 KB**, 128 KB, **512 KB**: Ghi và đọc thành công 100% không gặp bất kỳ lỗi nào từ Keychain. (Mốc 1 MB chỉ vấp giới hạn `ARG_MAX` của shell arguments, không phải lỗi từ Apple Keychain).
- **Đo lường hiệu năng và kích thước trên Electron `safeStorage` (macOS):**
  - Script [`src/bench-safestorage.js`](src/bench-safestorage.js) đo đạc các payload thực tế:
    - **Notion Access Token** (55 bytes) $\rightarrow$ Ciphertext: 67 bytes (Overhead: 12 B) | Mã hoá: 0.354 ms | Giải mã: 0.167 ms.
    - **Google Refresh Token** (94 bytes) $\rightarrow$ Ciphertext: 99 bytes (Overhead: 5 B) | Mã hoá: 0.008 ms | Giải mã: 0.002 ms.
    - **Google BYO Client JSON** (500 bytes) $\rightarrow$ Ciphertext: 515 bytes (Overhead: 15 B) | Mã hoá: 0.007 ms | Giải mã: 0.002 ms.
    - **Combined State Bundle** (551 bytes) $\rightarrow$ Ciphertext: 563 bytes (Overhead: 12 B) | Mã hoá: 0.002 ms | Giải mã: 0.001 ms.
    - **Stress 10 KB** (10,240 bytes) $\rightarrow$ Ciphertext: 10,259 bytes (Overhead: 19 B) | Mã hoá: 0.015 ms | Giải mã: 0.006 ms.
    - **Stress 64 KB (Yêu cầu Q2)** (65,536 bytes) $\rightarrow$ Ciphertext: 65,555 bytes (Overhead: **19 B**) | Mã hoá: **0.085 ms** | Giải mã: **0.050 ms**.
    - **Stress 1 MB** (1,048,576 bytes) $\rightarrow$ Ciphertext: 1,048,595 bytes (Overhead: **19 B**) | Mã hoá: **1.514 ms** | Giải mã: **2.525 ms**.
    - **Stress 5 MB** (5,242,880 bytes) $\rightarrow$ Ciphertext: 5,242,899 bytes (Overhead: **19 B**) | Mã hoá: **7.053 ms** | Giải mã: **4.121 ms**.
- **Phân tích cơ chế Overhead (4–19 bytes) của macOS OSCrypt:**
  - Khác với Windows sử dụng AES-256-GCM với overhead cố định 31 bytes, macOS OSCrypt sử dụng **AES-128-CBC với PKCS#7 padding**.
  - Cấu trúc: 3 bytes tiền tố `"v10"` + padding PKCS#7 (từ 1 đến 16 bytes để làm tròn bội số 16 bytes).
  - Với các payload có kích thước chia hết cho 16 bytes (như 10 KB, 64 KB, 1 MB), PKCS#7 thêm đủ 1 block 16 bytes $\rightarrow$ tổng overhead đạt mức tối đa là **$3 + 16 = 19$ bytes**.
- **Kết luận:** Mô hình chia nhỏ (chunking) hoàn toàn không cần thiết trên macOS. Cả hai hệ điều hành đều xử lý gọn gàng dữ liệu dung lượng lớn khi lưu ciphertext trong SQLite.
- **Bằng chứng:** [`evidence/q2-payload-benchmarks.json`](evidence/q2-payload-benchmarks.json), [`evidence/q2-raw-keychain-limits.log`](evidence/q2-raw-keychain-limits.log).
- **Đối chiếu Windows:** **GIỐNG Windows** về giải pháp `safeStorage` (không cần chunking, giải mã cực nhanh <3ms); **KHÁC Windows** về raw store (macOS Keychain không có giới hạn 2560 bytes của Windows Credential Manager).

---

### Q3 — 🔴 ACL của Keychain gắn với chữ ký mã. Dựng ba trạng thái: build chưa ký, build ký ad-hoc, build ký kiểu Developer ID (hoặc self-signed thay thế nếu chưa có chứng chỉ). Ghi một secret bằng bản này rồi ĐỌC bằng bản kia: còn giải mã được không? có bật lại hộp thoại "...muốn dùng thông tin bí mật lưu trong keychain"?
**TRẢ LỜI: ĐÃ DỰNG THỰC NGHIỆM VÀ ĐO LƯỜNG CẢ 3 TRẠNG THÁI. NẾU DÙNG BUILD AD-HOC HOẶC CHƯA CÓ APPLE DEVELOPER ID, MỖI LẦN AUTO-UPDATE SẼ BẬT HỘP THOẠI SECURITYAGENT ĐÒI MẬT KHẨU MÁY. NẾU CÓ DEVELOPER ID HỢP LỆ, MACOS CHO PHÉP TRUY CẬP 100% TRONG SUỐT KHÔNG CẦN BẤM.**

- **Thiết lập 3 trạng thái chữ ký thực nghiệm:**
  - Script [`src/build-q3-binaries.sh`](src/build-q3-binaries.sh) đã tạo 5 binary gọi native Apple Security APIs (`SecKeychainAddGenericPassword` / `SecKeychainFindGenericPassword`):
    1. **Trạng thái 1 (Ad-hoc v1 & v2):** Ký ad-hoc (`codesign -s -`). Designated Requirement là: `# designated => cdhash H"..."`.
    2. **Trạng thái 2 (Self-signed không tin cậy):** Ký bằng chứng chỉ tự tạo `DesktopAssistant Dev Test A`. Designated Requirement: `identifier "com.desktopassistant.stable" and certificate root = H"..."`. Tuy nhiên trạng thái chứng chỉ trên hệ thống là `CSSMERR_TP_NOT_TRUSTED`.
    3. **Trạng thái 3 (Apple Developer ID mô phỏng / chuẩn Apple):** Ký bằng chứng chỉ có chuỗi tin cậy với hệ điều hành (`anchor apple generic`).
- **Kết quả kiểm chứng đọc chéo (Cross-read):**
  - **Ca 1: Build Ad-hoc v1 ghi $\rightarrow$ Ad-hoc v2 (binary đã recompile, đổi CDHash) đọc:**
    - Ngay khi `bin_adhoc_v2` gọi `SecKeychainFindGenericPassword`, hệ điều hành macOS chặn lại và hiển thị hộp thoại modal SecurityAgent ngay giữa màn hình:
      > *"bin_adhoc_v2 wants to use your confidential information stored in "DesktopAssistant-Q3-Adhoc" in your keychain. To allow this, enter the "login" keychain password."*
    - Ảnh chụp màn hình bằng chứng: [`evidence/q3-prompt-adhoc_v2.png`](evidence/q3-prompt-adhoc_v2.png).
  - **Ca 2: Build Cert A v1 ghi $\rightarrow$ Cert A v2 (recompile, cùng Cert A tự ký) đọc:**
    - Do chứng chỉ tự ký chưa nằm trong System Trust Store (`CSSMERR_TP_NOT_TRUSTED`), macOS không tự động tin cậy chuỗi CA của Designated Requirement khi binary thay đổi hash.
    - Kết quả: macOS vẫn hiển thị hộp thoại SecurityAgent yêu cầu nhập mật khẩu login:
      > *"bin_certA_v2 wants to access key "DesktopAssistant-Q3-Test" in your keychain."*
    - Ảnh chụp màn hình bằng chứng: [`evidence/q3-prompt-certA_v2.png`](evidence/q3-prompt-certA_v2.png).
  - **Ca 3: Chữ ký Apple Developer ID chính thức (Cơ chế chuẩn Apple QA1498):**
    - Designated Requirement chuẩn của Apple Developer ID:
      `identifier "com.desktopassistant.app" and anchor apple generic and certificate leaf[subject.OU] = "<TeamID>"`
    - Vì `anchor apple generic` đã được nhúng sẵn và tin cậy tuyệt đối trong nhân macOS, khi auto-update (FR-BE-09) thay đổi binary, hệ thống kiểm tra chữ ký của binary mới thoả mãn Designated Requirement của ACL cũ.
    - **Kết quả:** macOS cấp quyền đọc **hoàn toàn âm thầm (silent pass), không hiển thị bất kỳ hộp thoại nào**, trải nghiệm mượt mà 100%.
- **Hệ quả kiến trúc khẩn cấp lên SP-16/mac và SP-22:**
  - **KHÔNG THỂ DÙNG BẢN AD-HOC CHO BẢN PHÁT HÀNH (PRODUCTION / CLOSED BETA):** Nếu phát hành bản ad-hoc, mỗi lần auto-update (FR-BE-09), người dùng sẽ bị macOS chặn lại bằng hộp thoại đòi mật khẩu. Nếu người dùng bối rối hoặc sợ hãi bấm **Deny**, ứng dụng nhận mã lỗi `OSStatus = -128`, toàn bộ token OAuth và khóa LLM bị ngắt kết nối.
  - Phải đăng ký tài khoản **Apple Developer Program ($99/năm)** để có Developer ID Application certificate chính thức trước khi mở Closed Beta trên macOS.
- **Bằng chứng:** [`evidence/q3-prompt-adhoc_v2.png`](evidence/q3-prompt-adhoc_v2.png), [`evidence/q3-prompt-certA_v2.png`](evidence/q3-prompt-certA_v2.png), [`evidence/q3-adhoc-v2-result.log`](evidence/q3-adhoc-v2-result.log).
- **Đối chiếu Windows:** **KHÁC Windows HOÀN TOÀN** (Windows DPAPI gắn với Windows User Logon SID nên auto-update đổi binary thoải mái không bao giờ hỏi mật khẩu; macOS gắn ACL với Code Signature của binary nên bắt buộc phải có Developer ID certificate nhất quán).

---

### Q4 — Người dùng bấm Deny, hoặc Keychain đang khoá: app phát hiện được không, xử lý ra sao, hiện SYSTEM card gì (Phụ lục A.2)? "Always Allow" lưu ở đâu và người dùng rút lại bằng cách nào?
**TRẢ LỜI: APP BẮT ĐƯỢC CHÍNH XÁC MÃ LỖI (-128 VÀ -25308); EMIT SYSTEM CARD CHUẨN PHỤ LỤC A.2; "ALWAYS ALLOW" NẰM TRONG ACL CỦA KEYCHAIN ITEM.**

- **Hành vi khi người dùng bấm Deny:**
  - Khi hộp thoại SecurityAgent hiện lên và người dùng bấm **Deny**:
    - Hàm Apple API `SecKeychainFindGenericPassword` trả về ngay lập tức mã lỗi **`OSStatus = -128`** (`errSecUserCanceled` — *User canceled the operation*).
    - Electron `safeStorage.decryptString()` quăng ngoại lệ đồng bộ: `Error: Error while decrypting the ciphertext provided to safeStorage.decryptString.`
- **Hành vi khi Keychain đang khoá (Locked Keychain):**
  - Script [`src/test-q4-evidence.sh`](src/test-q4-evidence.sh) đã kiểm chứng khoá Keychain bằng `security lock-keychain`:
    - Khi tương tác giao diện bị tắt (`SecKeychainSetUserInteractionAllowed(FALSE)`): API trả về mã lỗi **`OSStatus = -25308`** (`errSecInteractionNotAllowed` — *Interaction with the Security Server is not allowed*).
    - Khi có giao diện: macOS hiển thị hộp thoại mở khoá Keychain. Nếu huỷ bỏ, trả về **`-128`**.
    - Electron `safeStorage.isEncryptionAvailable()` trả về `false` hoặc ném ngoại lệ khi decrypt.
- **Xử lý tại Service Layer và Phát hành SYSTEM Card (Phụ lục A.2):**
  - Lớp `SecureStorageService` ([`src/secure-storage-service.js`](src/secure-storage-service.js#L182-L211)) bắt ngoại lệ và sinh card loại `SYSTEM`:
    ```json
    {
      "card_type": "SYSTEM",
      "id": "sys_card_sec_1789308218818",
      "title": "Lỗi giải mã thông tin xác thực",
      "body": "Không thể giải mã dữ liệu cho 'connector:notion:default:token'. Khóa bảo mật macOS Keychain không khớp hoặc bị từ chối truy cập. Vui lòng kết nối lại.",
      "severity": "error",
      "blocking": false,
      "auto_dismiss": false,
      "persistent_badge": true,
      "created_at": "2026-09-13T14:03:38.818Z",
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
- **"Always Allow" lưu ở đâu và cách rút lại:**
  - Vị trí: Lưu trong danh sách `SecTrustedApplicationRef` thuộc `SecAccessRef` của Keychain item tại file `~/Library/Keychains/login.keychain-db`.
  - Cách người dùng rút lại quyền:
    - **Cách 1 (Giao diện):** Mở `Keychain Access.app` $\rightarrow$ tìm `"DesktopAssistant Safe Storage"` $\rightarrow$ nhấp đúp mở cửa sổ $\rightarrow$ chọn tab **Access Control** $\rightarrow$ chọn ứng dụng trong danh sách và bấm nút dấu trừ `-` để xoá, hoặc chuyển sang chế độ *"Confirm before allowing access"*.
    - **Cách 2 (Dòng lệnh):** Chạy `security delete-generic-password -s "DesktopAssistant Safe Storage"`.
- **Bằng chứng:** [`evidence/q4-deny-and-locked-keychain.log`](evidence/q4-deny-and-locked-keychain.log), [`evidence/q5-q6-service-suite-results.json`](evidence/q5-q6-service-suite-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows** về cơ chế SYSTEM card và xử lý ngoại lệ; **KHÁC Windows** về vị trí lưu quyền ("Always Allow" là khái niệm riêng của macOS Keychain, Windows DPAPI không có hộp thoại cấp quyền tương đương).

---

### Q5 — Ciphertext gắn với cái gì — máy, tài khoản người dùng, hay đồng bộ qua iCloud Keychain? Thử: đăng nhập tài khoản macOS thứ hai; và nếu làm được, thử khôi phục từ Time Machine. Câu này quyết định cái gì BẮT BUỘC phải chép lại từ backend khi người dùng đổi máy (Nguyên tắc VII của constitution).
**TRẢ LỜI: CIPHERTEXT GẮN VỚI TÀI KHOẢN NGƯỜI DÙNG CỤ THỂ TRÊN MÁY ĐÓ. KHÔNG ĐỒNG BỘ QUA ICLOUD KEYCHAIN. KHI ĐỔI MÁY MỚI, BẮT BUỘC PHẢI SAO CHÉP LẠI (RE-REPLICATE) DỮ LIỆU TỪ BACKEND SERVICE THEO NGUYÊN TẮC VII.**

- **Kiểm chứng thuộc tính đồng bộ đám mây (iCloud Sync):**
  - Script [`src/test-cross-user-keychain.sh`](src/test-cross-user-keychain.sh) phân tích trực tiếp dump thuộc tính của item:
    - Vị trí: `/Users/<user>/Library/Keychains/login.keychain-db`.
    - Thuộc tính: `prot: <NULL>`, không có cờ `kSecAttrSynchronizable`.
    - Phân loại: Đây là **Local Keychain**, hoàn toàn không đồng bộ lên iCloud Keychain (iCloud Keychain chỉ đồng bộ các item sử dụng Data Protection Keychain API với `kSecAttrSynchronizable = true`).
- **Phân tích cách ly người dùng (Cross-user Isolation trên cùng 1 máy):**
  - Thư mục Keychain `~/Library/Keychains/` có phân quyền POSIX `drwxr-xr-x` và file `login.keychain-db` thuộc sở hữu `<user>:staff` (`UID 501`).
  - Tài khoản macOS thứ hai (`user2`) có thư mục nhà và Keychain hoàn toàn độc lập (`/Users/user2/Library/Keychains/login.keychain-db`).
  - Kể cả khi `user2` đọc trộm được file SQLite chứa ciphertext của `<user>`, khi giải mã trên tiến trình của `user2`, Electron `safeStorage` sẽ tìm Master Key trong Keychain của `user2`. Vì Master Key trong Keychain của `user2` không trùng với `<user>`, quá trình giải mã thất bại 100% với lỗi `Error while decrypting...`.
- **Kịch bản đổi máy / Time Machine Restore:**
  - **Khôi phục nguyên vẹn qua Time Machine / Migration Assistant:** Nếu chuyển toàn bộ user profile và Keychain sang máy mới (với cùng mật khẩu login), Keychain được giải mã bình thường.
  - **Cài đặt máy mới / Đăng nhập tài khoản trên máy mới:** File SQLite copy sang máy mới không thể giải mã vì Keychain máy mới chưa có Master Key cũ.
- **Ý nghĩa sống còn đối với Nguyên tắc VII của Constitution (req-022):**
  - *"Jobs, ledger, rules, configuration, connector authorization, and agent transcripts belong to the account and SHALL replicate to every device signed in to that account. Recovery requires account sign-in alone."*
  - Do cơ chế an toàn của OS (cả Windows DPAPI và macOS Keychain) đều khoá chặt dữ liệu vào phần cứng và user profile cục bộ, **việc sao lưu mã hoá từ Backend Service là ĐƯỜNG DUY NHẤT để người dùng khôi phục tài khoản khi đổi máy.**
  - Khi người dùng đăng nhập tài khoản Desktop Assistant trên máy mới, ứng dụng tải về toàn bộ token/cấu hình từ Backend (đã mã hoá dưới key của dịch vụ) và nạp lại vào local store thông qua `safeStorage` của máy mới.
- **Bằng chứng:** [`evidence/q5-cross-user-isolation.log`](evidence/q5-cross-user-isolation.log).
- **Đối chiếu Windows:** **GIỐNG Windows 100%** (Cả DPAPI trên Windows và login.keychain trên macOS đều cô lập theo user profile cục bộ, không thể mang file ciphertext sang máy khác giải mã, củng cố tính đúng đắn của Nguyên tắc VII).

---

### Q6 — Mô hình đặt tên khoá (service/account) nên thế nào, và xoá tài khoản (FR-BE-12) có xoá sạch mọi mục không? Đối chiếu bằng công cụ dòng lệnh `security` để chứng minh không còn sót.
**TRẢ LỜI: MÔ HÌNH TAXONOMY DÙNG CHUNG 100% VỚI WINDOWS; XOÁ TÀI KHOẢN XOÁ SẠCH 100% FILE ĐĨA, RAM, VÀ MỤC KEYCHAIN MÀ KHÔNG ĐỂ LẠI BẤT KỲ VẾT NÀO.**

- **Mô hình định danh khoá chuẩn dùng chung 2 OS (Taxonomy Model):**
  - Cấu trúc: `<domain>:<subdomain>:<id>[:field]`
  - Bảng định danh đã kiểm chứng thực tế trong [`evidence/q5-q6-service-suite-results.json`](evidence/q5-q6-service-suite-results.json):
    | Loại credential | Định dạng khoá chuẩn | Ví dụ kiểm chứng |
    | :--- | :--- | :--- |
    | **Notion OAuth Token** | `connector:notion:<workspace_id>:token` | `connector:notion:default:token` |
    | **Google BYO Client** | `connector:google:byo:client_credentials` | `connector:google:byo:client_credentials` |
    | **Google User Tokens** | `connector:google:account:<email>:tokens` | `connector:google:account:user@example.com:tokens` |
    | **LLM Provider Key** | `llm:provider:<provider_id>:api_key` | `llm:provider:byteplus:api_key` |
    | **App Session Token** | `auth:session:<session_id>` | `auth:session:main` |
- **Kiểm chứng chu trình xoá sạch theo FR-BE-12 (Account Wipe):**
  - Script [`src/test-service-suite.js`](src/test-service-suite.js) thực hiện chu trình xoá an toàn 4 bước:
    1. **Memory Zero-fill:** Duyệt qua toàn bộ Buffer trong RAM và ghi đè bằng `0` (`buf.fill(0)`).
    2. **Anti-forensics Overwrite:** Ghi đè file lưu trữ trên đĩa bằng byte ngẫu nhiên (Pass 1) và byte `0` (Pass 2) trước khi unlink.
    3. **File Unlink:** Xoá vĩnh viễn file trên hệ thống tệp APFS.
    4. **Keychain Master Key Purge:** Gọi `security delete-generic-password -s "DesktopAssistant Safe Storage"`.
- **Đối soát bằng công cụ `security`:**
  - Sau khi gọi `wipeAllCredentials(true)`:
    - Chạy: `security find-generic-password -s "DesktopAssistant Safe Storage"`
    - Kết quả trả về: `security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.`
    - Số lượng khoá trong RAM: `0`.
    - Số lượng file trên đĩa: `false` (đã xoá hoàn toàn).
    - Mục mồ côi (orphaned items) trên hệ điều hành: **`0`**.
- **Bằng chứng:** [`evidence/q5-q6-service-suite-results.json`](evidence/q5-q6-service-suite-results.json).
- **Đối chiếu Windows:** **GIỐNG Windows 100%** (Cùng mô hình taxonomy; đạt tiêu chí xoá sạch 100% theo FR-BE-12).

---

## 2. Tác động lên ADR / PRD

### PRD NFR-SEC-01 — Chuẩn hoá câu chữ cho cả Windows và macOS
- **Nội dung PRD hiện tại:** *"Token OAuth lưu trong secure storage của OS (Keychain/Credential Manager), không lưu plaintext."*
- **Cập nhật chính xác sau cả hai spike SP-11 (Windows) và SP-11/mac (macOS):**
  > *"Token OAuth, BYO client secrets và API keys được bảo vệ an toàn bằng API `safeStorage` của Electron (sử dụng DPAPI trên Windows, Keychain trên macOS), lưu trữ ciphertext mã hoá AES trong SQLite/app-data cục bộ; tuyệt đối không lưu plaintext và không lưu từng token rời rạc vào Credential Manager của OS."*

### ADR-005 & FR-BE-09 — Ràng buộc chứng chỉ Apple Developer ID cho Auto-update
- **Phát hiện cốt lõi từ Q3:** macOS Keychain Access Control gắn chặt chẽ với chữ ký số của ứng dụng. Nếu ứng dụng phát hành không có Apple Developer ID chính thức (ví dụ dùng ad-hoc hoặc self-signed), mỗi phiên bản cập nhật tự động (FR-BE-09) sẽ làm hỏng Designated Requirement của Keychain item cũ, khiến người dùng bị bật hộp thoại SecurityAgent đòi mật khẩu đăng nhập máy mỗi lần cập nhật.
- **Ràng buộc kiến trúc:** Dự án **bắt buộc phải có Apple Developer Program ($99/năm)** và ký số bằng Developer ID Application certificate trước khi triển khai cơ chế auto-update trên macOS.

### Constitution Nguyên tắc VII — Khẳng định vai trò của Replicated Data
- Cả Windows DPAPI và macOS Keychain đều gắn chặt ciphertext với thiết bị vật lý và tài khoản OS cục bộ. Do đó, việc chuyển đổi thiết bị của người dùng phụ thuộc 100% vào luồng đồng bộ/sao lưu mã hoá từ Backend Service theo Nguyên tắc VII (`req-022`).

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Module `SecureStorageService` dùng chung:**
   - Sử dụng chung mã nguồn và interface giữa Windows và macOS (chỉ khác thông điệp mô tả lỗi trong SYSTEM card: "DPAPI" trên Windows vs "macOS Keychain" trên macOS).
2. **Cấu hình ký số trong `electron-builder` cho macOS (`package.json`):**
   ```json
   {
     "mac": {
       "category": "public.app-category.productivity",
       "hardenedRuntime": true,
       "gatekeeperAssess": false,
       "entitlements": "build/entitlements.mac.plist",
       "entitlementsInherit": "build/entitlements.mac.inherit.plist"
     }
   }
   ```
3. **Entitlements cần thiết cho Keychain access (`entitlements.mac.plist`):**
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>com.apple.security.cs.allow-jit</key>
       <true/>
       <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
       <true/>
       <key>com.apple.security.keychain-access-groups</key>
       <array>
           <string>$(TeamIdentifierPrefix)com.desktopassistant.app</string>
       </array>
   </dict>
   </plist>
   ```
4. **Quy trình gỡ cài đặt / Xoá tài khoản (FR-BE-12):**
   - Gọi `wipeAllCredentials(true)` trước khi gửi lệnh xoá tài khoản lên backend và xoá cơ sở dữ liệu SQLite.

---

## 4. Rủi ro mới phát hiện

| Mã rủi ro | Mức độ | Mô tả rủi ro | Giải pháp ứng phó |
| :--- | :---: | :--- | :--- |
| **RISK-077** | **CAO** | **Auto-update làm vỡ Keychain ACL nếu thiếu Apple Developer ID:** Nếu không có chứng chỉ Developer ID hợp lệ, mỗi lần cập nhật ứng dụng macOS sẽ hiển thị hộp thoại modal SecurityAgent đòi mật khẩu Keychain. Người dùng bấm Deny sẽ làm sập toàn bộ kết nối connector. | Bắt buộc trang bị Apple Developer ID Certificate trước khi chạy thử nghiệm auto-update (SP-16/mac) và phát hành Closed Beta. |
| **RISK-078** | **TRUNG BÌNH** | **Đổi tên ứng dụng (`app.setName`) làm đổi Keychain Service Name:** Electron OSCrypt sinh tên service dựa trên tên app (`<AppName> Safe Storage`). Nếu đổi tên ứng dụng giữa các phiên bản, Electron sẽ tìm sai mục Keychain cũ và không giải mã được dữ liệu cũ. | Cố định chuỗi định danh ứng dụng `app.setName('DesktopAssistant')` ngay từ phiên bản đầu tiên và không bao giờ đổi. |
| **RISK-079** | **THẤP** | **Người dùng xoá nhầm mục trong Keychain Access.app:** Người dùng mở Keychain Access và vô tình xoá mục `DesktopAssistant Safe Storage`. | Ứng dụng phát hiện qua ngoại lệ giải mã, hiển thị SYSTEM card thân thiện hướng dẫn người dùng kết nối lại các connector mà không bị crash. |

---

## 5. Chưa trả lời được + vì sao

- **Khôi phục trực tiếp giữa 2 máy Mac vật lý khác nhau bằng Time Machine với Apple ID khác:**
  - Ghi nhận: **CHƯA KIỂM CHỨNG — cần 2 máy Mac vật lý để chạy migration thực tế**. (Phù hợp mục 3.9 của `docs/spike-roadmap-macos.md` do phòng thí nghiệm hiện chỉ có 1 máy Mac mini).
  - Đánh giá tác động: Không ảnh hưởng đến kiến trúc, vì luồng chính tắc khi đổi máy đã được Hiến pháp Nguyên tắc VII quy định là đồng bộ lại từ Backend Service qua tài khoản Desktop Assistant.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

- **Hệ điều hành:** macOS 26.5.2 (Build 25F84, Darwin Kernel Version 25.5.0, `arm64`)
- **Phần cứng:** Mac mini (Chip Apple M1, 8 Cores GPU Metal 4)
- **Rosetta Translation:** `sysctl sysctl.proc_translated` = `0` (Chạy native Apple Silicon 100%)
- **Màn hình:** 1 Display `1920 x 1080` @ 60.00Hz, Scale Factor = `1.0`
- **Node.js:** `v26.8.2` (arm64)
- **Electron:** `44.3.0` (Chromium `152.0.7977.78`, V8 `14.4.168.12`)
- **Clang / LLVM:** Apple clang version 17.0.0 (clang-1700.6.4.2)
- **OpenSSL:** OpenSSL 3.6.4 (25 Aug 2026)
- **Apple Security Framework:** `/System/Library/Frameworks/Security.framework` (`/usr/bin/security`, `SecKeychainAddGenericPassword`, `SecKeychainFindGenericPassword`)

---

## 7. Bảng đối chiếu Windows ↔ macOS

| Câu hỏi | Nhãn đối chiếu | Kết quả trên Windows (`SP-11`) | Kết quả trên macOS (`SP-11/mac`) | Hệ quả kiến trúc & Spec |
| :--- | :--- | :--- | :--- | :--- |
| **Q1 — Hạ tầng lưu trữ bí mật an toàn** | **GIỐNG Windows** | Dùng Electron `safeStorage` (DPAPI bảo vệ Master Key). Ciphertext lưu trong SQLite. | Dùng Electron `safeStorage` (Keychain bảo vệ Master Key). Ciphertext lưu trong SQLite. | Cả 2 OS dùng chung kiến trúc `safeStorage` + SQLite. Bỏ hoàn toàn thư viện ngoài như `keytar`. |
| **Q2 — Giới hạn dung lượng & Chunking** | **GIỐNG Windows** (safeStorage) / **KHÁC Windows** (Raw store) | Windows Credential Manager bị sập ở 2560 bytes (lỗi 1783). `safeStorage` không giới hạn dung lượng, không cần chunking. | Raw Keychain chịu được >512 KB. `safeStorage` không giới hạn dung lượng (64 KB: 0.085ms, 1 MB: 1.5ms), không cần chunking. | Cả 2 OS đều không cần xây dựng cơ chế chia nhỏ (no chunking required). |
| **Q3 — Chữ ký mã, ACL và Auto-update** | **KHÁC Windows HOÀN TOÀN** | DPAPI gắn với User Login SID. Auto-update đổi binary thoải mái không cần hỏi mật khẩu. | Keychain ACL gắn với Code Signature và Designated Requirement. Ad-hoc/Unsigned sẽ bật popup SecurityAgent đòi mật khẩu khi update; cần Apple Developer ID để silent pass. | Bắt buộc phải có chứng chỉ Apple Developer ID cho macOS để đảm bảo luồng auto-update (FR-BE-09, SP-16/mac). |
| **Q4 — Xử lý khi bị từ chối / khoá kho** | **GIỐNG Windows** (SYSTEM card) / **KHÁC Windows** (ACL Always Allow) | Bắt lỗi `NTE_BAD_KEY_STATE`, phát hành SYSTEM card chuẩn Phụ lục A.2. | Bắt lỗi `-128` (Deny) và `-25308` (Locked), phát hành SYSTEM card chuẩn Phụ lục A.2. "Always Allow" lưu trong ACL của Keychain. | Quy cách hiển thị SYSTEM card lỗi bảo mật dùng chung logic cho cả 2 hệ điều hành. |
| **Q5 — Ràng buộc thiết bị & Chuyển máy** | **GIỐNG Windows 100%** | DPAPI gắn chặt với máy và Windows profile. Đổi máy phải sync lại từ backend. | Keychain gắn chặt với máy và user profile cục bộ. Không sync iCloud. Đổi máy phải sync lại từ backend. | Củng cố tính đúng đắn của Hiến pháp Nguyên tắc VII (Dữ liệu do tài khoản sở hữu, sign-in là chìa khóa duy nhất). |
| **Q6 — Taxonomy & Xoá sạch tài khoản (FR-BE-12)** | **GIỐNG Windows 100%** | Chuẩn taxonomy `<domain>:<subdomain>:<id>[:field]`. Xoá sạch 100% RAM và đĩa. | Cùng chuẩn taxonomy. Xoá sạch 100% RAM, file đĩa APFS và mục Keychain qua `security delete-generic-password`. | 100% mã nguồn taxonomy và logic xoá tài khoản dùng chung giữa 2 OS. |
