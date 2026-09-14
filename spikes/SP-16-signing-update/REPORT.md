# SP-16 — Code signing + auto-update pipeline (Windows)

## 0. Kết luận

**ĐI CÓ ĐIỀU KIỆN** — Pipeline code signing và auto-update của electron-builder/electron-updater chạy trọn vẹn 100% qua local HTTP manifest với cert tự ký (không chặn tiến độ M0); tuy nhiên điều kiện bắt buộc là Product Owner phải bấm nút mua chứng chỉ thương mại (Cloud Signing như Azure Trusted Signing hoặc SSL.com eSigner) trước ngày kết thúc Milestone M1 (tối thiểu 2 tuần trước đợt Closed Beta đầu tiên) do Windows SmartScreen và cơ chế WinVerifyTrust chặn hoàn toàn cert tự ký trên máy người dùng thực tế nếu không được import root cert thủ công.

---

## 1. Trả lời từng câu hỏi

### Q1 — Windows: so sánh OV và EV. Ký trong CI với hardware token khả thi không, hay bắt buộc cloud signing service? Liệt kê nhà cung cấp kèm giá công bố.

**1. So sánh OV (Organization/Individual Validation) và EV (Extended Validation):**
- **Quy định bắt buộc mới từ CA/Browser Forum (áp dụng từ 01/06/2023):** Cả chứng chỉ OV lẫn EV đều **bắt buộc** lưu trữ khóa riêng tư (private key) trên phần cứng bảo mật đạt chuẩn tối thiểu FIPS 140-2 Level 2 hoặc Common Criteria EAL 4+. Không một CA nào còn cho phép xuất file PFX truyền thống tải trực tiếp về máy tính.
- **Điểm khác biệt cốt lõi:**
  - **EV:** Yêu cầu thẩm định pháp nhân doanh nghiệp nghiêm ngặt (không cấp cho cá nhân đơn lẻ), được Microsoft SmartScreen cấp **Instant Reputation ngay lập tức** (không bao giờ hiện cảnh báo xanh cảnh báo ứng dụng lạ).
  - **OV:** Có thể cấp cho cả doanh nghiệp hoặc cá nhân độc lập (Individual developer), nhưng khởi đầu với **0 danh tiếng trên SmartScreen** và phải tích lũy lượt tải sạch.

**2. Ký trong CI với Hardware Token vật lý (USB token):**
- **Kết luận:** **KHÔNG KHẢ THI và KHÔNG NÊN DÙNG** cho môi trường CI/CD trên cloud (như GitHub Actions, GitLab CI).
- **Lý do thực tế:**
  - Hardware token dạng USB (như SafeNet eToken 5110) bắt buộc phải cắm vật lý vào cổng USB của máy tính làm runner. Cloud runner không có cổng USB vật lý.
  - Nếu cố dựng self-hosted runner vật lý tại chỗ: công cụ middleware token thường yêu cầu pop-up nhập mật khẩu PIN. Tự động hóa nhập PIN qua script thường xuyên bị kẹt hoặc dẫn đến khóa cứng thiết bị (brick token sau 3-5 lần sai PIN).
  - Vận chuyển USB vật lý từ Mỹ/Âu về Việt Nam mất 2–4 tuần và bị kiểm soát hải quan về thiết bị mật mã.

**3. Bắt buộc dùng Cloud Signing Service:**
- Để ký số tự động mượt mà trong CI/CD hiện nay, giải pháp duy nhất và chuẩn mực là sử dụng **Cloud Signing Service** (HSM trên đám mây của CA).
- Build runner trong CI chỉ cần gọi API/CLI kèm chứng thực bí mật (Client ID/Secret hoặc OTP token) để ký từ xa mà không cần cắm USB vật lý.

**4. Bảng nhà cung cấp kèm giá công bố:**

