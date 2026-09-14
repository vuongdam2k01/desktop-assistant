# CHECKLIST MUA SẮM CODE SIGNING CERTIFICATE (WINDOWS)
## Desktop Assistant — M0 Spike SP-16 Evidence

> **Mục đích:** Tài liệu hướng dẫn và bảng tra cứu dành cho Product Owner nhằm quyết định mua chứng chỉ ký số (Code Signing Certificate) và dịch vụ ký số phù hợp nhất cho dự án Desktop Assistant trên Windows.
> **Nguyên tắc:** PRD §1 quy định người dùng đầu tiên (Closed Beta) phải trải nghiệm ĐÚNG luồng phân phối chính thức gồm auto-update. M0 chạy dry-run bằng cert tự ký, nhưng cert thương mại phải sẵn sàng trước khi phát hành bản Closed Beta đầu tiên.

---

## 1. QUYẾT ĐỊNH CỦA PRODUCT OWNER (VUI LÒNG ĐIỀN VÀO ĐÂY)

Vui lòng đánh dấu `[x]` vào MỘT trong hai tư cách chủ thể đứng tên đăng ký chứng chỉ:

- [ ] **Cá nhân (Individual / Developer độc lập)**
- [ ] **Pháp nhân doanh nghiệp (Organization / LLC / Công ty)**

*(Ghi chú: Quyết định này quyết định trực tiếp nhà cung cấp và loại chứng chỉ có thể mua, xem chi tiết ở các bảng so sánh bên dưới).*

---

## 2. BẢNG SO SÁNH CÁC NHÀ CUNG CẤP & PHƯƠNG ÁN MUA SẮM

> *Lưu ý quan trọng từ CA/Browser Forum (áp dụng từ 01/06/2023):* Cả chứng chỉ OV lẫn EV đều **bắt buộc** lưu private key trên phần cứng bảo mật (FIPS 140-2 Level 2+ hoặc CC EAL 4+). Không còn hình thức cấp file PFX truyền thống tải về máy tính cá nhân. Vì vậy, lựa chọn thực tế hiện nay là: **Hardware Token (USB vật lý gửi qua đường bưu điện)** hoặc **Cloud Signing Service (HSM trên đám mây)**.

