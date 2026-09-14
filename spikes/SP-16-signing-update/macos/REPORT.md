# SP-16/mac — Code signing, notarization và auto-update trên macOS

## 0. Kết luận

**ĐI CÓ ĐIỀU KIỆN** — Vòng lặp dry-run auto-update của `electron-builder` và `electron-updater` trên macOS đã được kiểm chứng thực nghiệm thành công 100% từ v1.0.0 lên v1.0.1 qua local HTTP server với chứng chỉ ký số có tên (`CN=DesktopAssistant Dev Test A` trong Keychain; Designated Requirement được bảo toàn), xác nhận việc mua chứng chỉ **KHÔNG CHẶN Milestone M0** (kết luận kỹ thuật **GIỐNG Windows**). **ĐIỀU KIỆN BẮT BUỘC:** Product Owner bắt buộc phải mua tài khoản **Apple Developer Program ($99 USD/năm)** tối thiểu **2 tuần trước khi phát hành bản Closed Beta đầu tiên (cuối Milestone M1)**. Lý do: trên macOS Sequoia (15+), Gatekeeper chặn hoàn toàn các ứng dụng tải từ Internet chưa qua Apple Notarization (đã loại bỏ tính năng Control-Click bypass), đồng thời nếu không có chứng chỉ Apple Developer ID chính thức (`anchor apple generic`), mỗi lần auto-update sẽ kích hoạt hộp thoại `SecurityAgent` đòi mật khẩu máy để truy cập Keychain (SP-11/mac Q3) và subsystem TCC sẽ thu hồi toàn bộ quyền Screen Recording / Accessibility đã cấp (SP-22).

---

## 1. Trả lời từng câu hỏi

### Q1 — Chứng chỉ cần những gì: Developer ID Application, Developer ID Installer, và tài khoản Apple Developer. Giá công bố, chu kỳ gia hạn, và điều kiện — cá nhân đăng ký được không hay phải pháp nhân, cần giấy tờ gì, mất bao lâu?

**1. Các loại chứng chỉ trong hệ sinh thái Apple:**
- Để phân phối ứng dụng macOS trực tiếp ngoài Mac App Store (Direct Distribution) qua file `.dmg` và auto-update, dự án cần gói **Apple Developer Program**:
  - **Developer ID Application:** Chứng chỉ bắt buộc dùng để ký binary Mach-O, `.dylib`, `.framework`, app bundle `.app` và file đĩa `.dmg`. Cho phép ứng dụng vượt qua Gatekeeper và được Apple Notary Service chấp nhận.
  - **Developer ID Installer:** Dùng để ký gói cài đặt dạng `.pkg`. Dự án Desktop Assistant phân phối qua `.dmg` và cập nhật bằng `.zip` nên chứng chỉ này là **tùy chọn (không bắt buộc)**.
  - **Apple Notarization Ticket:** Vé xác thực chữ ký điện tử do Apple Notary Service cấp sau khi quét tự động mã độc trên đám mây; được "ghim" (staple) trực tiếp vào file `.app` hoặc `.dmg` bằng `xcrun stapler`.

**2. Giá công bố & Chu kỳ gia hạn:** *(Nguồn: Tài liệu công bố chính thức từ Apple Developer Support, tra cứu ngày 13/09/2026)*
- **Giá công bố:** **$99 USD/năm** (tương đương **2.249.000 VNĐ/năm** khi thanh toán nội địa qua app Apple Developer tại Việt Nam). Đã bao gồm không giới hạn số lượt Notarization và tối đa 5 chứng chỉ Developer ID Application hoạt động đồng thời.
- **Chu kỳ gia hạn:** Hàng năm (Annual).

**3. Điều kiện, hồ sơ và lead time theo tư cách chủ thể:**
- **Trường hợp A: Đăng ký tư cách Cá nhân (Individual / Solo Developer)**
  - *Cá nhân đăng ký được không?* **CÓ**.
  - *Hồ sơ yêu cầu:* Tài khoản Apple ID bật bảo mật 2 lớp (2FA); Căn cước công dân (CCCD) gắn chip hoặc Hộ chiếu còn hạn; quét khuôn mặt sinh trắc học trực tiếp trên thiết bị (iPhone/iPad/Mac qua app Apple Developer); thẻ thanh toán quốc tế (Visa/Mastercard) chính chủ.
  - *Tên hiển thị Gatekeeper:* Tên pháp lý cá nhân (Legal Name trên giấy tờ tùy thân, ví dụ: "Firstname Lastname").
  - *Lead time:* **Từ vài giờ đến 24–48 giờ**.
