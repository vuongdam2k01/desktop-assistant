# Đặc tả Luồng Onboarding trên macOS (Bản nháp M0) — Desktop Assistant

> **Báo cáo trích dẫn:** SPIKE `SP-22` (M0)  
> **Nguồn đặc tả gốc:** `docs/raw-idea/prd-mvp.md` (WF-1 Onboarding, §10.7 FR-APP-04, NFR-SEC-02, ADR-009)  
> **Mục đích:** Tài liệu này đóng vai trò nội dung gốc (baseline) cho phần onboarding macOS của đặc tả ứng dụng (`docs/spec/capabilities/app/spec.md`).

---

## 1. Triết lý Onboarding trên macOS: "Zero-Friction MVP"

Trái ngược với thông lệ của nhiều ứng dụng AI trên macOS (vừa cài đặt đã dồn dập hỏi 3–4 quyền hệ thống nhạy cảm khiến người dùng hoang mang và từ chối cấp quyền), Desktop Assistant áp dụng triết lý:

> **NGUYÊN TẮC: ONBOARDING MVP HOÀN TOÀN KHÔNG XIN QUYỀN HỆ THỐNG (ZERO-TCC ONBOARDING).**  
> Mọi quyền hệ thống (Screen Recording, Accessibility, Automation) đều được phân bổ theo mô hình **Just-In-Time (Đúng lúc cần)** ở các mốc phát hành sau (M3 và Phase 3). Khi mới cài đặt, người dùng trải nghiệm trọn vẹn giá trị cốt lõi của sản phẩm mà không gặp bất kỳ rào cản kỹ thuật hay hộp thoại cảnh báo nào.

---

## 2. Luồng Onboarding chi tiết (WF-1 macOS Edition)

```
[BƯỚC 1: Cài đặt DMG]
       │
       ▼
[BƯỚC 2: Màn hình Chào & Đăng nhập Google]  <─── Trình duyệt mặc định qua loopback 127.0.0.1
       │
       ▼
[BƯỚC 3: Kết nối Nền tảng (Notion / Gmail / Drive)]  <─── OAuth Broker / BYO
       │
       ▼
[BƯỚC 4: Chọn Mode Phê duyệt (Mặc định: ON)]  <─── An toàn tuyệt đối lần đầu
       │
       ▼
[BƯỚC 5: Pet Xuất hiện trên Desktop & Giao việc mẫu]  <─── ZERO HỘP THOẠI TCC!
```

### Bước 1 — Cài đặt & Khởi động lần đầu
- **Thao tác người dùng:** Tải file `.dmg` đã được ký bằng Apple Developer ID và Notarize bởi Apple (`notarytool`), mở DMG và kéo icon `Desktop Assistant.app` vào thư mục `/Applications`.
- **Hành vi macOS:** 
  - Do ứng dụng đã được Notarize, macOS Gatekeeper kiểm tra chữ ký và vé stapled hợp lệ.
  - Khi mở lần đầu, macOS hiển thị hộp thoại xác nhận tiêu chuẩn một lần:  
    `"Desktop Assistant" is an app downloaded from the Internet. Are you sure you want to open it? [Open] [Cancel]`.
  - Không có cảnh báo phần mềm độc hại hay cảnh báo SmartScreen lạ.
- **Tài nguyên khởi tạo:** Ứng dụng tự tạo thư mục làm việc an toàn tại `~/Library/Application Support/DesktopAssistant/` (lưu `ledger.sqlite`, cache cấu hình). Không yêu cầu quyền Files & Folders.

### Bước 2 — Màn hình Chào & Đăng nhập Google (Google Sign-In)
- **Giao diện:** Cửa sổ App Window (`800x560`, nền tối theo chủ đề, tiêu chuẩn macOS Window).
- **Hành vi:**
  - Người dùng bấm nút **"Đăng nhập bằng Google"**.
  - Ứng dụng mở trình duyệt mặc định (Safari/Chrome) qua URL OAuth của Backend Service.
  - Listener loopback tại `http://127.0.0.1:<port>` tiếp nhận mã ủy quyền và sinh JWT phiên (FR-BE-01).
  - Không có bất kỳ hộp thoại bảo mật nào xuất hiện trên màn hình desktop.

### Bước 3 — Kết nối Nền tảng (Connectors)
- **Giao diện:** Danh mục connector khả dụng.
  - **Notion (Bắt buộc cho MVP):** Nút "Kết nối Notion" $\rightarrow$ mở OAuth grant Notion $\rightarrow$ người dùng chọn Workspace và database task.
  - **Gmail / Google Drive:** Hiển thị dưới dạng tùy chọn (Optional) kết nối ngay hoặc kết nối sau qua BYO OAuth Client (FR-CF-11).