| Tiêu chí | Phương án 1: Azure Trusted Signing (Khuyến nghị số 1 cho Doanh nghiệp) | Phương án 2: SSL.com Code Signing + eSigner (Khuyến nghị số 1 cho Cá nhân) | Phương án 3: Sectigo Code Signing (via TheSSLStore/CheapSSL) | Phương án 4: DigiCert EV Code Signing (Enterprise) | Phương án 5: Certum Commercial + SimplySign (EU) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Loại dịch vụ** | Cloud HSM Native của Microsoft | Cloud Signing (eSigner) hoặc Hardware USB | Hardware USB Token (SafeNet eToken 5110) | Hardware USB Token hoặc DigiCert ONE Cloud | Cloud Signing (SimplySign app OTP) hoặc USB |
| **Cá nhân mua được không?** | ❌ **KHÔNG** (Chỉ dành cho tổ chức đã verify trên Microsoft Partner Center) | ✅ **CÓ** (Hỗ trợ Individual Validation qua ID + video/utility bill) | ✅ **CÓ** (Gói OV hỗ trợ cá nhân qua KYC) | ❌ **KHÔNG** (Hầu như chỉ phục vụ tổ chức/doanh nghiệp) | ✅ **CÓ** (Hỗ trợ xác minh công dân toàn cầu qua passport) |
| **Giá niêm yết công bố** | **Basic SKU:** \$9.99/tháng (~**\$120/năm**). Gồm 100 lần ký/tháng, \$0.05/lần phụ trội. | **OV:** \$129 - \$179/năm.<br>**EV:** \$249 - \$349/năm.<br>eSigner: Tier 1 miễn phí một số lần ký, \$20/tháng nếu vượt. | **OV:** ~\$220 - \$280/năm.<br>**EV:** ~\$380 - \$460/năm.<br>Phí ship USB quốc tế: ~\$60 - \$100. | **EV:** \$799 - \$899/năm (kèm USB).<br>DigiCert ONE: \$1,500 - \$3,000+/năm. | **OV SimplySign:** ~€150 - €220/năm (~\$160 - \$240).<br>**EV SimplySign:** ~€350 - €450/năm. |
| **Thời gian lead time** | **5 - 10 ngày làm việc** (Vetting pháp nhân trên Partner Center, không chờ ship) | **3 - 5 ngày làm việc** (Xác minh online, kích hoạt eSigner ngay, không chờ ship) | **2 - 4 tuần** (Thẩm định 3-5 ngày + ship FedEx USB từ Mỹ/Âu về VN 7-15 ngày) | **2 - 3 tuần** (Thẩm định nghiêm ngặt + ship USB) | **3 - 7 ngày làm việc** (Xác minh online qua ứng dụng ID, cấp chứng thư đám mây) |
| **Ký trong CI/CD (Cloud Runners)** | ⭐⭐⭐⭐⭐ **Cực kỳ mượt mà**. Tích hợp GitHub Actions qua official action của Azure, không cần phần cứng. | ⭐⭐⭐⭐ **Rất tốt**. Tích hợp qua CLI `CodeSignTool` hoặc Docker container / GitHub Actions. | ⭐ **Kém**. Bắt buộc cắm USB token vào Self-Hosted Runner vật lý, rủi ro kẹt PIN. | ⭐⭐ Cần gói DigiCert ONE đắt đỏ (\$2k+) mới ký cloud CI được; bản token phải cắm vật lý. | ⭐⭐⭐ Hỗ trợ qua SimplySign Desktop console tool trên Windows runner. |
| **SmartScreen Reputation** | ⭐⭐⭐⭐⭐ **Đạt ngay lập tức** (Instant reputation do liên kết trực tiếp Microsoft telemetry). | **EV:** Đạt ngay.<br>**OV:** Cần tích lũy vài trăm lượt tải sạch (2-4 tuần). | **EV:** Đạt ngay.<br>**OV:** Cần tích lũy vài trăm lượt tải sạch. | **EV:** Đạt ngay lập tức. | **EV:** Đạt ngay.<br>**OV:** Cần tích lũy. |
| **Link mua & tài liệu** | [Azure Artifact/Trusted Signing](https://learn.microsoft.com/en-us/azure/trusted-signing/) | [SSL.com Code Signing](https://www.ssl.com/certificates/code-signing/) | [Sectigo Code Signing](https://sectigo.com/ssl-certificates-tls/code-signing-certificates) | [DigiCert Code Signing](https://www.digicert.com/signing/code-signing-certificates) | [Certum Code Signing](https://www.certum.eu/en/code-signing-certificates/) |

---

## 3. HỒ SƠ & GIẤY TỜ CẦN CHUẨN BỊ THEO TỪNG TRƯỜNG HỢP

### Trường hợp A: Đăng ký dưới tư cách Doanh nghiệp / Tổ chức (Organization)

Áp dụng khi chọn **Azure Trusted Signing**, **SSL.com (Org)**, hoặc **Sectigo (Org)**:

1. **Giấy chứng nhận đăng ký doanh nghiệp (ĐKKD / Giấy phép kinh doanh):** Bản scan màu công chứng hoặc bản gốc có dấu đỏ, thể hiện rõ tên công ty, mã số thuế, địa chỉ trụ sở hợp pháp, người đại diện theo pháp luật.
2. **Mã số D-U-N-S (Dun & Bradstreet):**
   - Hầu hết các CA quốc tế và Microsoft Partner Center dùng cơ sở dữ liệu D&B để tra cứu đối soát thông tin pháp nhân.
   - Nếu công ty chưa có mã DUNS: Cần đăng ký tại [dnb.com](https://www.dnb.com) (miễn phí, mất khoảng 5-7 ngày làm việc, hoặc trả phí express 1-2 ngày).
3. **Số điện thoại bàn doanh nghiệp được niêm yết công khai:**
   - CA sẽ thực hiện cuộc gọi xác minh độc lập (Callback Verification).
   - Số điện thoại phải tra cứu được trên danh bạ công khai độc lập (ví dụ Yellow Pages / Trang vàng Việt Nam, tổng đài 1080, hoặc hồ sơ D&B).
4. **Tên miền website chính thức (Domain ownership):**
   - Domain công ty (ví dụ `desktopassistant.com` hoặc tên miền công ty).
   - Email đăng ký phải dùng email tên miền công ty (ví dụ `contact@...`, `admin@...`), CA **từ chối** email miễn phí (@gmail.com, @yahoo.com).
5. **Thư xác nhận pháp lý (Legal Opinion Letter - nếu mua EV):**
   - Với gói EV của DigiCert/Sectigo, có thể cần luật sư hoặc công chứng viên ký xác nhận form mẫu của CA. (Azure Trusted Signing không đòi hỏi bước này).

### Trường hợp B: Đăng ký dưới tư cách Cá nhân (Individual / Solo Developer)

Áp dụng khi chọn **SSL.com (Individual)** hoặc **Certum (Individual)**:

1. **Căn cước công dân (CCCD) hoặc Hộ chiếu (Passport):** Còn hạn, chụp rõ 2 mặt, không mất góc, không bị lóa sáng.
2. **Chứng minh địa chỉ cư trú (Proof of Address):**
   - Sao kê tài khoản ngân hàng (Bank Statement) trong vòng 3 tháng gần nhất, có tên và địa chỉ trùng khớp với CCCD/hồ sơ đăng ký; HOẶC
   - Hóa đơn tiện ích (điện, nước, internet cáp quang) đứng tên cá nhân trong 3 tháng gần nhất.
3. **Xác minh trực tuyến (Online Video / KYC Verification):**
   - Thực hiện cuộc gọi video hoặc quét khuôn mặt (Face match liveness) qua công cụ tự động của đối tác xác minh của CA (như Jumio, IDnow).
4. **Số điện thoại di động chính chủ:** Nhận SMS OTP và cuộc gọi thoại tự động để xác minh quyền sở hữu số điện thoại.

---

## 4. CHI TIẾT LEAD TIME & TRÌNH TỰ TRIỂN KHAI THỰC TẾ

```
[Ngày 0] Product Owner chốt tư cách (Cá nhân vs Doanh nghiệp) & chọn Nhà cung cấp
   │
   ├─► NẾU DOANH NGHIỆP: Chọn Microsoft Azure Trusted Signing (Tối ưu nhất)
   │     ├─ Ngày 1: Đăng ký tài khoản Microsoft Partner Center & Azure Subscription
   │     ├─ Ngày 2–4: Nộp hồ sơ ĐKKD + kiểm tra D-U-N-S + nhận cuộc gọi xác minh
   │     ├─ Ngày 5: Tài khoản Partner Center được duyệt (Verified)
   │     ├─ Ngày 6: Tạo Trusted Signing Account & Certificate Profile trên Azure Portal
   │     └─ Ngày 7: Cấu hình GitHub Actions / CI pipeline qua `azure/trusted-signing-action`
   │     ==> TỔNG THỜI GIAN: 5 – 8 ngày làm việc. Chi phí: ~$10/tháng.
   │
   └─► NẾU CÁ NHÂN: Chọn SSL.com Code Signing + eSigner Cloud
         ├─ Ngày 1: Đặt mua chứng chỉ OV Code Signing trên SSL.com, chọn tùy chọn eSigner
         ├─ Ngày 2: Nộp ảnh Passport/CCCD + Sao kê ngân hàng/Hóa đơn + Face KYC
         ├─ Ngày 3–4: SSL.com thẩm định và hoàn tất cấp chứng chỉ lên kho eSigner
         └─ Ngày 5: Tạo eSigner credentials, tích hợp vào CI qua CLI `CodeSignTool`
         ==> TỔNG THỜI GIAN: 3 – 5 ngày làm việc. Chi phí: ~$129 - $179/năm.
```

---

## 5. RỦI RO & BẪY MUA SẮM CẦN TRÁNH

1. **Bẫy mua Hardware Token vật lý (USB token):**
   - Không nên mua gói nhận USB token nếu định chạy build tự động trên GitHub Actions / GitLab Cloud.
   - Vận chuyển quốc tế DHL/FedEx từ Mỹ về Việt Nam thường xuyên bị vướng thủ tục hải quan khai báo thiết bị mật mã, kéo dài thời gian nhận hàng lên 3-4 tuần, và phát sinh thuế nhập khẩu.
   - Phải cắm thường trực vào một máy tính vật lý làm CI runner, rất dễ đứt gãy pipeline nếu máy runner restart hoặc token bị lỏng.
2. **Bẫy SmartScreen với chứng chỉ OV mới:**
   - Nếu mua chứng chỉ OV cá nhân của SSL.com/Sectigo, ở 50 - 200 lượt tải đầu tiên, người dùng Windows sẽ thấy màn hình SmartScreen màu xanh dương cảnh báo "Unrecognized app".
   - *Cách khắc phục:* Gửi bản build kèm mã hash lên cổng [Microsoft Security Intelligence Submission](https://www.microsoft.com/en-us/wdsi/filesubmission) để Microsoft quét và cập nhật whitelist trước khi gửi link cho tester Closed Beta.
3. **Mốc thời gian kích hoạt mua sắm:**
   - Dù M0 không bị chặn bởi chứng chỉ thương mại (nhờ dry-run thành công bằng cert tự ký), nhưng **thời gian thẩm định mất từ 5 đến 10 ngày**.
   - Do đó, Product Owner cần **bấm nút mua sắm trước ngày kết thúc Milestone M1 (ít nhất 2 tuần trước ngày phát hành Closed Beta đầu tiên)** để kịp hoàn tất xác minh danh tính và kiểm thử ký bản release production.
