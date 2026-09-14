# CHECKLIST MUA SẮM CODE SIGNING & APPLE DEVELOPER (MACOS)
## Desktop Assistant — M0 Spike SP-16/mac Evidence

> **Mục đích:** Tài liệu hướng dẫn và bảng dự toán chi phí dành cho Product Owner nhằm quyết định đăng ký tài khoản Apple Developer và thiết lập hạ tầng ký số (Developer ID Application, Notarization) cho ứng dụng Desktop Assistant trên macOS.
> **Quan hệ:** Tài liệu này nối tiếp trực tiếp và tích hợp cùng [Checklist Windows](../../evidence/procurement-checklist.md) để Product Owner có cái nhìn toàn cảnh về tổng ngân sách và lịch trình ký số trên cả hai hệ điều hành.
> **Nguyên tắc PRD §1:** Người dùng đầu tiên (Closed Beta) phải trải nghiệm ĐÚNG luồng phân phối chính thức gồm auto-update và Gatekeeper sạch.

---

## 1. QUYẾT ĐỊNH CỦA PRODUCT OWNER (VUI LÒNG ĐIỀN VÀO ĐÂY)

Vui lòng đánh dấu `[x]` vào MỘT trong hai tư cách chủ thể đứng tên đăng ký tài khoản Apple Developer:

- [ ] **Cá nhân (Individual / Solo Developer)**
- [ ] **Pháp nhân doanh nghiệp (Organization / LLC / Công ty)**

*(Ghi chú: Lựa chọn này quyết định trực tiếp tên hiển thị trên chứng chỉ Gatekeeper của người dùng cuối — tên cá nhân hay tên công ty — và danh sách giấy tờ pháp lý cần chuẩn bị).*

---

## 2. TỔNG HỢP CHI PHÍ KÝ SỐ TOÀN DỰ ÁN (WINDOWS + MACOS)

Bảng tổng hợp ngân sách tối ưu để ứng dụng chạy sạch trên cả 2 hệ điều hành:

| Hệ điều hành | Dịch vụ / Nhà cung cấp | Tư cách đăng ký | Chi phí năm đầu | Phí gia hạn hàng năm | Lead time kích hoạt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **macOS** | **Apple Developer Program** | **Cá nhân** | **$99 USD** (~2.250.000 VNĐ) | **$99 USD/năm** | 1 – 2 ngày làm việc |
| **macOS** | **Apple Developer Program** | **Doanh nghiệp** | **$99 USD** (~2.250.000 VNĐ) | **$99 USD/năm** | 5 – 10 ngày làm việc (chờ D-U-N-S) |
| **Windows** | **Azure Trusted Signing** *(Khuyến nghị Org)* | **Doanh nghiệp** | **~$120 USD** ($9.99/tháng) | **~$120 USD/năm** | 5 – 10 ngày làm việc |
| **Windows** | **SSL.com eSigner Cloud** *(Khuyến nghị Solo)* | **Cá nhân** | **~$129 – $179 USD** | **~$129 – $179 USD/năm** | 3 – 5 ngày làm việc |
| **TỔNG CỘNG (Kịch bản Doanh nghiệp)** | Apple ($99) + Azure ($120) | **Doanh nghiệp** | **~$219 USD/năm** (~5.500.000 VNĐ) | **~$219 USD/năm** | **Tối đa 10 ngày làm việc** |
| **TỔNG CỘNG (Kịch bản Cá nhân)** | Apple ($99) + SSL.com ($129) | **Cá nhân** | **~$228 – $278 USD/năm** | **~$228 – $278 USD/năm** | **Tối đa 5 ngày làm việc** |

---

## 3. CHI TIẾT TÀI KHOẢN & CHỨNG CHỈ MACOS