- **Lưu trữ bảo mật:** Token OAuth được mã hoá bằng Master Key qua Electron `safeStorage` và lưu trữ ciphertext trong SQLite. Nhờ chữ ký Developer ID hợp lệ, macOS Keychain cấp quyền truy cập âm thầm 100% (không hỏi mật khẩu login keychain).

### Bước 4 — Chọn Chế độ Phê duyệt Ban đầu (Approval Mode)
- **Giao diện:** Người dùng chọn 1 trong 3 mode:
  - **BẬT (Mode ON — Khuyến nghị an toàn cho người dùng mới):** Mọi thao tác ghi/sửa/xoá trên Notion đều phải được người dùng xác nhận qua ô thoại trước khi thực hiện.
  - **THÔNG MINH (Mode Smart):** Tự động phê duyệt các thao tác an toàn theo quy tắc; chỉ hỏi khi chạm thao tác có rủi ro cao.
  - **TẮT (Mode Off):** Tin tưởng hoàn toàn, thực thi tự động và ghi ledger.
- **Công bố chính sách dữ liệu (NFR-SEC-02):**
  - Hiển thị hộp thông tin minh bạch: *"Desktop Assistant chỉ gửi dữ liệu cần thiết cho tác vụ (câu lệnh của bạn, dữ liệu Notion liên quan) tới LLM Provider do bạn chọn. Hệ thống không theo dõi màn hình, không đọc phím gõ của bạn."*

### Bước 5 — Pet Xuất hiện & Trải nghiệm Đầu tiên thành công (Aha Moment)
- **Hành vi hệ thống:**
  - App Window đóng lại hoặc thu về khay Menu bar (Tray icon).
  - Cửa sổ Pet (`140x140`, trong suốt, không khung, nổi ở góc phải màn hình) xuất hiện mượt mà cùng hiệu ứng animation của Rive.
  - Thẻ hội thoại (Speech bubble) tự động mở sang bên cạnh với câu thoại thân thiện theo tính cách:
    > *"Chào bạn! Tôi là Desktop Assistant. Bạn thử giao cho tôi một việc xem sao nhé, ví dụ: 'Thêm task Họp giao ban vào Notion lúc 9h sáng mai'."*
  - Người dùng gõ lệnh hoặc bấm nút "Dùng thử lệnh mẫu" $\rightarrow$ Pet đổi trạng thái "Đang làm việc" $\rightarrow$ Worker-agent ghi ledger $\rightarrow$ gọi Notion API $\rightarrow$ Pet báo kết quả nén: *"Đã tạo task 'Họp giao ban' trên Notion. Bấm xem chi tiết."*
- **Tổng kết luồng MVP:** **100% hoàn tất mà không có bất kỳ hộp thoại TCC nào của macOS can thiệp.**

---

## 3. Quy trình Xin Quyền Đúng Lúc (Just-In-Time Elevation cho M3 và Phase 3)

Khi phát triển lên Milestone M3 (nhận diện màn hình) và Phase 3 (tự động hoá app), các quyền TCC sẽ được kích hoạt theo kịch bản chuẩn sau:

```
[Tính năng nhạy cảm được kích hoạt]
       │
       ▼
[BƯỚC A: Thẻ hội thoại Pet giải thích lý do (Pre-prompt Rationale)]
       │
       ├──► Người dùng bấm "Để sau" ──► Tính năng tắt, pet hoạt động bình thường
       ▼ (Người dùng bấm "Đồng ý")
[BƯỚC B: Kích hoạt Hộp thoại Hệ thống của macOS]
       │
       ├──► Người dùng bấm "Allow" ──► Cấp quyền thành công (Restart nếu cần)
       ▼ (Người dùng bấm "Don't Allow")
[BƯỚC C: Rơi về Chế độ Dự phòng (Graceful Degradation)]
       │
       ▼
[BƯỚC D: Hướng dẫn mở System Settings gạt tay khi muốn bật lại]
```

### 3.1. Kịch bản Quyền Screen Recording (Milestone M3)

- **Ngữ cảnh kích hoạt:** Người dùng bật tính năng *"Cho phép Pet nhận biết ngữ cảnh ứng dụng đang làm việc"* trong Cài đặt, hoặc khi Pet gợi ý hỗ trợ thông minh dựa trên cửa sổ đang mở.
- **Bước A (Pre-prompt Rationale):** Pet hiển thị ô thoại nêu rõ:
  > *"Để nhận biết ứng dụng bạn đang mở và hỗ trợ kéo thả dữ liệu tự động, tôi cần quyền xem màn hình. macOS sẽ hiển thị một hộp thoại hỏi quyền. Tôi cam kết tuân thủ chính sách Zero-Persistent Title: tuyệt đối không lưu tiêu đề tài liệu hay gửi ảnh chụp màn hình riêng tư lên đám mây."*
  > `[Cấp quyền cho Pet]` `[Để sau]`