| Nhà cung cấp | Loại hình dịch vụ | Đối tượng hỗ trợ | Giá công bố niêm yết | Lead time |
| :--- | :--- | :--- | :--- | :--- |
| **Microsoft Azure Trusted Signing** *(Khuyến nghị số 1 cho Doanh nghiệp)* | Cloud HSM Native của Microsoft | Chỉ **Doanh nghiệp** (đã xác thực trên MS Partner Center) | **Basic SKU: \$9.99/tháng** (~**\$120/năm**). Gồm 100 lần ký/tháng, \$0.05/lần ký thêm. | 5 – 10 ngày làm việc |
| **SSL.com (eSigner)** *(Khuyến nghị số 1 cho Cá nhân)* | Cloud Signing eSigner / USB | Cả **Cá nhân** và **Doanh nghiệp** | **OV:** \$129 – \$179/năm.<br>**EV:** \$249 – \$349/năm.<br>eSigner: Tier 1 tích hợp sẵn, \$20/tháng nếu vượt hạn mức. | 3 – 5 ngày làm việc |
| **Sectigo** (via TheSSLStore/CheapSSL) | USB Token vật lý | Cả **Cá nhân** và **Doanh nghiệp** | **OV:** ~\$220 – \$280/năm.<br>**EV:** ~\$380 – \$460/năm.<br>Phí ship USB quốc tế: ~\$60 – \$100. | 2 – 4 tuần (chờ ship) |
| **DigiCert** | Hardware USB / DigiCert ONE | Chủ yếu **Doanh nghiệp lớn** | **EV:** \$799 – \$899/năm (USB).<br>**DigiCert ONE (Cloud CI):** \$1,500 – \$3,000+/năm. | 2 – 3 tuần |
| **Certum** (Châu Âu) | SimplySign Cloud / USB | Cả **Cá nhân** và **Doanh nghiệp** | **OV SimplySign:** ~€150 – €220/năm (~\$160 – \$240).<br>**EV SimplySign:** ~€350 – €450/năm. | 3 – 7 ngày làm việc |