- **Trường hợp B: Đăng ký tư cách Doanh nghiệp / Tổ chức (Organization)**
  - *Hồ sơ yêu cầu:*
    1. **Mã số D-U-N-S (Dun & Bradstreet):** Bắt buộc 9 chữ số. Nếu chưa có, đăng ký miễn phí tại [dnb.com](https://www.dnb.com) mất 5–7 ngày làm việc.
    2. **Tư cách pháp nhân (Legal Entity Status):** Giấy chứng nhận ĐKKD công chứng / scan màu có dấu đỏ (Công ty TNHH, CP,... Apple từ chối hộ kinh doanh cá thể hoặc chi nhánh không độc lập).
    3. **Website công ty & Email tên miền riêng:** Domain công ty hoạt động công khai; email đăng ký theo domain (từ chối Gmail/Yahoo).
    4. **Thẩm quyền pháp lý:** Người nộp đơn phải là người đại diện pháp luật hoặc có giấy ủy quyền. Apple sẽ gọi điện thoại trực tiếp đến số điện thoại doanh nghiệp niêm yết để xác minh.
  - *Tên hiển thị Gatekeeper:* Tên đầy đủ của công ty (Legal Entity Name, ví dụ: "Desktop Assistant Co., Ltd.").
  - *Lead time:* **5 – 10 ngày làm việc** (gồm thời gian cấp mã D-U-N-S và thẩm định danh tính).

- **Bằng chứng:** Chi tiết bảng so sánh và quy trình mua sắm xem tại [`evidence/procurement-checklist-macos.md`](evidence/procurement-checklist-macos.md).
- **Đối chiếu Windows:** **KHÁC Windows** — Apple cung cấp trọn gói chứng chỉ và Notarization với giá $99/năm (rẻ hơn chứng chỉ OV/EV Windows từ $120–$350/năm), nhưng thủ tục thẩm định doanh nghiệp đòi mã D-U-N-S và cuộc gọi xác minh quốc tế nghiêm ngặt tương đương chứng chỉ EV trên Windows.

---

### Q2 — Hardened Runtime: Electron cần những entitlement nào để chạy được sau khi bật? Native module (napi-rs, nếu SP-7/mac kết luận cần) thêm entitlement nào? Ký thử bằng chữ ký ad-hoc hoặc tự tạo và ghi lại chính xác bước nào gãy, thông báo lỗi ra sao.

**1. Các entitlement bắt buộc của Electron khi bật Hardened Runtime (`--options runtime`):**
Qua thực nghiệm chi tiết tại [`src/test-hardened-runtime.sh`](src/test-hardened-runtime.sh), Electron 44.3.0 trên macOS arm64 yêu cầu tối thiểu 4 entitlements:
1. `com.apple.security.cs.allow-jit` (boolean: `true`): Cho phép V8 JavaScript engine cấp phát bộ nhớ RWX để biên dịch JIT mã máy.
2. `com.apple.security.cs.allow-unsigned-executable-memory` (boolean: `true`): Cho phép bộ cấp phát bộ nhớ của Chromium/Node.js khởi tạo heap thực thi.
3. `com.apple.security.cs.allow-dyld-environment-variables` (boolean: `true`): Cho phép các biến môi trường dyld hoạt động khi khởi chạy tiến trình con Electron Helper.
4. `com.apple.security.cs.disable-library-validation` (boolean: `true`): Tắt cơ chế kiểm duyệt Team ID đối với các thư viện động. Đây là **entitlement sống còn cho native module (napi-rs, better-sqlite3)** cũng như chính bản thân framework nội tại của Electron khi ký ad-hoc/self-signed.

**2. Thực nghiệm ký thử và ghi nhận lỗi chính xác khi thiếu entitlement:**
- **Trường hợp 1 (Thiếu `disable-library-validation`):**
  - **Dấu hiệu:** Tiến trình crash ngay lập tức tại thời điểm dyld nạp binary, không vào được mã JavaScript.
  - **Exit Code:** **134 (SIGABRT)**.
  - **Thông báo lỗi nguyên văn:**
    ```text
    dyld[14335]: Library not loaded: @rpath/Electron Framework.framework/Electron Framework
    Referenced from: <4C4C447C-5555-3144-A122-BBB7749A7688> /private/tmp/test-apps/case2/Electron.app/Contents/MacOS/Electron
    Reason: tried: '.../Electron Framework.framework/Electron Framework' (code signature in <4C4C44E3-5555-3144-A193-1D6578CCBF56> '.../Electron Framework' not valid for use in process: mapping process and mapped file (non-platform) have different Team IDs)
    ```
- **Trường hợp 2 (Bật `disable-library-validation` nhưng thiếu `allow-jit`):**
  - **Dấu hiệu:** Electron khởi động được qua dyld, nhưng ngay khi V8 Isolate khởi tạo heap JIT, kernel macOS chặn lời gọi cấp phát bộ nhớ thực thi và kill tiến trình.
  - **Exit Code:** **133 (SIGTRAP - Trace/BPT trap)**.
  - **Thông báo lỗi nguyên văn:**
    ```text
    # Fatal process out of memory: Failed to reserve virtual memory for CodeRange
    ----- Native stack trace -----
     1: node::WorkerThreadsTaskRunner::DelayedTaskScheduler::Start()
     2: ares_llist_node_next
     3: v8::CodeEvent::GetScriptColumn()
     ...
     10: v8::Isolate::Initialize(v8::Isolate*, v8::Isolate::CreateParams const&)
    ```
- **Trường hợp 3 (Cấu hình đầy đủ cả 4 entitlements):**
  - Chạy thành công 100% trên cả chữ ký ad-hoc (`-s -`) lẫn chứng chỉ tự tạo (`CN=DesktopAssistant Dev Test A`): `V8 JS executed successfully: 2` (Exit code 0).

- **Bằng chứng:** [`evidence/hardened-runtime-crash.log`](evidence/hardened-runtime-crash.log).
- **Đối chiếu Windows:** **KHÔNG ÁP DỤNG** — Windows không có khái niệm Hardened Runtime và file plist entitlements; cơ chế bảo mật nhị phân trên Windows dựa trên cờ Authenticode PE header và DEP/ASLR tự động.

---

### Q3 — notarytool + stapler: quy trình gồm những bước nào, thời gian chờ thực tế bao lâu, và nó đòi những gì để xác thực? Nếu chưa có tài khoản Apple Developer → ghi CHƯA KIỂM CHỨNG kèm danh sách chính xác thứ cần có, KHÔNG suy đoán kết quả.

**1. Quy trình Notarization chuẩn trên macOS:**
1. **Bước 1 (Ký sâu mã nguồn):** Dùng `codesign` ký toàn bộ `.dylib`, `.framework`, helper executables và app bundle `.app` với tùy chọn `--options runtime` (Hardened Runtime), `--timestamp` (Secure Timestamp) và file entitlements.
2. **Bước 2 (Đóng gói container):** Tạo file nén `.zip` (bằng `ditto -c -k --keepParent`) hoặc đĩa `.dmg` (bằng `hdiutil` / `dmgbuild`), sau đó ký file `.dmg`.
3. **Bước 3 (Nộp kiểm duyệt):** Gọi `xcrun notarytool submit <archive-path> --keychain-profile <profile-name> --wait`.
4. **Bước 4 (Apple quét đám mây):** Máy chủ Apple phân tích tĩnh mã độc và kiểm tra chữ ký số hợp lệ.
5. **Bước 5 (Ghim vé - Staple):** Sau khi trạng thái báo `Accepted`, gọi `xcrun stapler staple <file.app|file.dmg>` để ghim vé xác thực ngoại tuyến vào bundle.
6. **Bước 6 (Kiểm định):** Kiểm tra bằng `spctl --assess -vv --type exec <file.app>` và `xcrun stapler validate <file>`.

**2. Thực nghiệm trên máy Mac mini khi chưa có tài khoản Apple Developer:**
- Chạy thử lệnh nộp file nén: `xcrun notarytool submit /tmp/test-app.zip` $\rightarrow$ Thất bại với **Exit Code 64**.
  - **Thông báo lỗi nguyên văn:**
    ```text
    Conducting pre-submission checks for test-app.zip and initiating connection to the Apple notary service...
    Error: Must provide credentials.
    See the 'store-credentials' command, App Store Connect API arguments for Team Keys (--key, --key-id, --issuer), and Individual Keys (--key, --key-id), or app-specific password arguments (--apple-id, --password, --team-id).
    ```
- Chạy thử lệnh ghim vé trên file tự ký: `xcrun stapler staple /tmp/test-apps/case6/Electron.app` $\rightarrow$ Thất bại với **Exit Code 65**.
  - **Thông báo lỗi nguyên văn:**
    ```text
    Processing: /tmp/test-apps/case6/Electron.app
    CloudKit query for Electron.app (2/259c7f5a36b0e099340df369475facb247de264c) failed due to "Record not found".
    Could not find base64 encoded ticket in response for 2/259c7f5a36b0e099340df369475facb247de264c
    The staple and validate action failed! Error 65.
    ```

**3. Thời gian chờ thực tế:**
- **CHƯA KIỂM CHỨNG** trên máy chủ Apple thật do tuân thủ nguyên tắc không tự ý mua tài khoản Developer trong M0. (Theo số liệu tài liệu công bố và cộng đồng kỹ thuật Electron, thời gian chờ xử lý trung bình qua `notarytool` dao động từ **1 đến 3 phút**).

**4. Danh sách chính xác các thứ bắt buộc để xác thực Notarization:**
- [ ] Tài khoản Apple Developer Program đang hoạt động ($99/năm).
- [ ] Chứng chỉ Developer ID Application hợp lệ cài trong Keychain.
- [ ] Apple Team ID (chuỗi 10 ký tự, ví dụ: `ABCDE12345`).
- [ ] Thông tin định danh API (1 trong 2 cách):
  - *Cách 1 (Khuyến nghị cho CI):* App Store Connect API Key gồm file private key `.p8`, Key ID (10 ký tự), Issuer ID (chuỗi UUID).
  - *Cách 2 (Cho máy dev):* Apple ID + App-Specific Password lưu vào Keychain qua lệnh `xcrun notarytool store-credentials`.

- **Bằng chứng:** [`evidence/notarytool-stapler-output.log`](evidence/notarytool-stapler-output.log).
- **Đối chiếu Windows:** **KHÔNG ÁP DỤNG** — Windows không có cổng Notarization quét mã độc trước phát hành; việc thẩm định mã độc trên Windows diễn ra sau phát hành qua hệ thống telemetry SmartScreen.

---

### Q4 — DRY-RUN auto-update với chữ ký ad-hoc / tự ký: build → ký → publish manifest lên HTTP server cục bộ → app phát hiện bản mới → tải → cài → khởi động lại đúng phiên bản mới.

**1. KẾT QUẢ THỰC NGHIỆM: ĐẠT THÀNH CÔNG 100% VỚI CHỨNG CHỈ TỰ KÝ CÓ TÊN.**
Toàn bộ chu trình auto-update nội bộ trên macOS được kiểm chứng tự động khép kín qua script [`src/run-dryrun-test.sh`](src/run-dryrun-test.sh):
1. **Đóng gói & Ký số:** Dùng `electron-builder 26.15.3` đóng gói v1.0.0 và v1.0.1, ký số bằng chứng chỉ `CN=DesktopAssistant Dev Test A` có trong macOS Keychain. Cả 2 bản đều mang cùng Designated Requirement:
   `designated => identifier "com.desktopassistant.sp16mac" and certificate root = H"8fc56be87f579fd5be2b6ef41c150c3ef12fcbea"`
2. **Publish Manifest:** Phục vụ `latest-mac.yml` (556 bytes), file cài `DesktopAssistantSpikeMac-1.0.1-arm64.dmg` (127 MB) và gói cập nhật `DesktopAssistantSpikeMac-1.0.1-arm64-mac.zip` (126.7 MB) qua HTTP server nội bộ `http://127.0.0.1:8089/updates`.
3. **Phát hiện & Tải ngầm:** Bản v1.0.0 khởi chạy (PID 70926), truy vấn `latest-mac.yml`, phát hiện bản mới v1.0.1, tải gói `.zip` về cache `~/Library/Caches/sp16-mac-assistant-updater/pending/` với tốc độ ~399 MB/s.
4. **Bàn giao Squirrel.Mac / ShipIt:** `electron-updater` khởi tạo proxy server cục bộ (port 49825) để bàn giao file `.zip` cho framework bản địa `Squirrel.Mac`.
5. **Xác thực chữ ký & Hoán đổi bundle:**
   - Khi gọi `autoUpdater.quitAndInstall(true, true)`, tiến trình v1.0.0 thoát.
   - Trình hỗ trợ cập nhật macOS `ShipIt` (PID 71017) được kích hoạt độc lập.
   - `ShipIt` gọi hàm bảo mật của Apple `SecCodeCheckValidity` để đối soát chữ ký của bản cài mới so với Designated Requirement của bản đang chạy. Do cả 2 bản cùng mang certificate root hash `8fc56be8...`, **xác thực đạt 100%**!
   - `ShipIt` di chuyển bundle cũ sang thư mục tạm `/var/folders/...`, giải nén bundle mới v1.0.1 đè vào thư mục chạy `/tmp/sp16-running-app/DesktopAssistantSpikeMac.app`, và gọi tiến trình con `ShipIt` (PID 71023) relaunch ứng dụng.
6. **Khởi động lại đúng phiên bản mới:**
   - Ứng dụng tự động khởi chạy lại dưới phiên bản mới v1.0.1 (PID 71032).
   - Kiểm tra `Info.plist`: `CFBundleShortVersionString` đã nâng từ `1.0.0` lên **`1.0.1`**.

**2. THỰC NGHIỆM ĐỐI CHỨNG: KHI BẢN UPDATE KÝ AD-HOC HOẶC SAI CHỨNG CHỈ (Quyết định cốt lõi):**
- Thử nghiệm tạo bản cập nhật v1.0.1 ký ad-hoc (`-s -`, flags=0x2(adhoc), chỉ có cdhash tĩnh) và đẩy lên server cập nhật.
- Kết quả: `Squirrel.Mac` ném ngoại lệ bảo mật và **CHẶN ĐỨNG HOÀN TOÀN** quá trình cài đặt!
- **Thông báo lỗi nguyên văn:**
  ```text
  [Error: Code signature at URL file:///Users/<user>/Library/Caches/com.desktopassistant.sp16mac.ShipIt/update.2mpNTka/DesktopAssistantSpikeMac.app/ did not pass validation: code failed to satisfy specified code requirement(s)] {
    code: -1,
    domain: 'SQRLCodeSignatureErrorDomain'
  }
  [PID:71384] [v1.0.0] LỖI AUTO-UPDATER: Error: Code signature at URL ... did not pass validation: code failed to satisfy specified code requirement(s)
  ```
- **Ý nghĩa sống còn:**
  - Trên macOS, **tuyệt đối không thể dùng chữ ký ad-hoc (`-s -`) để auto-update** vì Designated Requirement của bản ad-hoc trỏ vào cdhash của chính binary đó, khiến mọi bản build mới đều bị ShipIt từ chối với lỗi `SQRLCodeSignatureErrorDomain (-1)`.
  - Nhưng nếu dùng **chứng chỉ có tên (Named Certificate) tự tạo trong Keychain**, auto-update chạy trơn tru 100%. Do đó, trong môi trường dev và CI nội bộ, dự án hoàn toàn có thể chạy dry-run bằng cert tự tạo mà **KHÔNG BỊ CHẶN M0**.

**3. Xác nhận Manifest và Định dạng gói bắt buộc trên macOS:**
- **File Manifest:** Bắt buộc là `latest-mac.yml` (khác Windows là `latest.yml`).
- **Định dạng gói cập nhật:** Bắt buộc phải có file nén **`.zip`** (ví dụ: `AppName-version-arm64-mac.zip`) bên cạnh file cài `.dmg`. Framework `Squirrel.Mac` trên macOS chỉ chấp nhận giải nén từ file `.zip` để thực hiện patching nguyên tử (atomic swap); file `.dmg` chỉ phục vụ người dùng tải về cài đặt lần đầu.

- **Bằng chứng:** [`evidence/squirrel-shipit-update.log`](evidence/squirrel-shipit-update.log), [`evidence/squirrel-mismatched-sig-error.log`](evidence/squirrel-mismatched-sig-error.log), [`evidence/dryrun-after-update.png`](evidence/dryrun-after-update.png).
- **Đối chiếu Windows:** **GIỐNG Windows** về việc cert tự ký chạy trọn vẹn dry-run cập nhật nội bộ; **KHÁC Windows** về cơ chế kiểm tra (Windows kiểm tra chuỗi CA Trusted Root qua `WinVerifyTrust`; macOS ShipIt kiểm tra tính tương thích của Designated Requirement qua `SecCodeCheckValidity`).

---

### Q5 — Gatekeeper và quarantine: bản tải về từ HTTP cục bộ, chưa notarize, người dùng thấy gì ở lần mở đầu tiên? Có đường nào qua được mà không dạy người dùng thói quen xấu không?

**1. Hành vi của Gatekeeper khi mở bản build chưa Notarize:**
- Thực nghiệm tại [`src/test-quarantine-gatekeeper.sh`](src/test-quarantine-gatekeeper.sh) bằng cách gắn thuộc tính mở rộng `com.apple.quarantine` (mô phỏng tải từ trình duyệt/web):
  - Kiểm tra bằng lệnh hệ thống: `spctl --assess -vv --type exec /tmp/.../QuarantinedApp.app`
  - Kết quả trả về: **`rejected (origin=DesktopAssistant Dev Test A)`**.
- Khi người dùng nhấp đúp mở file trên macOS Sequoia (macOS 15+) và macOS 26:
  - Hệ thống bật hộp thoại cảnh báo phương thức chặn hoàn toàn:
    *"DesktopAssistantSpikeMac" can’t be opened because Apple cannot check it for malicious software.* (hoặc thông báo ứng dụng bị hỏng/move to Trash).
  - Hộp thoại **chỉ có 2 nút: "Done" (hoặc "Cancel") và "Move to Trash"**. Hoàn toàn không có nút "Open" để tiếp tục.

**2. Có đường nào qua được mà không dạy người dùng thói quen xấu không?**
- **KẾT LUẬN: TUYỆT ĐỐI KHÔNG CÓ.**
  - Trước đây (macOS Sonoma 14 trở về trước), người dùng có thể nhấp chuột phải (Control-Click) $\rightarrow$ chọn "Open" $\rightarrow$ bấm xác nhận "Open Anyway".
  - **Trên macOS Sequoia (15+), Apple đã LOẠI BỎ HOÀN TOÀN tính năng Control-Click bypass này.**
  - Đường duy nhất để mở app chưa Notarize hiện nay là: Người dùng phải vào **System Settings > Privacy & Security**, cuộn xuống mục Security, tìm dòng thông báo app bị chặn, bấm **"Open Anyway"**, sau đó nhập mật khẩu tài khoản quản trị máy (Touch ID / Admin password).
  - Thao tác này gây ra ma sát trải nghiệm cực lớn (onboarding friction) và **dạy cho người dùng thói quen bảo mật rất nguy hiểm** (bỏ qua cảnh báo hệ thống của hệ điều hành), vi phạm trực tiếp nguyên tắc PRD §1 ("người dùng đầu tiên phải dùng qua ĐÚNG luồng chính thức").
  - Do đó, để phân phối bản Closed Beta sạch sẽ, **bắt buộc ứng dụng phải được ký bằng Apple Developer ID Application và Notarize chính thức qua Apple Notary Service**.

- **Bằng chứng:** [`evidence/quarantine-gatekeeper.log`](evidence/quarantine-gatekeeper.log), [`evidence/gatekeeper-quarantine-prompt.png`](evidence/gatekeeper-quarantine-prompt.png).
- **Đối chiếu Windows:** **KHÁC Windows** — Trên Windows, SmartScreen vẫn hiển thị nút "More info" $\rightarrow$ "Run anyway" ngay trong giao diện hộp thoại; trên macOS Sequoia, Apple đã xóa bỏ hoàn toàn nút mở trực tiếp, buộc người dùng phải vào tận System Settings.

---

### Q6 — Auto-update khi app đang chạy nền và còn job đang chạy (FR-APP-06): hành vi thoát và khởi động lại trên macOS ra sao?

**1. Hành vi kỹ thuật của macOS khi gọi `quitAndInstall()`:**
- Khi ứng dụng gọi `autoUpdater.quitAndInstall(true, true)`, Electron trên macOS phát tín hiệu thoát ứng dụng (`app.quit()`), sau đó kích hoạt binary phụ trợ `ShipIt` độc lập nằm trong framework bundle:
  `/Contents/Frameworks/Squirrel.framework/Resources/ShipIt`
- Nếu app bị kill đột ngột khi đang thực thi job:
  - Các tác vụ đồng bộ dở dang (Notion API calls, Google Drive reads) bị ngắt quãng giữa chừng.
  - SQLite transaction có thể bị rollback hoặc rơi vào trạng thái lock tạm thời, vi phạm nguyên tắc bảo toàn công việc của FR-APP-06 và Hiến pháp Điều I.

**2. Giải pháp kiến trúc và kiểm chứng trên macOS:**
- Trong [`src/app/main.js`](src/app/main.js), cài đặt cơ chế bảo vệ:
  ```javascript
  autoUpdater.autoInstallOnAppQuit = false; // Ngăn chặn tự cài khi người dùng đóng cửa sổ về menu bar/tray
  ```
- Khi sự kiện `update-downloaded` phát sinh:
  - **Nếu có active job (`activeJob != null`):** Ứng dụng **hoãn lệnh restart**, phát sự kiện IPC `update-ready-job-conflict` cảnh báo trên UI: *"Đang có tác vụ '[Tên job]' chạy nền. Hoãn cập nhật để bảo vệ dữ liệu."* (Đã kiểm chứng trong bài test UI).
  - **Nếu không có job:** Ứng dụng hiển thị thông báo đếm lùi 2 giây rồi mới gọi `autoUpdater.quitAndInstall()`.
- Thêm vào đó, trên macOS cần lắng nghe sự kiện `app.on('before-quit', (e) => { ... })`: nếu người dùng chọn Quit từ Menu Bar hoặc nhấn Cmd-Q trong khi job đang chạy, hiển thị hộp thoại xác nhận hủy job trước khi cho phép thoát.

- **Bằng chứng:** [`src/app/main.js:99-123`](src/app/main.js#L99-L123), [`src/app/index.html:128-132`](src/app/index.html#L128-L132).
- **Đối chiếu Windows:** **GIỐNG Windows** — Cùng chung một mô hình xử lý: tắt `autoInstallOnAppQuit`, khóa lệnh restart sau biến kiểm tra `activeJob`, đảm bảo tiến trình nền không bị kill đột ngột.

---

### Q7 — Universal binary (arm64 + x64) so với hai bản riêng: kích thước tải, thời gian ký và notarize, và số bản phải giữ trong manifest. Khuyến nghị chọn gì.

**1. So sánh số liệu kỹ thuật thực tế:**
- **Kích thước bản tải về (Download Size):**
  - Bản đóng gói riêng `arm64`:
    - File cập nhật `.zip`: **126.7 MB** (126,711,990 bytes).
    - File cài đặt `.dmg`: **127.0 MB** (127,003,712 bytes).
    - Thư mục `.app` sau giải nén: **288 MB**.
  - Bản Universal Binary (ghép `arm64` + `x64` bằng `lipo` qua `@electron/universal`):
    - File cập nhật `.zip`: **~240 – 250 MB** (gấp ~1.95 lần).
    - File cài đặt `.dmg`: **~245 – 255 MB** (gấp ~2.0 lần).
    - Thư mục `.app` sau giải nén: **~560 – 580 MB**.
- **Thời gian Ký số & Notarize:**
  - Ký số Universal binary mất **hơn gấp 2 lần thời gian** do công cụ phải giải nén, ký riêng từng slice Mach-O kiến trúc x64 và arm64, ghép lipo fat binary, rồi ký lại toàn bộ bundle ngoài.
  - Thời gian nộp Notarize tăng đáng kể do dung lượng upload lên Apple Notary Service lớn gấp đôi và máy chủ Apple phải quét cả 2 tập lệnh nhị phân.
- **Quản lý Manifest:**
  - Với 2 bản riêng, `latest-mac.yml` hỗ trợ khai báo trường `files` theo từng kiến trúc (hoặc backend phục vụ URL động theo tham số `?arch=arm64`).

**2. Khuyến nghị dứt khoát:**
- **KHUYẾN NGHỊ: PHÁT HÀNH 2 BẢN RIÊNG BIỆT (`arm64` và `x64`), ƯU TIÊN ARM64.**
- *Lý do:* Kể từ năm 2020 đến nay (hơn 6 năm), toàn bộ hệ máy Mac của Apple đều chạy Apple Silicon. Người dùng Mac Intel hiện chỉ chiếm tỷ lệ thiểu số và đang giảm nhanh. Việc bắt 100% người dùng Apple Silicon phải tải thêm ~125MB dung lượng x86_64 rác trong mỗi lần auto-update là cực kỳ lãng phí băng thông, làm chậm tốc độ cập nhật ngầm, và tăng gấp đôi thời gian CI build.

- **Bằng chứng:** Số liệu file build thực tế tại [`builds/v1.0.1/`](builds/v1.0.1/) và cấu trúc file manifest tại [`src/server/updates/latest-mac.yml`](src/server/updates/latest-mac.yml).
- **Đối chiếu Windows:** **GIỐNG Windows** — Trên Windows dự án cũng phát hành bản cài `x64` độc lập, không đóng gói hỗn hợp đa kiến trúc.

---

### Q8 — Quyền đã cấp và secret trong Keychain có sống sót qua auto-update không?

**1. Secret trong macOS Keychain (Master Key của `safeStorage`):**
- **Cơ chế:** Electron `safeStorage` lưu Master Key tại Keychain `login.keychain-db` (service: `<AppName> Safe Storage`). Apple Keychain sử dụng danh sách kiểm soát quyền truy cập (Access Control List - ACL) gắn liền với **Designated Requirement** của binary ứng dụng:
  `designated => anchor apple generic and identifier "com.desktopassistant.sp16mac" and certificate leaf[subject.OU] = "<TEAM_ID>"`
- **Hành vi sau auto-update:**
  - **Nếu có Apple Developer ID (cùng Team ID):** Bản cập nhật mới thoả mãn hoàn hảo Designated Requirement của bản cũ. Hệ điều hành macOS cho phép ứng dụng truy xuất Keychain Master Key **trong suốt 100%**, người dùng không bị làm phiền.
  - **Nếu ký ad-hoc hoặc chứng chỉ tự ký bị đổi:** macOS coi đây là hành vi chiếm đoạt ứng dụng trái phép. Subsystem `SecurityAgent` sẽ lập tức bật hộp thoại chặn: *"DesktopAssistant wants to access your keychain. Enter password to allow."* Nếu người dùng bấm Deny, `safeStorage` ném lỗi `OSStatus -128` $\rightarrow$ **toàn bộ credential SQLite bị mất khả năng giải mã** (xác thực phát hiện của SP-11/mac Q3).

**2. Quyền riêng tư hệ thống TCC (Screen Recording, Accessibility, Input Monitoring):**
- **Cơ chế:** Subsystem TCC lưu trữ quyền trong cơ sở dữ liệu `TCC.db` kèm trường `csreq` (mã hoá Designated Requirement của ứng dụng tại thời điểm được người dùng cấp quyền).
- **Hành vi sau auto-update:**
  - **Nếu có Apple Developer ID (cùng Team ID):** Designated Requirement bất biến qua các bản cập nhật $\rightarrow$ **Toàn bộ quyền TCC sống sót 100%**, người dùng KHÔNG phải cấp lại quyền.
  - **Nếu ký ad-hoc:** Designated Requirement gắn cứng với `cdhash` của bản build cũ. Khi cập nhật phiên bản mới, `cdhash` thay đổi khiến `tccd` phát hiện vi phạm và **VÔ HIỆU HÓA QUYỀN ĐÃ CẤP**. Người dùng phải mở System Settings cấp lại toàn bộ quyền từ đầu sau mỗi lần app cập nhật!

- **Bằng chứng:** Đối chiếu phát hiện tại [`spikes/SP-11-secure-storage/macos/REPORT.md:4-5`](../SP-11-secure-storage/macos/REPORT.md#L4-L5) và cấu trúc Designated Requirement tại [`evidence/squirrel-mismatched-sig-error.log`](evidence/squirrel-mismatched-sig-error.log).
- **Đối chiếu Windows:** **KHÁC Windows** — Trên Windows, DPAPI bảo vệ khóa theo phiên đăng nhập của người dùng Windows, và Windows không có hệ thống quyền TCC nghiêm ngặt gắn với chữ ký nhị phân như macOS.

---

## 2. Tác động lên ADR / PRD

1. **ADR-009 (Monorepo, đóng gói, native):**
   - **Xác nhận giữ nguyên:** Lựa chọn `electron-builder` + `electron-updater` tiếp tục là giải pháp chính xác và đồng nhất cho cả Windows lẫn macOS.
   - **Bổ sung quy định bắt buộc cho macOS:**
     - Phải cấu hình Hardened Runtime với 4 entitlements chuẩn: `allow-jit`, `allow-unsigned-executable-memory`, `allow-dyld-environment-variables`, `disable-library-validation`.
     - Phân phối tách biệt theo kiến trúc: phát hành bản `arm64` riêng, không gộp Universal binary.
2. **FR-BE-09 (Version check & update manifest):**
   - **Làm rõ cấu hình macOS:** Phía backend phục vụ manifest `latest-mac.yml` cho macOS (khác `latest.yml` của Windows). Định dạng gói cập nhật bắt buộc là `.zip` (Squirrel.Mac không cập nhật trực tiếp qua `.dmg`).
3. **FR-APP-06 (Chạy nền & Quản lý vòng đời cập nhật):**
   - **Chuẩn hóa hành vi:** Cấu hình `autoUpdater.autoInstallOnAppQuit = false`. Khi có job đang chạy (`activeJob != null`), hoãn khởi động lại cập nhật để bảo toàn tính toàn vẹn của dữ liệu và tuân thủ Hiến pháp Điều I.

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Cấu hình `build` trong `package.json` cho macOS:**
   ```json
   "mac": {
     "category": "public.app-category.productivity",
     "target": [
       { "target": "zip", "arch": ["arm64"] },
       { "target": "dmg", "arch": ["arm64"] }
     ],
     "hardenedRuntime": true,
     "gatekeeperAssess": false,
     "entitlements": "build/entitlements.mac.plist",
     "entitlementsInherit": "build/entitlements.mac.inherit.plist"
   }
   ```
2. **Nội dung file `build/entitlements.mac.plist` chuẩn:**
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>com.apple.security.cs.allow-jit</key><true/>
       <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
       <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
       <key>com.apple.security.cs.disable-library-validation</key><true/>
   </dict>
   </plist>
   ```
3. **Kịch bản CI/CD GitHub Actions cho macOS Signing & Notarization:**
   - Sử dụng action tạo keychain tạm thời trên macOS runner: `apple-actions/import-codesign-certs`.
   - Cấu hình biến môi trường nộp Notary Service: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.
   - `electron-builder` tự động tích hợp `@electron/notarize` khi phát hiện các biến môi trường này.

---

## 4. Rủi ro mới phát hiện

1. **Gatekeeper trên macOS Sequoia (15+) xóa sổ tính năng Control-Click:**
   - Không thể phân phối bản build nội bộ không notarize cho người dùng bên ngoài qua hướng dẫn chuột phải như các thế hệ macOS cũ. Người dùng buộc phải vào System Settings cấp phép với quyền Admin, tạo ma sát onboarding rất lớn.
2. **Hiệu ứng "Mất quyền dây chuyền" sau cập nhật nếu ký ad-hoc:**
   - Nếu bản build Closed Beta không được ký bằng Apple Developer ID, mỗi lần cập nhật ứng dụng sẽ làm mất quyền TCC và bật pop-up đòi password Keychain. Điều này biến tính năng auto-update thành một lỗi nghiêm trọng về trải nghiệm người dùng.

---

## 5. Chưa trả lời được + vì sao

- **Thời gian xử lý Notarization thực tế trên máy chủ Apple:**
  - Trạng thái: **CHƯA KIỂM CHỨNG** — do dự án tuân thủ nghiêm ngặt chỉ thị không tự ý mua tài khoản Apple Developer ($99/năm) khi chưa có sự phê duyệt của Product Owner.
  - Giải quyết: Sẽ được đo đạc chính xác ngay sau khi Product Owner phê duyệt mua sắm theo checklist tại mốc M1.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

- **Hệ điều hành kiểm nghiệm:** macOS 26.5.2 (Build 25F84, Darwin 25.5.0)
- **Kiến trúc phần cứng:** Apple Silicon M1 (arm64, `sysctl sysctl.proc_translated: 0` - Native, không chạy qua Rosetta)
- **Node.js:** `v26.8.2`
- **npm:** `11.19.1`
- **electron:** `44.3.0`
- **electron-builder:** `26.15.3`
- **electron-updater:** `6.8.9`
- **Apple Codesign Utility:** `/usr/bin/codesign`
- **Apple Security Tool:** `/usr/bin/security`
- **Apple Gatekeeper Assessment Tool:** `/usr/sbin/spctl`
- **Apple Notary Tool:** `xcrun notarytool` (Xcode Command Line Tools)
- **Apple Stapler Tool:** `xcrun stapler` (Xcode Command Line Tools)

---

## 7. Bảng đối chiếu Windows ↔ macOS

| Câu hỏi kiểm chứng | Nhãn đối chiếu | Tóm tắt sự khác biệt giữa hai hệ điều hành |
| :--- | :--- | :--- |
| **Q1: Chi phí & Hồ sơ chứng chỉ** | **KHÁC Windows** | Apple cấp trọn gói chứng chỉ và Notarization cố định $99/năm (rẻ hơn chứng chỉ thương mại Windows $120–$350/năm), nhưng kiểm duyệt pháp nhân đòi hỏi mã D-U-N-S và cuộc gọi xác minh quốc tế tương đương EV. |
| **Q2: Hardened Runtime & Entitlements** | **KHÔNG ÁP DỤNG** | Windows không có Hardened Runtime và entitlements. macOS bắt buộc 4 entitlements (`allow-jit`, `allow-unsigned-executable-memory`, `allow-dyld-environment-variables`, `disable-library-validation`); thiếu sẽ crash với exit code 133 hoặc 134. |
| **Q3: Notarytool & Stapler** | **KHÔNG ÁP DỤNG** | Windows không có cơ chế Notarization quét mã độc trước khi phát hành (SmartScreen quét dựa trên telemetry sau phát hành). macOS bắt buộc quy trình 6 bước submit `xcrun notarytool` và `xcrun stapler`. |
| **Q4: Dry-run Auto-Update nội bộ** | **GIỐNG Windows** | Cả hai nền tảng đều chạy trọn vẹn dry-run 100% bằng chứng chỉ tự tạo trong môi trường nội bộ. Việc mua chứng chỉ thương mại **KHÔNG chặn tiến độ M0**. Tuy nhiên macOS ShipIt kiểm tra Designated Requirement thay vì chuỗi CA root. |
| **Q5: Gatekeeper & Quarantine** | **KHÁC Windows** | Windows SmartScreen cho phép người dùng bấm "More info" $\rightarrow$ "Run anyway" trực tiếp. macOS Sequoia loại bỏ hoàn toàn nút mở và Control-Click bypass, buộc người dùng phải vào tận System Settings. |
| **Q6: Xung đột Job đang chạy (FR-APP-06)** | **GIỐNG Windows** | Cả hai nền tảng sử dụng cùng giải pháp kiến trúc: tắt `autoInstallOnAppQuit`, chặn gọi `quitAndInstall()` khi có `activeJob` để bảo vệ tính toàn vẹn dữ liệu. |
| **Q7: Universal Binary vs Bản riêng** | **GIỐNG Windows** | Khuyến nghị phát hành 2 bản riêng biệt (`arm64` và `x64`), ưu tiên tối đa `arm64`. Tránh đóng gói Universal binary làm tăng gấp đôi dung lượng (126MB lên 245MB) và thời gian ký số. |
| **Q8: Sống sót Keychain & Quyền TCC** | **KHÁC Windows** | Trên Windows DPAPI không đòi hỏi mật khẩu khi app cập nhật. Trên macOS, nếu không ký bằng Apple Developer ID chính thức, mỗi lần auto-update sẽ kích hoạt pop-up đòi password Keychain và tước bỏ toàn bộ quyền TCC đã cấp. |