- **Bước B (Kích hoạt API hệ thống):**
  - Khi người dùng bấm *"Cấp quyền cho Pet"*, app gọi hàm `CGRequestScreenCaptureAccess()`.
  - macOS hiển thị hộp thoại modal hệ thống:
  
  ![Screen Recording Prompt](permission-prompts/screen-recording-prompt.png)
  
- **Xử lý kết quả:**
  - **Nếu Cho phép (Allow):** macOS yêu cầu đóng ứng dụng để WindowServer cập nhật phiên ghi màn hình. App lưu trạng thái phiên làm việc hiện tại, hiển thị thông báo: *"Khởi động lại Pet để hoàn tất"* và gọi `app.relaunch()` + `app.quit()`.
  - **Nếu Từ chối (Don't Allow):** App không crash. Pet chuyển sang chế độ dự phòng: chỉ hiển thị hình học cơ bản, không đọc tiêu đề cửa sổ khác.

### 3.2. Kịch bản Quyền Trợ năng (Accessibility) (Milestone M3)

- **Ngữ cảnh kích hoạt:** Người dùng bật tính năng *"Pet tự động né tránh vùng con trỏ đang gõ phím"* (Caret Evasion) hoặc tính năng *"Pet bám theo mép cửa sổ khác"*.
- **Bước A:** Pet giải thích lý do:
  > *"Để pet biết vị trí bạn đang gõ phím và tự động bước sang chỗ khác tránh che khuất, macOS cần bạn bật quyền Trợ năng (Accessibility)."*
- **Bước B:** Gọi `AXIsProcessTrustedWithOptions({ kAXTrustedCheckOptionPrompt: true })`.
  - macOS mở trực tiếp mục **Privacy & Security > Accessibility** trong System Settings.
  
  ![Accessibility Granted](permission-prompts/accessibility-granted.png)
  
- **Xử lý kết quả:**
  - Khi người dùng gạt công tắc ON, quyền Trợ năng **CÓ HIỆU LỰC NGAY TỨC THÌ (0ms)**, **KHÔNG CẦN KHỞI ĐỘNG LẠI ỨNG DỤNG**. App bắt được sự kiện và bật ngay chuyển động né tránh.

---

## 4. Bảng tổng hợp Hộp thoại Quyền và Trải nghiệm tương ứng

| Loại hộp thoại | Cơ quan quản lý | Thời điểm xuất hiện | Giao diện thực tế | Cách ứng dụng hướng dẫn |
| :--- | :--- | :--- | :--- | :--- |
| **Mở app tải từ Internet** | macOS Gatekeeper | Duy nhất lần đầu mở app sau khi cài từ DMG | Modal hệ thống hỏi: "App downloaded from internet. Are you sure you want to open?" | Nêu trong file README tải về: Bấm **"Open"** để tiếp tục. |
| **Mật khẩu Keychain (CHỈ CÓ KHI DÙNG BẢN AD-HOC / DEV TEST)** | Apple SecurityAgent | Lần đầu truy cập safeStorage trên bản build chưa ký chính thức | ![Keychain Ad-hoc Prompt](permission-prompts/keychain-adhoc-prompt.png) | **GIẢI PHÁP SẢN PHẨM:** Đã kiểm chứng ở SP-11/mac và SP-16/mac: Ký bằng chứng chỉ Apple Developer ID chính thức sẽ **TRIỆT TIÊU HOÀN TOÀN** hộp thoại này. Người dùng Closed Beta không bao giờ nhìn thấy hộp thoại này. |
| **Quay & Ghi âm Màn hình** | macOS TCC (`ScreenCapture`) | Khi bật tính năng Pet nhận biết màn hình (M3) | ![Screen Recording Prompt](permission-prompts/screen-recording-prompt.png) | Pet giải thích trước bằng ô thoại; sau khi bấm Allow, app hỗ trợ tự khởi động lại (Quit & Reopen). |
| **Quyền Trợ năng (Accessibility)** | macOS TCC (`Accessibility`) | Khi bật tính năng Caret Evasion / Bám cửa sổ (M3) | ![Accessibility Prompt](permission-prompts/accessibility-granted.png) | App mở thẳng trang Cài đặt bằng URL `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`, nhận quyền tức thì khi gạt ON. |