- **Bằng chứng:** Xem chi tiết bảng so sánh và hồ sơ pháp lý tại [evidence/procurement-checklist.md](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/procurement-checklist.md#L20-L33).

---

### Q2 — SmartScreen reputation: với OV cần bao lâu và bao nhiêu lượt tải để hết cảnh báo? EV có bỏ qua được ngay không?

**1. Với chứng chỉ OV:**
- **Thời gian & số lượt tải:** Khi một chứng chỉ OV mới được đưa vào sử dụng, danh tiếng trên Microsoft Defender SmartScreen khởi đầu bằng **0**. Người dùng tải file về khi mở sẽ thấy màn hình cảnh báo màu xanh dương: *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting"*.
- Cần tích lũy từ **vài trăm đến 2,000 – 3,000 lượt tải và cài đặt sạch** (không bị người dùng bấm "Report as unsafe", không chứa chữ ký mã độc) trong khoảng thời gian từ **2 đến 4 tuần** để thuật toán phân tích hành vi của Microsoft tự động ghi nhận uy tín và gỡ bỏ cảnh báo.
- **Biện pháp giảm nhẹ:** Nhà phát triển có thể chủ động nộp file exe đã ký lên cổng [Microsoft Security Intelligence Submission](https://www.microsoft.com/en-us/wdsi/filesubmission) trước khi phân phối. Microsoft sẽ quét tự động trong vòng vài giờ đến vài ngày để gắn cờ an toàn sơ bộ.

**2. Với chứng chỉ EV & Azure Trusted Signing:**
- **EV:** **BỎ QUA CẢNH BÁO NGAY LẬP TỨC** (*Instant Reputation*). Do quá trình thẩm định danh tính tổ chức của EV vô cùng khắt khe, Microsoft cấp mức độ tin cậy mặc định ngay từ file đầu tiên được ký bằng chứng chỉ EV.
- **Azure Trusted Signing:** Đạt **Instant Reputation tương đương EV** ngay lập tức vì được bảo chứng trực tiếp qua hệ thống telemetry và tài khoản định danh của Microsoft.

- **Bằng chứng:** Tham chiếu [evidence/procurement-checklist.md §5](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/procurement-checklist.md#L98-L100).

---

### Q3 — electron-builder + electron-updater trỏ vào manifest tự dựng (FR-BE-09) chạy được không? Manifest cần định dạng gì, có phải ký manifest không?

**1. Khả năng hoạt động với manifest tự dựng:**
- **CHẠY HOÀN TOÀN MƯỢT MÀ VÀ CHÍNH XÁC.**
- Trong cấu hình `electron-updater`, chỉ cần khai báo:
  ```javascript
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'http://127.0.0.1:8089/updates' // hoặc URL API backend FR-BE-09
  });
  ```
  App sẽ tự động gửi HTTP GET request đến endpoint URL để lấy file manifest kiểm tra phiên bản mới.

**2. Định dạng của manifest:**
- Manifest của `electron-updater` là file định dạng **YAML** tên là `latest.yml` (đối với Windows x64) do `electron-builder` tự động sinh ra trong thư mục `dist/` khi đóng gói.
- Nội dung cấu trúc thực tế sinh ra từ spike:
  ```yaml
  version: 1.0.1
  files:
    - url: DesktopAssistantSpike Setup 1.0.1.exe
      sha512: OId1ZlMhW1mSjM5g1xO9aVwA3...==
      size: 111622936
  path: DesktopAssistantSpike Setup 1.0.1.exe
  sha512: OId1ZlMhW1mSjM5g1xO9aVwA3...==
  releaseDate: '2026-09-12T03:39:28.410Z'
  ```

**3. Có phải ký manifest không?**
- **KHÔNG.** File `latest.yml` là plaintext YAML thông thường, **không** có chữ ký số PKI trên file manifest.
- **Cơ chế xác thực bảo mật gồm 2 lớp chặt chẽ:**
  1. **Toàn vẹn dữ liệu (Integrity):** `electron-updater` sau khi tải file installer về sẽ tính mã hash SHA-512 và so khớp từng byte với trường `sha512` được khai báo trong `latest.yml`. Nếu sai lệch dù chỉ 1 bit, file sẽ bị xóa ngay.
  2. **Xác thực chữ ký số Authenticode (Authenticity):** Trên Windows, module native của `electron-updater` gọi hàm Win32 API `WinVerifyTrust()` lên file installer trước khi cho phép thực thi. Nếu file installer chưa ký số, chữ ký bị hỏng, hoặc chứng chỉ không thuộc Trusted Root của hệ thống, `electron-updater` sẽ quẳng ngoại lệ và tuyệt đối không thực thi lệnh cài đặt.

- **Bằng chứng mã nguồn:** Xem thiết lập tại [src/app/main.js:68-128](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/src/app/main.js#L68-L128) và log tiếp nhận request manifest tại [evidence/server-requests.log](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/server-requests.log).

---

### Q4 — DRY-RUN TRỌN VẸN với certificate tự ký: build → ký → publish manifest lên một HTTP server cục bộ → app tự phát hiện bản mới → tải → cài → khởi động lại đúng phiên bản mới.

**KẾT QUẢ: THỰC NGHIỆM ĐẠT THÀNH CÔNG 100%.** Pipeline đã được kiểm chứng tự động khép kín từ đầu đến cuối trước khi chi tiền mua chứng chỉ thật:

1. **Tạo chứng chỉ tự ký:**
   - Tạo mã khóa RSA 2048-bit, SHA-256 Code Signing `CN=Desktop Assistant (Spike SP-16 Code Signing)` qua script [src/setup-cert.ps1](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/src/setup-cert.ps1).
   - Đưa chứng chỉ vào `Cert:\LocalMachine\Root` và `Cert:\LocalMachine\TrustedPublisher` (Thumbprint: `5B751250AE89DDBD2DCDFDB5CC77BCC991195440`).
2. **Build & Ký số Authenticode:**
   - Đóng gói bản v1.0.0 và v1.0.1 bằng `electron-builder 26.15.3`. Cả hai bản installer đều được ký tự động bằng `signtool.exe` kèm RFC 3161 Timestamp từ DigiCert Timestamp CA.
   - Kiểm tra chữ ký bằng `signtool.exe verify /pa /v`: kết quả cả hai bản đều hợp lệ với **0 warnings, 0 errors**.
   - Bằng chứng log: [evidence/verify-v1.0.0.log](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/verify-v1.0.0.log) và [evidence/verify-v1.0.1.log](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/verify-v1.0.1.log).
3. **Phục vụ bản cập nhật qua HTTP Server:**
   - Khởi động server Node.js thuần tại `http://127.0.0.1:8089/updates` qua [src/server/update-server.js](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/src/server/update-server.js), hỗ trợ decode URI và HTTP Range requests cho differential update.
4. **Vòng đời tự động phát hiện, tải và nâng cấp:**
   - Chạy script kiểm chứng tự động toàn diện [src/run-dryrun-test.ps1](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/src/run-dryrun-test.ps1).
   - Bản v1.0.0 khởi chạy (PID 520), hiển thị UI phiên bản 1.0.0 màu xanh lam. Đã chụp ảnh màn hình bằng chứng: [evidence/screenshot-v1.0.0-running.png](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/screenshot-v1.0.0-running.png).
   - v1.0.0 tự động truy vấn `http://127.0.0.1:8089/updates/latest.yml`, phát hiện bản v1.0.1 khả dụng.
   - Tải file `DesktopAssistantSpike Setup 1.0.1.exe` về cache pending `%LOCALAPPDATA%\sp16-desktop-assistant-updater\pending\`.
   - Windows xác thực chữ ký Authenticode thành công và app kích hoạt `autoUpdater.quitAndInstall(true, true)`.
   - Tiến trình v1.0.0 đóng, bộ cài NSIS chạy ngầm tự động thay thế binary `%LOCALAPPDATA%\Programs\sp16-desktop-assistant\DesktopAssistantSpike.exe` (phiên bản ProductVersion nâng từ `1.0.0.0` lên `1.0.1.0`).
   - Ứng dụng tự động khởi chạy lại dưới phiên bản mới v1.0.1 (PID 25340), hiển thị UI màu xanh lục. Đã chụp ảnh màn hình bằng chứng: [evidence/screenshot-v1.0.1-updated.png](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/screenshot-v1.0.1-updated.png).
   - v1.0.1 kiểm tra lại server và ghi log: *"Không có bản mới. Bản hiện tại v1.0.1 là mới nhất"*.

- **Bằng chứng log chi tiết:** Toàn bộ lịch trình thời gian và tiến trình ghi nhận tại [evidence/updater-app.log](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/updater-app.log#L1-L45) và [evidence/server-requests.log](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/server-requests.log).

---

### Q5 — Auto-update xung đột gì với app chạy nền và có job đang chạy không (FR-APP-06: thoát hẳn cần xác nhận khi còn job)?

**1. Hai điểm xung đột kỹ thuật phát hiện được:**
- **Xung đột 1 (App chạy nền trong Tray):**
  - FR-APP-06 quy định: đóng cửa sổ app = thu về System Tray, app và desktop pet tiếp tục chạy ngầm.
  - Mặc định của `electron-updater` là `autoInstallOnAppQuit = true` (tự động cài đặt khi ứng dụng thoát). Do app chạy nền trong Tray và người dùng gần như không bao giờ thực hiện "Thoát hẳn", bản cập nhật đã tải xong sẽ **nằm chờ vô thời hạn** và không bao giờ được áp dụng nếu không có cơ chế can thiệp chủ động.
- **Xung đột 2 (Job đang chạy dở dang):**
  - Nếu app lập tức gọi `autoUpdater.quitAndInstall()` ngay khi vừa tải xong file cập nhật, ứng dụng sẽ bị kill tức thì. Mọi tác vụ đồng bộ Notion, gửi lệnh Claude, hoặc ghi ledger SQLite đang chạy sẽ bị đứt gãy giữa chừng, vi phạm trực tiếp nguyên tắc toàn vẹn của FR-APP-06.

**2. Giải pháp kiến trúc và kiểm chứng:**
- **Bước 1:** Tắt cài đặt tự động khi thoát bằng cách cấu hình tường minh:
  ```javascript
  autoUpdater.autoInstallOnAppQuit = false;
  ```
- **Bước 2:** Bắt sự kiện `update-downloaded`, kiểm tra biến trạng thái `activeJob`:
  - **Nếu KHÔNG có job:** Phát sinh thẻ thông báo hệ thống (SYSTEM notification card) thông báo cho người dùng biết bản cập nhật đã sẵn sàng, kèm nút "Khởi động lại ngay" và "Để sau". Hoặc có thể tự động lên lịch restart vào thời điểm app idle.
  - **Nếu ĐANG CÓ job:** Ứng dụng **hoãn lệnh restart**, hiển thị dialog cảnh báo theo đúng tinh thần FR-APP-06: *"Đang có tác vụ '[Tên job]' đang chạy. Bạn có muốn đợi tác vụ hoàn tất hay hủy tác vụ để cập nhật ngay?"*.
  - Lệnh `autoUpdater.quitAndInstall(true, true)` chỉ được phép kích hoạt sau khi job chuyển sang trạng thái kết thúc (DONE/FAILED) hoặc người dùng chủ động bấm xác nhận.

- **Bằng chứng triển khai:** Xem mã nguồn xử lý xung đột tại [src/app/main.js:103-122](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/src/app/main.js#L103-L122) và IPC handlers tại [src/app/main.js:145-159](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/src/app/main.js#L145-L159).

---

### Q6 — Tổng lead time từ lúc quyết định mua tới lúc ký được bản build thật?

Tổng thời gian phụ thuộc trực tiếp vào phương án nhà cung cấp mà Product Owner lựa chọn:

1. **Phương án Cloud Signing Doanh nghiệp — Azure Trusted Signing (Tối ưu nhất):**
   - **Tổng lead time: 5 – 10 ngày làm việc.**
   - *Chi tiết:* Nộp hồ sơ ĐKKD và mã D-U-N-S lên Microsoft Partner Center (3 – 5 ngày làm việc) → Duyệt xác thực danh tính tổ chức (1 – 2 ngày) → Tạo Trusted Signing Account trên Azure Portal và cấu hình GitHub Actions (1 ngày). Không tốn thời gian chờ bưu điện chuyển phát.
2. **Phương án Cloud Signing Cá nhân — SSL.com eSigner (Nhanh nhất cho Solo Dev):**
   - **Tổng lead time: 3 – 5 ngày làm việc.**
   - *Chi tiết:* Nộp ảnh chụp Hộ chiếu/CCCD + Sao kê ngân hàng/Hóa đơn tiện ích + Quét khuôn mặt sinh trắc học online (1 ngày) → CA thẩm định thông tin cá nhân (2 – 3 ngày) → Kích hoạt tài khoản eSigner đám mây và tạo credential ký CI qua `CodeSignTool` (1 ngày).
3. **Phương án truyền thống dùng Hardware USB Token (Sectigo / DigiCert):**
   - **Tổng lead time: 2 – 4 tuần.**
   - *Chi tiết:* Thẩm định hồ sơ (3 – 5 ngày) → Cấu hình nạp private key vào token phần cứng vật lý tại Mỹ/Âu (1 – 2 ngày) → Vận chuyển quốc tế DHL/FedEx về Việt Nam (7 – 15 ngày) → Thông quan hải quan và kiểm tra thiết bị mật mã (3 – 7 ngày). Rất dễ bị tắc nghẽn ở khâu hải quan.

- **Bằng chứng:** Xem sơ đồ quy trình tại [evidence/procurement-checklist.md §4](file:///d:/projects/desktop-assistant/spikes/SP-16-signing-update/evidence/procurement-checklist.md#L69-L88).

---

### Q7 — Với cert tự ký, auto-update có bị chặn ở bước nào không? Nếu CÓ thì mốc phải mua cert bị kéo sớm lên — đây là câu quyết định lịch mua sắm.

**1. Với cert tự ký, auto-update bị chặn ở đâu?**
- **Trên môi trường dev / máy nội bộ đã import root cert:** **KHÔNG BỊ CHẶN BẤT CỨ BƯỚC NÀO.** Dry-run đã chứng minh toàn bộ pipeline từ download, verify SHA-512, verify WinVerifyTrust, giải nén cài đè và restart đều hoạt động trơn tru.
- **Trên máy người dùng thực tế bên ngoài (Closed Beta):** **BỊ CHẶN TUYỆT ĐỐI TẠI BƯỚC XÁC THỰC CHỮ KÝ.**
  - `electron-updater` sử dụng Windows API để kiểm tra tính hợp lệ của chuỗi chứng chỉ (Certificate Chain) so với danh sách Root CA của Microsoft.
  - Khi người dùng bên ngoài tải bản cập nhật ký bằng cert tự ký, Windows trả về lỗi mã `CERT_E_UNTRUSTEDROOT (0x800B0109)`.
  - `electron-updater` coi đây là hành vi giả mạo/tấn công Man-In-The-Middle, lập tức xóa file tải về và không thực hiện cài đặt.

**2. Quyết định lịch mua sắm (Mốc kích hoạt):**
- Theo phân tích hiện tại, việc mua chứng chỉ **KHÔNG CHẶN Milestone M0**, vì việc phát triển tính năng và thử nghiệm nội bộ trong nhóm phát triển chỉ cần cài đặt root cert tự ký một lần duy nhất qua script `setup-cert.ps1`.
- Tuy nhiên, theo **nguyên tắc PRD §1**: *"Người dùng đầu tiên (Closed Beta) phải trải nghiệm qua ĐÚNG các luồng chính thức, bao gồm cả luồng auto-update"*.
- Vì vậy, **chứng chỉ ký số thương mại bắt buộc phải sẵn sàng TRƯỚC KHI PHÁT HÀNH BẢN CLOSED BETA ĐẦU TIÊN (kết thúc Milestone M1)**.
- Do tổng thời gian thẩm định danh tính mất từ 5 đến 10 ngày làm việc (1–2 tuần), **Product Owner cần bấm nút phê duyệt mua sắm muộn nhất là 2 TUẦN TRƯỚC NGÀY PHÁT HÀNH M1**.

---

## 2. Tác động lên ADR / PRD

1. **ADR-009 (Monorepo, đóng gói, native):**
   - **Xác nhận giữ nguyên:** Lựa chọn công nghệ `electron-builder` + `electron-updater` được khẳng định là hoàn toàn chính xác, đáp ứng đầy đủ yêu cầu auto-update và tích hợp Authenticode signing trên Windows.
   - **Bổ sung vào ADR-009:** Bổ sung điều khoản về phương thức ký số Windows: Do quy định CA/B Forum (tháng 6/2023) xóa bỏ file PFX truyền thống, hệ thống CI/CD bắt buộc phải dùng **Cloud Signing Service** (Azure Trusted Signing hoặc SSL.com eSigner), không dùng USB Hardware Token.
2. **FR-BE-09 (Version check & update manifest):**
   - **Làm rõ kỹ thuật:** Phía backend chỉ cần lưu trữ và trả về file manifest tĩnh `latest.yml` (hoặc endpoint sinh YAML) cùng các file nhị phân `.exe` và `.blockmap`. Backend **không cần** cài đặt cơ chế ký số PKI trên file manifest, vì tính toàn vẹn và xác thực đã được đảm bảo bằng SHA-512 và WinVerifyTrust.
3. **FR-APP-06 (System tray & Thoát app):**
   - **Xác nhận và chuẩn hóa:** Cần cấu hình `autoUpdater.autoInstallOnAppQuit = false`. Thao tác cập nhật phải liên kết chặt chẽ với trạng thái thực thi của Agent/Job. Nếu có job đang chạy, hiển thị dialog xác nhận trước khi cho phép restart app.

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Cấu hình `package.json` cho `electron-builder`:**
   ```json
   "build": {
     "appId": "com.desktopassistant.spike16",
     "productName": "DesktopAssistantSpike",
     "directories": { "output": "dist" },
     "win": {
       "target": ["nsis"],
       "verifyUpdateCodeSignature": true,
       "signingHashAlgorithms": ["sha256"],
       "rfc3161TimeStampServer": "http://timestamp.digicert.com"
     },
     "nsis": {
       "oneClick": true,
       "perMachine": false,
       "allowElevation": true,
       "deleteAppDataOnUninstall": false
     },
     "publish": [
       {
         "provider": "generic",
         "url": "https://api.yourdomain.com/updates"
       }
     ]
   }
   ```
2. **Quản lý vòng đời cập nhật trong tiến trình chính (`main.js`):**
   - Khởi tạo kiểm tra cập nhật định kỳ (mỗi 2-4 tiếng).
   - Bắt sự kiện `update-available` để thông báo cho người dùng.
   - Bắt sự kiện `download-progress` để cập nhật thanh tiến trình nếu người dùng mở màn hình Settings/About.
   - Bắt sự kiện `update-downloaded` để kiểm tra `activeJob` và gửi thông báo hệ thống mời người dùng khởi động lại.
3. **Kịch bản CI/CD Signing (GitHub Actions):**
   - Nếu dùng Azure Trusted Signing: Tích hợp action chính thức `azure/trusted-signing-action`.
   - Nếu dùng SSL.com eSigner: Tích hợp công cụ `CodeSignTool` với `ESIGNER_CREDENTIALS` lưu trong GitHub Secrets.

---

## 4. Rủi ro mới phát hiện

1. **Rủi ro SmartScreen với chứng chỉ OV (nếu đăng ký tư cách Cá nhân):**
   - Nếu Product Owner chưa có pháp nhân công ty và bắt buộc phải mua chứng chỉ OV cá nhân của SSL.com hoặc Certum, những người dùng Closed Beta đầu tiên sẽ thấy cảnh báo SmartScreen màu xanh dương. Cần chuẩn bị trước tài liệu hướng dẫn người dùng bấm *"More info" → "Run anyway"*, đồng thời nộp mẫu file lên Microsoft Security Intelligence ngay khi build xong.
2. **Nguy cơ kẹt pipeline nếu dùng USB Hardware Token:**
   - Tuyệt đối tránh mua các gói chứng chỉ giá rẻ gửi kèm USB token nếu muốn triển khai CI/CD đám mây tự động.
3. **Thủ tục hải quan nhập khẩu USB token tại Việt Nam:**
   - Việc chuyển phát thiết bị phần cứng chứa khóa mật mã từ nước ngoài về Việt Nam thường xuyên bị cơ quan bưu chính hải quan giữ lại yêu cầu giấy phép mật mã dân sự, có thể làm trễ lịch phát hành tới 1 tháng.

---

## 5. Chưa trả lời được + vì sao

- **Quy trình ký số và Notarization trên macOS (Apple Developer ID):**
  - Trạng thái: **ĐÃ KIỂM CHỨNG** tại `spikes/SP-16-signing-update/macos/REPORT.md`.
  - Dry-run auto-update chạy trọn vẹn với chứng chỉ có tên, nên kết luận "việc mua không chặn M0" **giống Windows**.
  - Khác Windows ở hai điểm quyết định lịch: Gatekeeper trên macOS 15+ đã bỏ đường Control-Click nên bản chưa notarize hoàn toàn không mở được, và đổi chữ ký giữa hai bản sẽ thu hồi cả credential trong Keychain lẫn quyền TCC đã cấp. Apple Developer Program vì vậy phải có tối thiểu 2 tuần trước Closed Beta. Ràng buộc đã vào spec qua `req-023-macos-platform-baseline`.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

- **Hệ điều hành kiểm nghiệm:** Windows 11 Home Single Language (Version 24H2, OS Build 26200.5670, 64-bit)
- **Node.js:** `v24.21.0`
- **npm:** `11.5.0`
- **electron:** `44.3.0`
- **electron-builder:** `26.15.3`
- **electron-updater:** `6.8.9`
- **Windows SDK SignTool:** `signtool.exe` Version `10.0.26100.0`
- **PowerShell:** `5.1.26100.5670`