### 3.1. Các loại chứng chỉ Apple cấp trong gói Developer Program ($99/năm)
Apple không bán lẻ từng chứng chỉ; phí thường niên **$99 USD/năm** đã bao gồm quyền tạo và quản lý toàn bộ các chứng chỉ sau trên [developer.apple.com](https://developer.apple.com):

1. **Developer ID Application:**
   - **Bắt buộc:** Dùng để ký các file thực thi `.app`, Mach-O binary, dylib, framework và container `.dmg`.
   - Đảm bảo vượt qua Gatekeeper và nộp lên Apple Notary Service (`xcrun notarytool`).
   - Tối đa: 5 chứng chỉ hoạt động đồng thời trên mỗi tài khoản.
2. **Developer ID Installer:**
   - Dùng để ký các gói cài đặt định dạng `.pkg` (nếu dự án phân phối qua installer thay vì kéo thả `.dmg`).
3. **Apple Notarization Ticket (Cloud Service):**
   - Không tốn thêm chi phí; nộp không giới hạn số lần qua `xcrun notarytool`.

### 3.2. So sánh tư cách đăng ký Apple Developer: Cá nhân vs Doanh nghiệp

| Tiêu chí | Đăng ký Cá nhân (Individual) | Đăng ký Doanh nghiệp (Organization) |
| :--- | :--- | :--- |
| **Tên hiển thị Gatekeeper** | Tên đầy đủ trên CCCD/Passport của người đăng ký (ví dụ: *"Tên cá nhân trên giấy tờ"*). | Tên pháp nhân công ty đã đăng ký (ví dụ: *"Desktop Assistant Co., Ltd"*). |
| **Điều kiện tiên quyết** | - Apple ID có bật 2FA.<br>- Thẻ thanh toán quốc tế (Visa/Mastercard) mang tên người đăng ký. | - BẮT BUỘC có **Mã số D-U-N-S** (Dun & Bradstreet) 9 chữ số.<br>- Tư cách pháp nhân hợp pháp (Công ty TNHH/CP).<br>- Website công ty truy cập được.<br>- Email tên miền công ty. |
| **Hồ sơ & Giấy tờ** | - Căn cước công dân gắn chip hoặc Hộ chiếu còn hạn.<br>- Quét khuôn mặt sinh trắc học trực tiếp trên iPhone/iPad/Mac. | - Giấy chứng nhận ĐKKD công chứng / scan màu có dấu đỏ.<br>- Thông tin mã D-U-N-S khớp 100% tên và địa chỉ công ty.<br>- Văn bản ủy quyền của người đại diện pháp luật (nếu người đăng ký không phải đại diện pháp luật). |
| **Cách nộp đơn** | Nộp trực tiếp trên ứng dụng **Apple Developer** (iOS/macOS). | Nộp trực tuyến tại [developer.apple.com/enroll](https://developer.apple.com/enroll/). |
| **Thời gian kích hoạt** | **Nhanh:** Thường từ **vài giờ đến 24–48 giờ**. | **5 – 10 ngày làm việc** (5–7 ngày đăng ký D-U-N-S nếu chưa có, cộng 2–3 ngày Apple thẩm định và gọi điện xác thực). |

---

## 4. QUY TRÌNH MUA SẮM VÀ THIẾT LẬP KÝ SỐ CI TRÊN MACOS

```
[Mốc M1 - 2 tuần trước Closed Beta] Product Owner chốt tư cách & mua tài khoản
   │
   ├─► NẾU CHỌN CÁ NHÂN:
   │     ├─ Ngày 1: Tải app Apple Developer trên iPhone/Mac, đăng nhập Apple ID chính chủ.
   │     ├─ Ngày 1: Quét CCCD/Hộ chiếu và quét khuôn mặt (Face match liveness).
   │     ├─ Ngày 1: Thanh toán $99 USD qua Apple Pay / Thẻ tín dụng quốc tế.
   │     └─ Ngày 2: Tài khoản kích hoạt thành công (thông báo qua email).
   │
   └─► NẾU CHỌN DOANH NGHIỆP:
         ├─ Ngày 1: Kiểm tra hoặc đăng ký miễn phí mã D-U-N-S tại dnb.com (chờ 5–7 ngày).
         ├─ Ngày 6: Nhận mã D-U-N-S, truy cập developer.apple.com/enroll chọn Organization.
         ├─ Ngày 7: Nhập mã D-U-N-S, thông tin ĐKKD, website và email tên miền công ty.
         ├─ Ngày 8: Tiếp nhận cuộc gọi xác minh bằng tiếng Anh/Việt từ nhân viên Apple.
         ├─ Ngày 9: Thanh toán phí $99 USD sau khi Apple phê duyệt hồ sơ.
         └─ Ngày 10: Tài khoản tổ chức kích hoạt thành công.
```

### Thiết lập ký số trong GitHub Actions / CI Runner sau khi có tài khoản:
1. Tạo chứng chỉ **Developer ID Application** trên Apple Developer portal.
2. Xuất chứng chỉ và private key ra file `.p12` có đặt mật khẩu bảo vệ mạnh.
3. Tạo **App Store Connect API Key** (với quyền `Developer` hoặc `Admin` để notarize) $\rightarrow$ tải file `AuthKey_<KeyID>.p8`.
4. Lưu các biến bí mật vào GitHub Repository Secrets:
   - `APPLE_CERTIFICATE`: Chuỗi Base64 của file `.p12`.
   - `APPLE_CERTIFICATE_PASSWORD`: Mật khẩu giải mã `.p12`.
   - `APPLE_API_KEY`: Nội dung file khóa riêng tư `.p8`.
   - `APPLE_API_KEY_ID`: Key ID gồm 10 ký tự.
   - `APPLE_API_ISSUER`: Issuer ID dạng UUID.
   - `APPLE_TEAM_ID`: Team ID gồm 10 ký tự (ví dụ: `ABCDE12345`).
5. Trong workflow CI:
   - Tự động tạo temporary keychain trên runner macOS, import `.p12`.
   - `electron-builder` tự động ký app bundle với Hardened Runtime và entitlements.
   - `electron-builder` tự động gọi `@electron/notarize` sử dụng API Key để submit lên Apple Notary Service và staple ticket.

---

## 5. RỦI RO & LƯU Ý SỐNG CÒN TRÊN MACOS

1. **Gatekeeper trên macOS Sequoia (macOS 15+) loại bỏ Control-Click Bypass:**
   - Trước macOS 15, người dùng có thể nhấp chuột phải (Control-Click) rồi chọn "Open" để vượt qua cảnh báo app chưa notarize.
   - Kể từ macOS Sequoia, Apple đã **loại bỏ hoàn toàn** tùy chọn này. Người dùng bắt buộc phải mở System Settings > Privacy & Security > cuộn xuống mục Security bấm "Open Anyway" và nhập mật mã quản trị máy.
   - Rủi ro: Trải nghiệm onboarding cho người dùng Closed Beta sẽ thất bại hoàn toàn nếu bản build không được Notarize chính thức.
2. **Quyền TCC và Keychain bị thu hồi nếu không có Developer ID (Q8):**
   - Nếu phát hành bản tự ký hoặc ad-hoc, mỗi lần auto-update người dùng sẽ bị hệ thống `SecurityAgent` bật pop-up đòi mật khẩu máy để truy cập Keychain (SP-11/mac Q3).
   - Quyền Screen Recording và Accessibility trong `TCC.db` sẽ bị mất hiệu lực vì cdhash thay đổi.
   - Bắt buộc phải có Apple Developer ID trước khi đưa bản Closed Beta đầu tiên đến tay người dùng thực tế.
3. **Sao lưu khóa riêng tư (Private Key) và Chứng chỉ .p12:**
   - Chứng chỉ Developer ID gắn liền với private key tạo trên máy ban đầu. Nếu mất private key, không thể phục hồi và phải tạo chứng chỉ mới (tối đa chỉ được 5 chứng chỉ active). Cần lưu trữ bản backup `.p12` trong Bitwarden/1Password của Product Owner ngay khi tạo.
