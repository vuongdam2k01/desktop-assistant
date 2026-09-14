# TÀI LIỆU YÊU CẦU SẢN PHẨM (PRD) — MVP DESKTOP ASSISTANT

| Thuộc tính | Giá trị |
| --- | --- |
|  Phiên bản  |  2.1 — APPROVED  |
|  Trạng thái  |  ĐÃ ĐÓNG BĂNG ngày 09/09/2026 — mọi thay đổi sau thời điểm này phải ghi vào Nhật ký thay đổi và được product owner phê duyệt; không sửa tự do  |
| Tài liệu nguồn | IDEA BRIEF — Desktop Assistant |
| Người đọc mục tiêu | Product owner, đội phát triển, đội thiết kế |
| Quy ước | Nội dung do người viết đề xuất, chưa được product owner xác nhận, gắn nhãn `[Đề xuất]` |

---

## MỤC LỤC

1. Tổng quan
2. Bối cảnh &amp; phát biểu vấn đề
3. Mục tiêu MVP &amp; giả thuyết cần kiểm chứng
4. Người dùng mục tiêu &amp; persona
5. Chỉ số thành công (success metrics)
6. Các quyết định kiến trúc đã khóa
7. Phạm vi MVP &amp; phân mức ưu tiên (MoSCoW)
8. Luồng người dùng cốt lõi (core workflows)
9. Epic &amp; user stories kèm acceptance criteria
10. Yêu cầu chức năng chi tiết (FR)
11. Yêu cầu phi chức năng (NFR)
12. Mô hình dữ liệu
13. Đặc tả tích hợp Notion
14. Kiến trúc hệ thống &amp; technology stack
15. Phụ thuộc giữa các tính năng &amp; lộ trình milestones
16. Rủi ro &amp; phương án giảm thiểu
17. Tiêu chí phát hành (release criteria)
18. Ngoài phạm vi &amp; lộ trình sau MVP
19. Câu hỏi mở
20. Nhật ký thay đổi
Phụ lục A. Đặc tả tương tác pet &amp; ô thoại (interaction spec)

---

## 1. TỔNG QUAN

**Sản phẩm:** Desktop Assistant — ứng dụng desktop trợ lý công việc chạy bằng
hệ agent AI, với điểm nhấn cốt lõi là một nhân vật/pet hoạt hình thường trực
trên màn hình làm điểm chạm tương tác chính.

**MVP này là gì:** lát cắt đầu tiên của sản phẩm, gồm pet có tính cách +
phương diện "tương tác bất chợt" + **ba connector: Notion, Gmail,
Google Drive** — xây trên một **connector framework chuẩn hoá** (manifest-driven,
mục 10.10) để về sau mở rộng lên hàng chục/hàng trăm nền tảng mà không sửa
lõi — + trọn bộ hạ tầng niềm tin (action ledger, undo bằng hành động bù trừ,
phê duyệt 3 mode). Trải nghiệm kết nối chuẩn cho MỌI connector: người dùng
chọn app trong danh mục → ủy quyền OAuth trên trình duyệt → xong; không có
bước kỹ thuật nào (dán token, nhập ID, cấu hình).

**MVP gồm HAI thành phần triển khai ngang hàng:**

1. **Desktop client** — chứa toàn bộ logic sản phẩm (pet, agents, hooks,
ledger, undo), dữ liệu nghiệp vụ local-first.
2. **Backend service** — dịch vụ server-side gồm xác thực Google Sign-In
(phát phiên JWT của app, allowlist closed beta), OAuth broker cho các
connector, version/update manifest — có database và API riêng, xây dựng,
kiểm thử, vận hành với tiêu chuẩn đầy đủ của một dịch vụ production. Đặc
tả tại mục 10.8, 11.5, 12.2, 14.3. Theo ADR-007/008: KHÔNG có LLM gateway
(LLM đi thẳng client → provider qua lớp providers của pi agents) và
telemetry sản phẩm được hoãn. Ranh giới thiết kế: backend không thực thi
logic nghiệp vụ của job và không thấy nội dung công việc của người dùng.

**Nguyên tắc triển khai giai đoạn đầu (một người dùng):** việc giai đoạn đầu
chỉ có product owner sử dụng KHÔNG thu hẹp phạm vi xây dựng. Sản phẩm được
dựng đúng mô hình chuẩn đã đặc tả — backend, đăng nhập Google Sign-In, OAuth
broker, đóng gói + code signing + auto-update — và người dùng đầu tiên sử
dụng qua ĐÚNG các luồng chính thức (Sign-In, Connect trong danh mục
connector, nhận bản cập nhật qua auto-update), không dùng lối tắt dev, để
mọi luồng đều được kiểm chứng bằng sử dụng thật trước khi có người dùng
tiếp theo. Kênh BYO OAuth client cho Google (mục 13.6) là một luồng chính
thức có hướng dẫn trong app (FR-CF-11), không phải ngoại lệ dev.

**MVP này KHÔNG phải là gì:** không có scheduler ngôn ngữ tự nhiên (phương
diện 2), không có record/tổng hợp họp (phương diện 3), không có connector
nào ngoài ba connector nêu trên, không có thao tác GHI trên
Gmail/Drive (chiến lược scope mục 13.5), không có pet 3D hay tuỳ
biến nhân vật.

**Vì sao cắt như vậy `[Đề xuất]`:** phương diện 1 là lát cắt duy nhất vừa thể
hiện trọn "phép màu" của ý tưởng (bất đối xứng giữa chi phí giao việc và khối
lượng việc được làm) vừa bắt buộc phải xây đủ bộ hạ tầng niềm tin — chính là
những giả định rủi ro nhất cần kiểm chứng sớm nhất. Ba connector đủ tạo giá
trị chéo nền tảng thật (ví dụ: "đọc email này và file trong Drive, rồi tạo
task Notion tương ứng") và đủ đa dạng để chứng minh connector framework
chuẩn hoá được: Notion đại diện nhóm đọc + ghi đầy đủ (nơi thử nghiệm undo
bù trừ), Gmail đại diện nhóm restricted scope cần CASA khi mở đại trà, Drive
đại diện nhóm phải chọn chiến lược scope. **Chiến lược ghi tối giản
`[Đề xuất]`:** thao tác GHI ở MVP chỉ có trên Notion; Gmail và
Drive chỉ đọc — khớp đúng các kịch bản gốc (report email = đọc; tạo task =
ghi Notion), giảm mạnh bề mặt rủi ro, phạm vi undo và cấp độ scope phải xin.

---

## 2. BỐI CẢNH &amp; PHÁT BIỂU VẤN ĐỀ

### 2.1. Vấn đề

Người làm việc tri thức trên desktop chịu hai loại tổn thất lặp đi lặp lại:

1. **Tổn thất do thói quen kiểm tra:** tự mở email/công cụ theo chu kỳ (ví dụ
mỗi 2 giờ) để xem có gì mới — việc máy làm được nhưng người vẫn tự làm, và
mỗi lần làm là một lần rời khỏi công việc chính.
2. **Tổn thất do chuyển ngữ cảnh:** khi đang tập trung mà phát sinh việc phụ
(tạo task từ một tin nhắn, sắp xếp lại kế hoạch), chuỗi thao tác thủ công
trên ứng dụng khác (mở app → tìm đúng chỗ → tạo → điều chỉnh hàng loạt
thông tin) phá vỡ sự liền mạch của công việc đang làm.

Các trợ lý AI dạng chat hiện tại giải quyết được phần "hiểu lệnh" nhưng vẫn
yêu cầu người dùng mở một cửa sổ chat, tức là vẫn tạo ra một lần chuyển ngữ
cảnh. Các công cụ tự động hoá (rule-based) thì thiếu khả năng hiểu yêu cầu tuỳ
hứng bằng ngôn ngữ tự nhiên và ảnh chụp.

### 2.2. Giải pháp của MVP

Một pet hoạt hình thường trực trên desktop, là một agent có tính cách, nhận
lệnh trong vài giây (văn bản + ảnh), tạo job cho worker-agent thực thi thật
trên các nền tảng đã kết nối (Notion, Gmail, Drive) ở hậu trường, và báo
lại bằng thông báo nén — kèm nhật ký hành
động chi tiết, khả năng undo, và lớp phê duyệt chặn cứng để người dùng dám
trao quyền ghi.

---

## 3. MỤC TIÊU MVP &amp; GIẢ THUYẾT CẦN KIỂM CHỨNG

### 3.1. Giả thuyết trung tâm (testable hypothesis)

&gt; Người làm việc tri thức có kết nối Notion, khi được cung cấp một pet-agent
thường trực trên desktop, sẽ **giao ít nhất 3 việc thật/tuần** cho agent
thay vì tự thao tác, và **giữ quyền ghi được bật** (không hạ xuống chế độ
chỉ đọc/hỏi mọi thứ) sau 2 tuần sử dụng — nhờ bộ ba ledger, undo, phê duyệt.
`[Đề xuất: ngưỡng 3 việc/tuần và 2 tuần cần product owner hiệu chỉnh]`
&gt; 

### 3.2. Ba câu hỏi MVP phải trả lời

| # | Câu hỏi | Cách đo |
| --- | --- | --- |
| Q1 | Người dùng có thực sự giao việc cho pet thay vì tự làm tay? | Số job/người/tuần; tỉ lệ người dùng có ≥1 job sau ngày đầu |
| Q2 | Bộ ba ledger–undo–approval có đủ tạo niềm tin để trao quyền ghi? | Tỉ lệ giữ mode có quyền ghi; tỉ lệ job bị undo; tỉ lệ mở ledger sau job |
| Q3 | Pet có tính cách là điểm cộng hay điểm phiền trong ngày làm việc thật? | Tỉ lệ tắt/ẩn pet; khảo sát định tính; thời lượng pet hiển thị/ngày |

### 3.3. Mục tiêu KHÔNG thuộc MVP

- Không nhằm chứng minh khả năng mở rộng đa connector.
- Không nhằm tối ưu chi phí LLM.
- Không nhằm kiểm chứng phương diện 2 và 3.

---

## 4. NGƯỜI DÙNG MỤC TIÊU &amp; PERSONA

### 4.1. Điều kiện tiên quyết của người dùng MVP

- Làm việc chủ yếu trên một máy desktop (Windows hoặc macOS).
- Đang dùng Notion làm nơi quản lý task cá nhân hoặc nhóm.
- Chấp nhận cài ứng dụng chạy nền và cấp quyền OAuth cho workspace Notion.

### 4.2. Persona chính — "Người làm nhiều dự án song song" `[Đề xuất]`

| Thuộc tính | Mô tả |
| --- | --- |
| Chân dung | Nhân sự tri thức (dev, PM, designer, ops) 24–40 tuổi, làm 2+ dự án song song |
| Hành vi | Nhận việc rải rác qua chat/email; quản lý task trên Notion; có các phiên tập trung sâu 1–3 giờ |
| Nỗi đau | Mỗi việc chen ngang tốn 5–15 phút thao tác + chi phí quay lại trạng thái tập trung |
| Kỳ vọng | "Ghi nhận hộ tôi, sắp xếp hộ tôi, đừng bắt tôi rời việc đang làm" |
| Mức tin cậy ban đầu | Thấp với thao tác ghi tự động → cần thấy được agent đã làm gì và hoàn tác được |

### 4.3. Persona phụ — "Người thử nghiệm công cụ AI" `[Đề xuất]`

Early adopter chủ động tìm công cụ agent mới; bao dung với lỗi nhưng đòi hỏi
kiểm soát (approval rules, log chi tiết). Là nguồn phản hồi chất lượng cao
trong giai đoạn closed beta.

---

## 5. CHỈ SỐ THÀNH CÔNG (SUCCESS METRICS) `[Đề xuất: toàn bộ ngưỡng cần hiệu chỉnh]`

&gt; Cách đo trong giai đoạn này (ADR-008 — telemetry hoãn): khảo sát + phỏng
vấn định kỳ người dùng beta, kết hợp log cục bộ mà người dùng tự nguyện
chia sẻ. Chấp nhận số liệu kém chính xác hơn ở beta; telemetry tự động là
hạng mục Phase sau.
&gt; 
&gt; 
&gt; Giai đoạn chỉ có một người dùng: các chỉ số dạng tỉ lệ % trên quần thể
&gt; chưa đo được — thay bằng **giao thức tự kiểm chứng có cấu trúc**: nhật ký
&gt; hằng tuần gồm số job đã giao, tỉ lệ job phải sửa tay trên nền tảng, số lần
&gt; undo và kết quả undo, số yêu cầu phê duyệt vô ích (làm phiền không cần
&gt; thiết), cùng nhận xét định tính cho 3 câu hỏi MVP (mục 3.2). Các ngưỡng %
&gt; của bảng dưới có hiệu lực khi mở rộng số người dùng (xem R-15).
&gt; 

### 5.1. Chỉ số kích hoạt (activation)

| Mã | Chỉ số | Ngưỡng mục tiêu |
| --- | --- | --- |
| M-A1 | Hoàn tất onboarding (cài app + kết nối Notion + pet hiển thị) | ≥ 70% người cài |
| M-A2 | Giao job đầu tiên trong 24h đầu | ≥ 50% người hoàn tất onboarding |
| M-A3 | Thời gian từ mở ô thoại → gửi lệnh đầu tiên | Trung vị ≤ 60 giây |

### 5.2. Chỉ số giá trị cốt lõi (core value)

| Mã | Chỉ số | Ngưỡng mục tiêu |
| --- | --- | --- |
| M-V1 | Số job/người dùng hoạt động/tuần | ≥ 3 |
| M-V2 | Tỉ lệ job hoàn thành không cần người dùng sửa tay trên Notion | ≥ 80% |
| M-V3 | Thời gian thao tác của người dùng cho một lần giao việc | Trung vị ≤ 10 giây |
| M-V4 | Tỉ lệ job thất bại do agent hiểu sai yêu cầu | ≤ 10% |

### 5.3. Chỉ số niềm tin (trust)

| Mã | Chỉ số | Ngưỡng mục tiêu |
| --- | --- | --- |
| M-T1 | Tỉ lệ người dùng giữ mode có quyền ghi sau 2 tuần | ≥ 60% |
| M-T2 | Tỉ lệ job bị undo toàn phần | ≤ 15% (cao hơn = agent làm sai nhiều) |
| M-T3 | Tỉ lệ yêu cầu phê duyệt được xử lý trong 5 phút | ≥ 70% (đo mức độ approval làm phiền) |

### 5.4. Chỉ số trải nghiệm pet

| Mã | Chỉ số | Ngưỡng mục tiêu |
| --- | --- | --- |
| M-P1 | Tỉ lệ người dùng tắt hẳn pet (chỉ dùng cửa sổ app) | ≤ 20% |
| M-P2 | Đánh giá định tính "pet là điểm cộng" trong khảo sát cuối beta | ≥ 60% đồng ý |

---

## 6. CÁC QUYẾT ĐỊNH KIẾN TRÚC ĐÃ KHÓA

Bốn quyết định do product owner chốt; mọi yêu cầu trong tài liệu tuân theo.

**QĐ-1 — Pet là một agent có tính cách, mô hình phi tập trung.**
Pet KHÔNG phải orchestrator trung tâm. Nó là MỘT agent ngang hàng, sở hữu
tool call để **tạo job cho các agent khác xử lý**. Sau khi tạo job,
worker-agent hoạt động độc lập; pet nhận kết quả để giao tiếp với người dùng.
Pet "giao việc", không "chỉ huy".

**QĐ-2 — Ledger chi tiết + undo bù trừ + phê duyệt 3 mode.**

- Ghi nhận mọi thao tác ở mức chi tiết nhất có thể, gồm trạng thái trước/sau
khi lấy được. KHÔNG áp tư duy coding agent (git diff/revert): thao tác
không hoàn tác được (gọi API một chiều, xóa file ngoài git...) phải được
đánh dấu **irreversible** ngay trong ledger.
- Undo = **hành động bù trừ (compensating actions)**: chạy lại chuỗi thao
tác đã ghi ở chiều ngược. Kết quả phụ thuộc trạng thái hiện tại tại thời
điểm undo; hệ thống phải đối chiếu và báo rõ phần không thể đưa về như cũ.
- Phê duyệt 3 mode **off / smart / on** — hệ phê duyệt riêng của ứng dụng,
đúc kết từ nghiên cứu cơ chế kiểm soát của các agent harness hiện hành và
thiết kế lại cho ngữ cảnh tool call trên nền tảng công việc (đặc tả đầy
đủ: FR-AP-01, FR-AP-10..13).
Quy tắc do người dùng mô tả bằng ngôn ngữ tự nhiên, được **biên dịch thành
hooks + system prompt để chặn tuyệt đối** — hook là lớp chặn cứng, system
prompt chỉ là lớp định hướng bổ trợ.

**QĐ-3 — Ba phương diện chức năng tách bạch hoàn toàn ở giai đoạn đầu.**
Chức năng cố định chỉ kích hoạt thủ công; không có job lai giữa các phương diện.

**QĐ-4 — Lịch trình (khi có ở Phase 2) tạo và quản lý được ở cả hai kênh:**
hội thoại tự nhiên và chỉnh sửa thủ công. Ghi ở đây để định hình kiến trúc
dữ liệu ngay từ MVP, dù scheduler chưa build.

---

## 7. PHẠM VI MVP &amp; PHÂN MỨC ƯU TIÊN (MoSCoW)

### 7.1. Must have — thiếu là MVP vô nghĩa

| ID | Hạng mục |
| --- | --- |
| S-M1 | Ứng dụng desktop Windows + macOS, chạy nền, khởi động cùng hệ điều hành (tuỳ chọn) |
| S-M2 | Pet 2D always-on-top, kéo thả, animation theo trạng thái, có tính cách (QĐ-1) |
| S-M3 | Ô thoại hai chiều: nhập lệnh (văn bản + ảnh) và hiển thị thông báo nén |
| S-M4 | Pet-agent với tool tạo job; worker-agent thực thi trên các connector đã kết nối |
| S-M5 | Connector framework chuẩn hoá (manifest-driven, mục 10.10): thêm connector = thêm manifest + adapter; UX kết nối chuẩn "chọn app → OAuth → xong" cho mọi connector |
| S-M5a | Connector Notion: OAuth, đọc + ghi task (tạo, sửa thuộc tính, di chuyển) |
| S-M5b | Connector Gmail: OAuth, CHỈ ĐỌC (liệt kê, tìm kiếm, đọc nội dung email) — kết nối qua BYO OAuth client ở giai đoạn hiện tại (mục 13.6, FR-CF-11) |
| S-M5d | Connector Google Drive: OAuth, CHỈ ĐỌC — `drive.readonly` qua BYO OAuth client ở giai đoạn hiện tại (mục 13.6); `drive.file` + picker cho kênh đại trà sau này |
| S-M6 | Action ledger đầy đủ cho mọi tool call của worker-agent |
| S-M7 | Undo bằng hành động bù trừ ở cấp job |
| S-M8 | Phê duyệt 3 mode off/smart/on, quy tắc NL → hooks + system prompt |
| S-M9 | Cửa sổ app: danh mục &amp; trạng thái connector, danh sách job, chi tiết job (ledger + undo), cấu hình phê duyệt |
| S-M10 | Vòng đời job đầy đủ, người dùng hủy được job đang chạy |
| S-M11 | Backend: xác thực bằng Google Sign-In (verify ID token → phiên JWT của app), allowlist/invite cho closed beta, đa thiết bị |
| S-M12 | Client: cấu hình LLM provider theo cơ chế providers của pi (subscription /login hoặc API key, custom provider) — KHÔNG có LLM gateway phía backend (ADR-007); key/credential lưu trong secure storage của OS |
| S-M13 | Backend: OAuth broker TỔNG QUÁT theo provider (Notion, Google — token exchange với client_secret phía server; mở rộng được cho provider mới chỉ bằng cấu hình) |
| S-M14 | ~~Telemetry~~ — HOÃN theo ADR-008; metrics mục 5 đo bằng khảo sát + phỏng vấn + log cục bộ người dùng tự nguyện chia sẻ trong beta `[Đề xuất]` |

### 7.2. Should have — nên có, thiếu vẫn phát hành được

| ID | Hạng mục |
| --- | --- |
| S-S1 | Pet phản ánh trạng thái hệ thống qua animation (đang làm việc / chờ phê duyệt / có kết quả) |
| S-S2 | Lịch sử hội thoại với pet trong cửa sổ app |
| S-S3 | Onboarding có hướng dẫn tạo job mẫu đầu tiên |
| S-S4 | Undo từng phần (chọn thao tác trong job để revert) `[Đề xuất]` |

### 7.3. Could have — làm nếu dư thời gian

| ID | Hạng mục |
| --- | --- |
| S-C1 | Phím tắt toàn cục để mở ô thoại nhập lệnh |
| S-C2 | Nhiều skin pet 2D (cùng bộ animation) |
| S-C3 | Chế độ "do not disturb" tạm ẩn thông báo pet |

### 7.4. Won't have — chốt không làm ở MVP

Scheduler NL (phương diện 2); record &amp; tổng hợp họp (phương diện 3); util
buttons; connector ngoài Notion/Gmail/Drive (**Outlook/Microsoft 365** — đã
loại khỏi MVP ở v2.1, xem Nhật ký thay đổi — Jira, SharePoint, Slack... để
Phase sau); thao tác GHI trên Gmail và Drive (gửi mail, sửa file...);
pet 3D; trí nhớ dài hạn của pet; mobile; ngôn ngữ giao diện NGOÀI tiếng
Việt và tiếng Anh.

---

## 8. LUỒNG NGƯỜI DÙNG CỐT LÕI (CORE WORKFLOWS)

### WF-1 — Onboarding

1. Cài đặt app → chạy lần đầu → màn hình chào.
2. Kết nối nền tảng từ danh mục connector: Notion theo luồng
một-click chuẩn (FR-CF-02); Gmail và Drive theo luồng BYO OAuth client
có hướng dẫn từng bước (FR-CF-11, mục 13.6). Tối thiểu Notion (chọn
workspace + database task chính); các connector khác kết nối tại đây
hoặc bổ sung sau từ cửa sổ app.
3. Chọn mode phê duyệt ban đầu (mặc định: **on** `[Đề xuất: an toàn nhất cho lần đầu]`); có thể mô tả quy tắc riêng hoặc dùng bộ quy tắc gợi ý.
4. Pet xuất hiện, tự giới thiệu bằng giọng văn tính cách, gợi ý giao job mẫu.
5. Kết thúc: người dùng đã có 1 job mẫu chạy thành công (mục tiêu M-A2).

### WF-2 — Giao việc bất chợt (happy path, mode off)

1. Người dùng click pet → ô thoại chuyển chế độ nhập, focus sẵn.
2. Nhập lệnh: "thêm task X vào Notion, deadline thứ 5, xếp trước task viết
docs" (có thể đính kèm ảnh chụp đoạn chat).
3. Pet-agent phân tích; nếu đủ thông tin → gọi tool `create_job`; pet phản
hồi ngắn theo tính cách ("Nhận rồi, để tôi lo."). Nếu thiếu thông tin
then chốt → pet hỏi lại đúng MỘT câu gọn (xem FR-AG-05).
4. Người dùng quay lại việc đang làm. Worker-agent thực thi; pet đổi
animation sang trạng thái "đang làm việc".
5. Hoàn thành → pet hiện thông báo nén: "Đã tạo task X, dời 2 task. Bấm xem
chi tiết." Click → cửa sổ app mở trang chi tiết job. Không click → thông
báo tự ẩn sau N giây (mặc định 30s `[Đề xuất]`), vẫn xem lại được trong app.

### WF-3 — Giao việc với phê duyệt (mode smart / on)

1–4. Như WF-2 đến khi worker-agent chạm thao tác thuộc diện quy tắc.
5. Hook chặn cứng TRƯỚC khi tool call thực thi; job chuyển `waiting_approval`.
6. Pet đổi animation "chờ phê duyệt" + ô thoại nêu: thao tác định làm, đối
tượng bị ảnh hưởng, lý do agent muốn làm; hai nút **Approve / Deny**
(đồng thời xuất hiện trong cửa sổ app).
7. Approve → job tiếp tục từ đúng điểm dừng. Deny → worker-agent nhận tín
hiệu, điều chỉnh kế hoạch (bỏ qua thao tác hoặc kết thúc job kèm giải
thích); mọi diễn biến ghi vào ledger.
8. Yêu cầu phê duyệt quá hạn chờ (mặc định 30 phút `[Đề xuất]`) → job tạm
dừng an toàn, không tự thực thi.

### WF-4 — Xem ledger &amp; undo một job

1. Trong cửa sổ app → chi tiết job: tóm tắt kết quả + ledger từng bước
(tool, tham số, kết quả, trạng thái trước/sau, cờ reversible).
2. Người dùng bấm **Undo job**.
3. Hệ thống dựng **kế hoạch bù trừ** từ ledger: chuỗi thao tác ngược, theo
thứ tự đảo; đối chiếu trạng thái Notion hiện tại với trạng thái đã ghi.
4. Hiển thị preview kế hoạch: mục revert được / mục KHÔNG revert được (kèm
lý do: irreversible, hoặc trạng thái đã bị bên khác thay đổi — conflict).
5. Người dùng xác nhận → hệ thống thực thi chuỗi bù trừ. Quá trình undo là
một job mới, có ledger riêng.
6. Báo kết quả: phần revert thành công / phần cần xử lý tay (liệt kê cụ thể).

### WF-5 — Thiết lập &amp; chỉnh quy tắc phê duyệt

1. Cửa sổ app → mục Phê duyệt → chọn mode off/smart/on.
2. Mô tả quy tắc bằng ngôn ngữ tự nhiên (ví dụ: "mọi thao tác xóa, hoặc thay
đổi deadline của task không do tôi tạo, phải hỏi tôi").
3. Hệ thống biên dịch → hiển thị **bản diễn giải có cấu trúc** (điều kiện →
hành động bị chặn) để người dùng xác nhận đúng ý; xác nhận xong quy tắc
mới có hiệu lực.
4. Bộ quy tắc test nội bộ chạy tự động sau mỗi lần biên dịch (xem FR-AP-06).

### WF-6 — Hủy job đang chạy

1. Từ thông báo pet hoặc danh sách job → bấm **Hủy**.
2. Worker-agent dừng ở điểm an toàn gần nhất (không dừng giữa một tool call).
3. Ledger ghi trạng thái `cancelled` + các thao tác ĐÃ thực hiện trước khi
hủy; người dùng được đề nghị undo phần đã làm.

### WF-7 — Agent hỏi giữa chừng (ask flow)

1. Worker-agent đang chạy job thì gặp điểm mơ hồ cần người dùng quyết
(ví dụ: hai database cùng khớp tên, hoặc "cân bằng task" có 2 cách hiểu).
2. Agent gọi `ask_user` với: câu hỏi (1 câu) + tối đa 4 option chọn nhanh
(mỗi option có label ngắn + mô tả tuỳ chọn) + cho phép nhập tự do. Job
chuyển `waiting_input`; pet đổi animation "chờ phê duyệt/chờ trả lời".
3. Ô thoại tự bung **ASK card**: câu hỏi, các nút option, ô nhập tự do, nút
"Mở trong app", nút "Bỏ qua &amp; hủy job". Card KHÔNG cướp focus bàn phím.
4. Người dùng bấm một option hoặc gõ trả lời (ở ô thoại hoặc trong app —
hai nơi đồng bộ). Câu hỏi + câu trả lời ghi vào ledger.
5. Job resume đúng điểm dừng với câu trả lời làm ngữ cảnh; ASK card chuyển
thành ACK ngắn ("OK, làm tiếp đây.").
6. Không trả lời sau 60 giây hiển thị → card thu gọn thành badge trên pet;
quá hạn chờ (mặc định 30 phút) → job tạm dừng an toàn, resume được từ app.

---

## 9. EPIC &amp; USER STORIES KÈM ACCEPTANCE CRITERIA

Định dạng: *Là [ai], tôi muốn [gì], để [giá trị]*. AC viết theo Given/When/Then.

### EPIC 1 — Pet &amp; tương tác nhanh

**US-1.1** — Là người dùng đang tập trung, tôi muốn giao việc cho pet trong
vài giây, để không rời luồng làm việc.

- AC1: Given pet đang hiển thị, When tôi click pet, Then ô thoại nhập mở và
nhận focus bàn phím trong ≤ 500ms.
- AC2: Given ô thoại đang mở, When tôi gõ lệnh và nhấn Enter, Then pet xác
nhận đã nhận trong ≤ 2s (phản hồi tức thời, không chờ job chạy xong).
- AC3: Given tôi kéo-thả một ảnh vào ô thoại, When gửi kèm mô tả, Then job
được tạo với cả ảnh và mô tả làm đầu vào.
- AC4: Given ô thoại đang mở, When tôi nhấn Esc hoặc click ra ngoài, Then ô
thoại đóng và KHÔNG cướp lại focus của cửa sổ tôi đang làm việc.

**US-1.2** — Là người dùng, tôi muốn biết pet đang làm gì qua hình dáng của
nó, để không phải mở app kiểm tra.

- AC1: Pet có tối thiểu 5 trạng thái animation phân biệt được bằng mắt:
idle / nhận lệnh / đang làm việc / chờ phê duyệt / có kết quả.
- AC2: Given có job đang chạy, When job chuyển trạng thái, Then animation
pet cập nhật trong ≤ 2s.

**US-1.3** — Là người dùng, tôi muốn nhận kết quả dạng nén và chỉ mở chi
tiết khi cần, để pet không thành nguồn xao nhãng.

- AC1: Thông báo kết quả ≤ 200 ký tự, nêu được: việc gì xong + con số chính.
- AC2: Given thông báo hiển thị, When tôi click nó, Then cửa sổ app mở đúng
trang chi tiết job đó.
- AC3: Given tôi không tương tác, When hết N giây, Then thông báo tự ẩn và
vẫn truy cập được từ danh sách job.

**US-1.4** — Là người dùng, tôi muốn pet có giọng riêng nhất quán, để cảm
thấy đang làm việc với "một ai đó".

- AC1: Giọng văn pet định nghĩa trong persona spec (tài liệu con của system
prompt pet-agent) và nhất quán trên mọi loại thông điệp.
- AC2: Trong khảo sát beta, ≥ 60% người dùng mô tả được tính cách pet bằng
ít nhất 2 tính từ trùng với persona spec `[Đề xuất: cách đo "có linh hồn"]`.

**US-1.5** — Là người dùng, tôi muốn trả lời câu hỏi của agent bằng một cú
bấm vào option ngay trên ô thoại, để job tiếp tục mà tôi không phải rời việc
đang làm.

- AC1: Given agent gọi `ask_user` với 3 option, When ASK card bung, Then cả
3 option hiển thị dạng nút bấm được + luôn có ô nhập tự do.
- AC2: Given tôi bấm một option, When job resume, Then không có vòng hỏi lại
cho cùng điểm mơ hồ đó, và ledger có bản ghi câu hỏi + lựa chọn của tôi.
- AC3: Given tôi không phản hồi, When hết 60s hiển thị, Then card thu gọn
thành badge (không biến mất); When quá hạn 30 phút, Then job tạm dừng an
toàn và resume được từ app.
- AC4: Given ASK card tự bung, Then focus bàn phím của tôi ở cửa sổ đang làm
việc KHÔNG bị cướp; tôi gõ tiếp được như chưa có gì xảy ra.

**US-1.6** — Là người dùng có nhiều job chạy song song, tôi muốn các thông
điệp xếp hàng trật tự trên một ô thoại duy nhất, để không bị bủa vây bởi
nhiều bong bóng cùng lúc.

- AC1: Tại mọi thời điểm chỉ có TỐI ĐA MỘT card hiển thị; các card khác chờ
trong hàng đợi, thể hiện bằng badge đếm số trên pet.
- AC2: Given 2 APPROVAL + 1 RESULT đang chờ, When ô thoại mở, Then card
APPROVAL cũ nhất hiển thị trước (blocking ưu tiên hơn RESULT), có điều
hướng ‹ › để duyệt qua các card còn lại.
- AC3: Given một job phát card mới trong khi card cũ (không blocking) của
chính nó đang chờ, Then card mới thay thế card cũ — một job không chiếm
hai suất trong hàng đợi.
- AC4: Given tôi bật Do-Not-Disturb, Then không card nào tự bung; tất cả dồn
vào badge; job blocking vẫn chờ đúng trạng thái.

### EPIC 2 — Hệ agent &amp; thực thi trên Notion

**US-2.1** — Là người dùng, tôi muốn agent tạo/sửa/sắp xếp task trên Notion
theo lệnh tự nhiên, để không tự thao tác tay.

- AC1: Given đã kết nối Notion, When tôi yêu cầu tạo task với tiêu đề +
deadline + vị trí ưu tiên, Then task xuất hiện đúng database với đúng ba
thuộc tính đó.
- AC2: Given lệnh yêu cầu "cân bằng lại các task", When agent thực hiện,
Then mọi thay đổi thứ tự/thuộc tính đều xuất hiện trong ledger — không có
thay đổi ngoài ledger.
- AC3: Bộ 20 lệnh kiểm thử chuẩn (test suite cố định) đạt tỉ lệ thực thi
đúng ≥ 80% `[Đề xuất: ngưỡng cần hiệu chỉnh sau alpha]`.

**US-2.2** — Là người dùng, tôi muốn agent hỏi lại khi lệnh mơ hồ thay vì
đoán bừa, để tránh phải undo.

- AC1: Given lệnh thiếu thông tin then chốt (không xác định được database
đích hoặc đối tượng task), When pet-agent phân tích, Then pet hỏi lại đúng
MỘT câu gộp các ý còn thiếu, không tự tạo job.
- AC2: Given tôi trả lời câu hỏi, When đủ thông tin, Then job được tạo mà
không hỏi thêm vòng nữa (trừ khi phát sinh mơ hồ mới từ chính câu trả lời).

**US-2.3** — Là người dùng, tôi muốn hủy job đang chạy, để giữ quyền kiểm
soát cuối cùng.

- AC1: Given job đang `running`, When tôi bấm Hủy, Then không có tool call
MỚI nào được thực thi sau thời điểm hủy.
- AC2: Then ledger ghi rõ điểm dừng và danh sách thao tác đã thực hiện,
kèm đề nghị undo phần đã làm.

### EPIC 3 — Ledger &amp; Undo (QĐ-2)

**US-3.1** — Là người dùng, tôi muốn đọc được chính xác agent đã làm gì,
để kiểm chứng mà không phải mở Notion so từng chỗ.

- AC1: Mỗi bước trong ledger hiển thị: hành động (ngôn ngữ người đọc được),
đối tượng, thời điểm, kết quả, trạng thái trước/sau (khi lấy được), cờ
reversible/irreversible.
- AC2: Kiểm thử đối chiếu: với 10 job mẫu, 100% thay đổi thực tế trên
Notion có mặt trong ledger (không có "thao tác ngầm").

**US-3.2** — Là người dùng, tôi muốn undo một job bằng một nút, để dám cho
agent quyền ghi.

- AC1: Given job đã `done`, When tôi bấm Undo, Then hệ thống hiển thị
preview kế hoạch bù trừ TRƯỚC khi thực thi, phân rõ: revert được / không
revert được kèm lý do.
- AC2: Given tôi xác nhận, When undo chạy xong, Then các thao tác reversible
được đưa về trạng thái đã ghi; báo cáo cuối liệt kê cụ thể phần thành công
và phần cần xử lý tay.
- AC3: Given một đối tượng đã bị bên thứ ba sửa sau khi job chạy (conflict),
When undo chạy, Then hệ thống KHÔNG ghi đè mù mà đánh dấu conflict và hỏi
người dùng quyết định cho riêng mục đó.
- AC4: Quá trình undo được ghi ledger như một job mới, tự nó cũng xem lại được.

### EPIC 4 — Phê duyệt 3 mode (QĐ-2)

**US-4.1** — Là người dùng, tôi muốn đặt quy tắc phê duyệt bằng lời mô tả
tự nhiên, để không phải học cú pháp cấu hình.

- AC1: Given tôi nhập một mô tả quy tắc, When hệ thống biên dịch, Then bản
diễn giải có cấu trúc (điều kiện → hành động bị chặn) hiển thị để tôi xác
nhận; quy tắc chỉ hiệu lực SAU xác nhận.
- AC2: Given mô tả không biên dịch được thành quy tắc chặn cứng, Then hệ
thống nói rõ phần nào không hỗ trợ, KHÔNG âm thầm chuyển thành "nhắc nhở mềm".

**US-4.2** — Là người dùng, tôi muốn các thao tác thuộc diện quy tắc bị
chặn tuyệt đối cho đến khi tôi duyệt, để an tâm bật quyền ghi.

- AC1: Kiểm thử bộ quy tắc chuẩn: 100% thao tác khớp quy tắc bị hook chặn
TRƯỚC khi tool call chạy — 0 trường hợp lọt (đây là hard gate phát hành,
xem mục 17).
- AC2: Given job bị chặn, When tôi Approve, Then job tiếp tục từ đúng điểm
dừng, không chạy lại các bước đã xong.
- AC3: Given tôi Deny, Then worker-agent không thực thi thao tác đó, và
ledger ghi rõ quyết định deny + phản ứng của agent.
- AC4: Given quá hạn chờ, Then job tạm dừng an toàn, không tự thực thi.

**US-4.3** — Là người dùng, tôi muốn chuyển nhanh giữa off/smart/on, để tự
điều chỉnh mức kiểm soát theo bối cảnh.

- AC1: Đổi mode có hiệu lực với job TẠO SAU thời điểm đổi; job đang chạy giữ
mode tại thời điểm tạo `[Đề xuất: tránh đổi luật giữa trận]`.
- AC2: Mode hiện hành luôn nhìn thấy được ở cả pet (chỉ báo nhỏ) và cửa sổ app.

### EPIC 5 — Cửa sổ app &amp; onboarding

**US-5.1** — Là người dùng mới, tôi muốn từ cài đặt đến job đầu tiên trong
≤ 5 phút, để thấy giá trị ngay.

- AC1: Luồng WF-1 hoàn tất được không cần tài liệu ngoài; đo trung vị thời
gian onboarding ≤ 5 phút trong beta.
- AC2: Bước kết nối Notion có xử lý lỗi rõ ràng (từ chối quyền, hết hạn
phiên) với hướng dẫn khắc phục.

**US-5.2** — Là người dùng, tôi muốn thấy toàn bộ job và trạng thái của
chúng một chỗ, để quản lý được những gì đã giao.

- AC1: Danh sách job hiển thị: yêu cầu gốc, trạng thái, thời gian, kết quả
nén; lọc theo trạng thái; realtime khi trạng thái đổi.
- AC2: Job `waiting_approval` nổi bật lên đầu danh sách kèm nút xử lý ngay.

---

## 10. YÊU CẦU CHỨC NĂNG CHI TIẾT (FR)

Ưu tiên: [M] Must / [S] Should / [C] Could. Mỗi FR phải kiểm thử được.

### 10.1. Module Pet &amp; ô thoại (PET)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-PET-01 | M | Pet render 2D, always-on-top trên mọi cửa sổ, kéo thả tự do, vị trí được ghi nhớ qua các phiên. |
| FR-PET-02 | M | Bộ animation ≥ 5 trạng thái: idle, nhận lệnh, đang làm việc, chờ phê duyệt, có kết quả; chuyển trạng thái ≤ 2s sau sự kiện. |
| FR-PET-03 | M | Click pet mở ô thoại nhập (focus ≤ 500ms); Esc/click-ngoài đóng ô thoại và trả focus về cửa sổ trước đó. |
| FR-PET-04 | M | Ô thoại nhận: văn bản, ảnh (kéo-thả, paste từ clipboard); giới hạn ảnh ≤ 10MB/ảnh, ≤ 3 ảnh/lệnh `[Đề xuất]`. |
| FR-PET-05 | M | Thông báo nén ≤ 200 ký tự; click mở đúng trang chi tiết job; tự ẩn sau 30s (cấu hình được 10–120s). |
| FR-PET-06 | M | Yêu cầu phê duyệt hiển thị trên ô thoại với nút Approve/Deny hoạt động tương đương trong cửa sổ app. |
| FR-PET-07 | M | Người dùng ẩn/hiện pet từ tray icon; ẩn pet KHÔNG dừng job đang chạy. |
| FR-PET-08 | S | Chỉ báo mode phê duyệt hiện hành trên pet (badge nhỏ). |
| FR-PET-09 | C | Phím tắt toàn cục mở ô thoại nhập. |
| FR-PET-10 | M | Giọng văn pet tuân theo persona spec; mọi thông điệp pet sinh ra đi qua pet-agent (không hardcode chuỗi thông báo khô). |

### 10.2. Module hệ agent (AG)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-AG-01 | M | Pet-agent là một agent chạy trên **pi agents SDK** (instance riêng, ADR-004) với system prompt persona + bộ tool tối thiểu: `create_job`, `get_job_status`, `cancel_job`, `notify_user`, `ask_user` (hỗ trợ option có cấu trúc — xem FR-INT-07 và Phụ lục A.5). Pet-agent KHÔNG trực tiếp gọi tool connector (QĐ-1). |
| FR-AG-02 | M | Worker-agent chạy trong harness **xây trên pi agents SDK** (ADR-004): pi cung cấp vòng agentic, tool registry, session JSONL, provider layer; ta cung cấp system prompt nhiệm vụ + bộ tool sinh từ connector manifest. **MỌI tool đăng ký vào pi đều được bọc (wrap) bởi lớp hook phê duyệt + nghĩa vụ ghi ledger** (ghi trước → hook đánh giá → thực thi → ghi kết quả) — nhờ toàn bộ tool là do ta đăng ký nên bảo đảm này không phụ thuộc năng lực middleware của framework; các tool coding mặc định của pi KHÔNG được đăng ký cho worker-agent. Session JSONL của pi lưu làm transcript hội thoại agent; ledger vẫn là store append-only riêng (FR-LG). |
| FR-AG-03 | M | Vòng đời job: `created → queued → running → (waiting_approval ⇄ running) / (waiting_input ⇄ running) → done / failed / cancelled`. `waiting_input` là trạng thái chờ người dùng trả lời ASK (Phụ lục A.5). Mọi chuyển trạng thái ghi timestamp. |
| FR-AG-04 | M | Nhiều job chạy song song được; mỗi job độc lập, không chia sẻ context với job khác `[Đề xuất: cô lập để dễ trace]`. |
| FR-AG-05 | M | Khi lệnh thiếu thông tin then chốt (không xác định được database đích / đối tượng), pet-agent hỏi lại một câu gộp; không tạo job khi chưa đủ. Danh mục "thông tin then chốt" định nghĩa trong harness spec. |
| FR-AG-06 | M | Hủy job: dừng tại ranh giới tool call (không ngắt giữa một call); ghi điểm dừng vào ledger. |
| FR-AG-07 | M | Job `failed` phải kèm: lý do người đọc hiểu được + các thao tác đã thực hiện trước khi fail + đề nghị undo phần đã làm. |
| FR-AG-08 | S | Retry có kiểm soát cho lỗi tạm thời (rate limit, timeout mạng): tối đa 3 lần, exponential backoff; mỗi retry ghi ledger. |
| FR-AG-09 | M | Timeout job mặc định 10 phút `[Đề xuất]`; quá hạn → `failed` theo FR-AG-07. |
| FR-AG-10 | M | **Nguyên tắc nền: đây là AGENT HOẠT ĐỘNG, không phải oneshot LLM call.** Worker-agent chạy vòng agentic nhiều bước (thu thập ngữ cảnh → lập kế hoạch → hành động → tự kiểm chứng → báo cáo), được phép hỏi người dùng giữa chừng (`ask_user`) và lặp cho tới khi xong. Harness mở rộng năng lực bằng **skills** (tri thức nghiệp vụ đóng gói), **rules** (ràng buộc hành vi) và **hooks** (chặn cứng) — độ tin cậy đến từ năng lực harness, KHÔNG đến từ việc chuẩn hoá đầu vào của người dùng. Mọi bộ kiểm thử chấp nhận đo kết quả CẢ QUÁ TRÌNH (cho phép đa lượt), không đo độ chính xác parse một lượt. |
| FR-AG-11 | M | **Cấu hình LLM provider phía client (ADR-007):** app cung cấp UI cấu hình provider theo đúng cơ chế providers của pi agents (subscription qua /login OAuth, API key, hoặc custom provider); credential lưu trong secure storage của OS (đồng cấp token connector, NFR-SEC-01); ánh xạ vai trò → model (pet-agent / worker-agent / đúc kết quy tắc / undo-agent) là cấu hình trong app, có giá trị mặc định khuyến nghị, đổi được không cần phát hành lại. Người dùng tự chọn và tự chịu chi phí provider của mình — đảm bảo tính đa dạng provider. |

### 10.3. Module connector Notion (NT)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-NT-01 | M | Kết nối OAuth; người dùng chọn workspace + database task mặc định; token lưu an toàn (NFR-SEC-01). |
| FR-NT-02 | M | Thao tác đọc: truy vấn database, đọc page/task và thuộc tính, đọc cấu trúc database (schema thuộc tính). |
| FR-NT-03 | M | Thao tác ghi: tạo task; cập nhật thuộc tính (tiêu đề, deadline, trạng thái, ưu tiên, người phụ trách...); di chuyển/sắp xếp lại. |
| FR-NT-04 | M | TRƯỚC mỗi thao tác ghi, connector đọc và lưu snapshot trạng thái hiện tại của đối tượng vào ledger (phục vụ undo bù trừ, QĐ-2). |
| FR-NT-05 | M | Mỗi loại thao tác ghi khai báo trong tool spec: có compensating action hay không, và công thức dựng nó từ snapshot. Thao tác không có → gắn cờ irreversible. |
| FR-NT-06 | M | Tôn trọng rate limit Notion API: hàng đợi request + backoff; không để job fail chỉ vì burst request `[Lưu ý: ngưỡng rate limit cụ thể xác nhận trong spike SP-1]`. |
| FR-NT-07 | M | Xử lý token hết hạn/thu hồi: job đang chạy chuyển `failed` với lý do rõ; app hướng dẫn kết nối lại. |
| FR-NT-08 | S | Hỗ trợ nhiều database trong một workspace; lệnh nói rõ database thì dùng đúng, không rõ thì áp dụng FR-AG-05. |

### 10.4. Module action ledger (LG)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-LG-01 | M | Mỗi bản ghi gồm: job_id, số thứ tự bước, loại (tool_call / decision / approval / error / info), tool + tham số, kết quả, snapshot trước/sau (khi có), cờ reversible, mô tả compensating action (khi có), timestamp. |
| FR-LG-02 | M | Ledger là append-only: không sửa/xóa bản ghi; đính chính bằng bản ghi mới tham chiếu bản cũ. |
| FR-LG-03 | M | Ledger hiển thị cho người dùng ở dạng ngôn ngữ tự nhiên dễ đọc, có nút mở rộng xem dữ liệu thô từng bước. |
| FR-LG-04 | M | Quyết định của con người (approve/deny/hủy/xác nhận undo) cũng là bản ghi ledger. |
| FR-LG-05 | M | Kiểm thử "không thao tác ngầm": mọi thay đổi agent tạo ra trên Notion phải truy về được một bản ghi ledger (AC của US-3.1). |
| FR-LG-06 | S | Tìm kiếm/lọc ledger theo job, loại thao tác, khoảng thời gian. |
| FR-LG-07 | S | Chính sách lưu trữ: giữ tối thiểu 90 ngày `[Đề xuất]`; cấu hình được; xóa ledger là hành động chủ động của người dùng có cảnh báo. |

### 10.5. Module undo (UD)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-UD-01 | M | Undo cấp job là bài toán **suy luận thao tác ngược từ ledger**, không phải revert kiểu source control: một undo-agent đọc chuỗi thao tác đã thực hiện và dựng chuỗi bù trừ theo thứ tự đảo, dùng công thức bù trừ khai trong manifest (FR-CF-01) làm nền khi có, và suy luận bổ sung khi tình huống nằm ngoài công thức tĩnh. Việc tồn tại thao tác irreversible (gửi mail, gọi API một chiều...) là KẾT QUẢ BÌNH THƯỜNG được chấp nhận và khai báo minh bạch — không phải lỗi của cơ chế undo. |
| FR-UD-02 | M | Trước khi thực thi, đối chiếu trạng thái hiện tại của từng đối tượng với snapshot; đối tượng đã bị thay đổi bởi bên khác → đánh dấu **conflict**, không ghi đè mù, hỏi người dùng quyết định riêng mục đó. |
| FR-UD-03 | M | Preview kế hoạch trước khi chạy: liệt kê revert được / irreversible / conflict, mỗi mục kèm lý do; người dùng xác nhận mới thực thi. |
| FR-UD-04 | M | Undo chạy như một job mới với ledger riêng; kết quả cuối liệt kê rõ phần thành công và phần cần xử lý tay. |
| FR-UD-05 | S | Undo từng phần: chọn tập thao tác trong job để revert; hệ thống cảnh báo nếu tập chọn phá vỡ phụ thuộc logic (ví dụ revert "tạo task" mà giữ "sửa task đó"). |
| FR-UD-06 | M | Job có 100% thao tác irreversible → nút Undo vô hiệu kèm giải thích, thay vì tạo kỳ vọng sai. |

### 10.6. Module phê duyệt (AP)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-AP-01 | M | **Hệ phê duyệt 3 mode của ứng dụng (ĐÃ CHỐT — OQ-1):** (a) **on** — mọi thao tác GHI trên mọi connector đều dừng chờ người dùng duyệt; thao tác đọc tự do. (b) **smart** — đánh giá rủi ro HAI TẦNG trước mỗi tool call ghi: *tầng 1 — mẫu tĩnh:* tự động chặn-chờ-duyệt các nhóm thao tác nguy hiểm định nghĩa sẵn (irreversible; xóa/archive; hàng loạt &gt;5 đối tượng `[Đề xuất ngưỡng]`; thay đổi quyền/chia sẻ; tác động lên đối tượng không do người dùng tạo) cộng mọi quy tắc người dùng đã khai; *tầng 2 — đánh giá LLM phụ trợ* cho thao tác ghi không khớp mẫu: rủi ro thấp → tự duyệt (ghi ledger kèm lý do), nguy hiểm rõ ràng → tự từ chối (worker-agent phải điều chỉnh kế hoạch), không chắc chắn → đẩy lên người dùng (fail-closed). (c) **off** — bỏ bước chờ duyệt; ledger vẫn ghi đầy đủ; hardline blocklist (FR-AP-10) vẫn hiệu lực. |
| FR-AP-10 | M | **Hardline blocklist:** danh mục thao tác bị TỪ CHỐI TUYỆT ĐỐI bất kể mode (kể cả off) và không cấu hình tắt được — tối thiểu gồm: xoá/archive hàng loạt cấp toàn database hoặc toàn thư mục gốc, thao tác vượt ra ngoài scope đã cấp, thao tác lên chính cấu hình phê duyệt/ledger của ứng dụng. Danh mục thuộc manifest hệ thống, cập nhật qua phát hành app. |
| FR-AP-11 | M | Bốn mức quyết định khi duyệt: **Approve lần này** / **Approve loại thao tác này trong job này** (hết hiệu lực khi job kết thúc) / **Thêm vào allowlist vĩnh viễn** (bỏ qua chặn cho mẫu thao tác này về sau; danh sách allowlist xem-sửa-xoá được trong cửa sổ app) / **Deny**. Mọi quyết định ghi ledger. |
| FR-AP-12 | M | Mode **off** phải có nhắc nhở trực quan thường trực: chỉ báo cảnh báo trên pet + banner trong cửa sổ app, để người dùng không quên mình đang tắt lớp bảo vệ. |
| FR-AP-13 | M | Nguyên tắc ngữ cảnh không người trực (đặt sẵn cho Phase 2 scheduler): job chạy không có người trực (theo lịch, webhook) khi chạm thao tác thuộc diện duyệt → mặc định **deny và tạm dừng an toàn**, không bao giờ tự duyệt; người dùng xử lý sau từ hàng chờ. |
| FR-AP-02 | M | Quy tắc hình thành qua **hội thoại đúc kết**: người dùng nói ý định thô, agent hỏi làm rõ qua nhiều lượt (thời điểm? phạm vi? ngoại lệ?) rồi đúc kết — KHÔNG yêu cầu cung cấp đủ thông tin trong một lần, không đòi hỏi chuẩn câu từ. Kết quả đúc kết được biên dịch thành: (a) hooks chặn cứng đánh giá TRƯỚC mỗi tool call, (b) đoạn system prompt bổ trợ cho worker-agent, (c) bản diễn giải có cấu trúc cho người dùng xác nhận. Quy tắc chỉ hiệu lực sau xác nhận. |
| FR-AP-03 | M | Hook là lớp chặn quyết định: dù system prompt bị vượt qua (prompt injection, lỗi model), tool call khớp quy tắc vẫn KHÔNG thực thi được. |
| FR-AP-04 | M | Mô tả không biên dịch được thành quy tắc cứng → báo rõ phần không hỗ trợ; không âm thầm hạ cấp thành nhắc nhở. |
| FR-AP-05 | M | Ở smart/on: thao tác gắn cờ irreversible mặc định thuộc diện phê duyệt, kể cả khi không quy tắc nào nhắc đến `[Đề xuất: hệ quả logic của QĐ-2, cần xác nhận]`. |
| FR-AP-06 | M | Sau mỗi lần biên dịch quy tắc, bộ test tự động chạy các kịch bản mẫu (thao tác phải chặn / phải cho qua) và hiển thị kết quả cho người dùng. |
| FR-AP-07 | M | Yêu cầu phê duyệt nêu: thao tác, đối tượng, giá trị thay đổi trước→sau (dự kiến), quy tắc nào kích hoạt. |
| FR-AP-08 | M | Hết hạn chờ phê duyệt (mặc định 30 phút, cấu hình được) → job tạm dừng an toàn; người dùng resume hoặc hủy từ app. |
| FR-AP-09 | M | Đổi mode áp dụng cho job tạo sau thời điểm đổi; job đang chạy giữ mode lúc tạo. |

### 10.7. Module cửa sổ app (APP)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-APP-01 | M | Khu vực: Connectors (danh mục app, trạng thái từng kết nối, Connect/Reconnect/Disconnect theo FR-CF-02/05/08), Jobs (danh sách + chi tiết), Phê duyệt (mode + quy tắc + hàng chờ), Cài đặt (pet, thông báo, khởi động cùng OS). |
| FR-APP-02 | M | Danh sách job realtime: yêu cầu gốc, trạng thái, thời gian, kết quả nén; lọc theo trạng thái; `waiting_approval` ghim đầu. |
| FR-APP-03 | M | Trang chi tiết job: yêu cầu gốc (kèm ảnh nếu có), tóm tắt kết quả, ledger (FR-LG-03), nút Undo/Hủy theo trạng thái. |
| FR-APP-04 | M | Onboarding theo WF-1, có xử lý lỗi từng bước. |
| FR-APP-05 | S | Lịch sử hội thoại với pet (các lệnh, câu hỏi lại, phản hồi). |
| FR-APP-06 | M | Đóng cửa sổ app = thu về tray, app và pet tiếp tục chạy; Thoát hẳn là hành động riêng có xác nhận khi còn job đang chạy. |

### 10.8. Module backend service (BE)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-BE-01 | M | Xác thực bằng **Google Sign-In** (ADR-006): client thực hiện OAuth với Google, backend verify ID token → phát hành phiên JWT access/refresh của app; một tài khoản dùng trên nhiều thiết bị; đăng xuất thu hồi refresh token. Closed beta gate bằng allowlist email/invite `[Đề xuất]`. |
| FR-BE-02 | M | OAuth broker connector (Notion, Google): nhận authorization code từ client, token exchange bằng `client_secret` phía server, trả token về client qua TLS. Server KHÔNG lưu token connector — token chỉ tồn tại trong secure storage của client (nhất quán NFR-SEC-03; OQ-9). |
| FR-BE-03 | — | **ĐÃ LOẠI BỎ (ADR-007):** không có LLM gateway. LLM đi thẳng client → provider theo cơ chế providers của pi agents; xem FR-AG-11. |
| FR-BE-04 | — | **ĐÃ LOẠI BỎ (ADR-007):** không metering phía server — chi phí LLM thuộc provider account của người dùng. |
| FR-BE-05 | — | **ĐÃ LOẠI BỎ (ADR-007):** không rate limit/budget cap LLM phía server; chỉ giữ rate limit cơ bản cho các endpoint auth/broker (gộp vào FR-BE-11). |
| FR-BE-06 | — | **ĐÃ LOẠI BỎ (ADR-007):** model routing là cấu hình phía client (FR-AG-11), không phải server. |
| FR-BE-07 | — | **HOÃN (ADR-008):** không telemetry ingest ở giai đoạn này; metrics mục 5 đo bằng khảo sát/phỏng vấn/log tự nguyện. |
| FR-BE-08 | M | Mọi endpoint (trừ auth và version check) yêu cầu JWT hợp lệ; toàn bộ giao tiếp bắt buộc TLS. |
| FR-BE-09 | S | Version check &amp; update manifest cho desktop app (phối hợp electron-updater — ADR-009). |
| FR-BE-10 | S | Quản trị tối thiểu: quản lý allowlist/invite closed beta. |
| FR-BE-11 | M | Health endpoint + logging/monitoring cơ bản + rate limit cơ bản chống lạm dụng cho auth/broker. |
| FR-BE-12 | M | Xoá tài khoản: người dùng tự xoá được từ cửa sổ app — backend xoá Account/Device/Session/bản ghi allowlist; client hướng dẫn thu hồi các ủy quyền connector (revoke) và xoá dữ liệu cục bộ (ledger, config, credential trong secure storage) với xác nhận rõ ràng. |

### 10.9. Module tương tác hội thoại pet &amp; ô thoại (INT)

Chi tiết thiết kế tại **Phụ lục A** — bảng dưới là danh mục yêu cầu kiểm thử được.

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-INT-01 | M | Ô thoại hiển thị đúng MỘT card tại một thời điểm; card chờ thể hiện bằng badge đếm số trên pet; điều hướng ‹ › giữa các card chờ. |
| FR-INT-02 | M | Hệ card gồm 7 loại với anatomy chuẩn tại Phụ lục A.2: ACK, PROGRESS (Should), ASK, APPROVAL, RESULT, ERROR, SYSTEM. Không có thông điệp nào ngoài 7 loại này. |
| FR-INT-03 | M | Máy trạng thái ô thoại theo Phụ lục A.3: HIDDEN → COMPOSER / CARD / BADGE. Click pet: có card chờ → mở card ưu tiên nhất; không có → mở composer. Trong CARD luôn có lối tắt chuyển sang composer. |
| FR-INT-04 | M | Card tự bung KHÔNG BAO GIỜ chiếm keyboard focus; ô thoại chỉ nhận focus khi người dùng chủ động click vào nó. |
| FR-INT-05 | M | Ưu tiên hàng đợi: blocking (ASK, APPROVAL — FIFO giữa chúng) &gt; ERROR &gt; RESULT &gt; ACK/PROGRESS. Card mới của một job thay thế card non-blocking cũ của chính job đó; card blocking không bị thay thế tự động. |
| FR-INT-06 | M | ASK card: câu hỏi 1 câu + 0–4 option nút (label ≤ 30 ký tự, mô tả phụ tuỳ chọn) + ô nhập tự do (mặc định bật) + "Mở trong app" + "Bỏ qua &amp; hủy job". Job ở `waiting_input`. |
| FR-INT-07 | M | Tool `ask_user` nhận tham số: `question`, `options[] {id, label, description?}`, `allow_free_text` (mặc định true). Câu trả lời (option id hoặc text) ghi ledger (mở rộng FR-LG-04) và resume job đúng điểm dừng. Mỗi job tối đa MỘT ASK đang mở tại một thời điểm. |
| FR-INT-08 | M | APPROVAL card anatomy: hành động định làm, đối tượng, thay đổi trước→sau dự kiến, quy tắc kích hoạt (khớp FR-AP-07), nút Approve / Deny. Quyết định đồng bộ hai chiều với cửa sổ app theo thời gian thực. |
| FR-INT-09 | M | APPROVAL card cung cấp đủ 4 mức quyết định của FR-AP-11 (lần này / loại này trong job / allowlist vĩnh viễn / deny); mức allowlist vĩnh viễn yêu cầu một bước xác nhận phụ để tránh bấm nhầm. |
| FR-INT-10 | M | Tự ẩn: ACK 5s; RESULT 30s (cấu hình 10–120s); ASK / APPROVAL / ERROR / SYSTEM không tự ẩn — thu gọn thành badge sau 60s hiển thị liên tục. |
| FR-INT-11 | M | Chế độ Do-Not-Disturb: không card nào tự bung, tất cả dồn badge; bật/tắt từ menu chuột phải của pet và trong app; trạng thái DND hiển thị trên pet. |
| FR-INT-12 | M | Menu chuột phải trên pet: Mở app / DND on-off / Ẩn pet / Thoát; hiển thị mode phê duyệt hiện hành (bấm vào dẫn tới app để đổi, có xác nhận — không đổi mode bằng một click). |
| FR-INT-13 | M | Composer: Enter gửi, Shift+Enter xuống dòng, Esc đóng, paste và kéo-thả ảnh; giao lệnh mới được ngay cả khi đang có job chạy (job song song theo FR-AG-04). |
| FR-INT-14 | M | Khi pet đang ẩn: card blocking (ASK, APPROVAL) và ERROR đẩy qua notification của hệ điều hành; click notification mở app đúng ngữ cảnh `[Đề xuất]`. |
| FR-INT-15 | M | Sau crash/restart: mọi card blocking khôi phục từ trạng thái job + ledger, hàng đợi dựng lại đúng thứ tự ưu tiên (nhất quán NFR-RL-01). |
| FR-INT-16 | S | Khi cửa sổ app đang được focus: card mới không tự bung ở ô thoại mà hiển thị trong app (tránh thông báo trùng lặp hai nơi). |

### 10.10. Module connector framework (CF)

Nguyên tắc: connector là **dữ liệu + adapter**, không phải code đặc thù rải
trong lõi. Thêm nền tảng thứ N (mục tiêu: hàng chục đến hàng trăm) = viết
một manifest + một adapter, không sửa Job Manager, hooks, ledger hay UI.

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-CF-01 | M | Mỗi connector định nghĩa bằng **manifest** khai báo: định danh + tên + icon; cấu hình OAuth (authorize/token endpoint, scope theo từng capability, PKCE hay confidential); danh sách tool (đọc/ghi) với schema tham số; và với MỖI tool ghi: phương pháp snapshot trước-ghi, công thức compensating action, hoặc cờ `irreversible` (thực thi hợp đồng QĐ-2 ở cấp framework). |
| FR-CF-02 | M | UX kết nối chuẩn cho MỌI connector: danh mục app trong cửa sổ app → bấm Connect → trình duyệt mở trang ủy quyền của nền tảng → quay về app ở trạng thái "đã kết nối". KHÔNG có bước kỹ thuật nào với người dùng (không dán token, không nhập client ID, không cấu hình URI). |
| FR-CF-03 | M | OAuth broker phía backend tổng quát hoá theo provider: cấp authorize URL, thực hiện token exchange (giữ client_secret server-side), hỗ trợ PKCE khi provider cho phép; thêm provider mới chỉ bằng cấu hình server, không đổi API contract với client. Token trả về và lưu ở client (nhất quán FR-BE-02, OQ-9); refresh token do client thực hiện, qua broker khi provider yêu cầu client_secret. |
| FR-CF-04 | M | Nguyên tắc scope tối thiểu: chỉ xin scope cho capability đang bật; capability mới cần scope mới → luồng re-consent riêng, không xin trước "cho sẵn". Manifest hỗ trợ **scope profile theo kênh phát hành**: cùng một connector khai được nhiều bộ ánh xạ capability→scope (ví dụ Google kênh BYO-client dùng `gmail.readonly`+`drive.readonly`; kênh đại trà client trung tâm dùng bộ hẹp hơn như `drive.file`) — chuyển kênh là chọn profile, không sửa lõi manifest; đây là điều kiện để kiểm soát mức CASA (AL1 vs AL2) khi mở đại trà (mục 13.7). |
| FR-CF-05 | M | Trạng thái từng connector hiển thị trong app: connected / token hết hạn / lỗi quyền / bị thu hồi — kèm nút Reconnect một bấm; job đụng connector lỗi → `failed` với lý do rõ và deep-link tới trang reconnect. |
| FR-CF-06 | M | Bộ tool của worker-agent sinh động từ manifest của các connector ĐÃ kết nối; connector chưa kết nối không xuất hiện trong tool set (agent không "biết" đến nó). |
| FR-CF-07 | M | Hooks phê duyệt và ledger hoạt động đồng nhất trên mọi connector thông qua hợp đồng manifest — thao tác `irreversible` của bất kỳ connector nào tự động thuộc diện FR-AP-05, không cần code riêng. |
| FR-CF-08 | M | Ngắt kết nối: gọi revoke endpoint của provider (khi có), xoá token khỏi secure storage; job đang chạy dùng connector đó fail sạch theo FR-AG-07. |
| FR-CF-09 | S | Giao diện tool của connector thiết kế tương thích chuẩn MCP (Model Context Protocol) để giai đoạn sau có thể nhận connector bên thứ ba dạng MCP server mà không đổi kiến trúc `[Đề xuất]`. |
| FR-CF-10 | M | Agent được phép dùng NHIỀU connector trong một job (ví dụ đọc Gmail + Drive rồi ghi Notion); ledger ghi rõ connector của từng tool call. |
| FR-CF-11 | M | **Chế độ BYO OAuth client (per-connector):** người dùng nạp client credentials CỦA RIÊNG HỌ (client_id/secret từ Google Cloud project của họ) cho một connector thay vì dùng OAuth client trung tâm của app; luồng OAuth chạy với client đó, token vẫn lưu secure storage cục bộ. **Đây là kênh kết nối CHÍNH cho các connector Google ở giai đoạn hiện tại (quyết định mục 13.6)** — luồng kết nối phải có hướng dẫn từng bước ngay trong app (tạo project, bật API, consent screen, thêm test user, tạo client, nạp JSON), kèm cảnh báo hạn refresh token 7 ngày ở trạng thái Testing và gợi ý dùng Internal user type nếu có Google Workspace. Không phải mục cài đặt ẩn — là một biến thể chính thức của luồng Connect trong danh mục connector. |

### 10.11. Module connector Gmail (GM) &amp; Google Drive (DR)

| ID | Ưu tiên | Yêu cầu |
| --- | --- | --- |
| FR-GM-01 | M | Gmail CHỈ ĐỌC ở MVP: liệt kê/tìm kiếm email theo truy vấn, đọc nội dung message + metadata (người gửi, thời gian, nhãn); KHÔNG gửi, sửa, xóa, gắn nhãn. |
| FR-GM-02 | M | Scope tối thiểu đủ cho đọc (thuộc nhóm restricted của Google). Giai đoạn hiện tại: kết nối qua BYO OAuth client (FR-CF-11, mục 13.6) — không cần verification/CASA vì OAuth app thuộc chính người dùng; khi mở đại trà bằng client trung tâm mới cần hoàn tất verification + CASA. Luồng kết nối hiển thị disclosure về việc nội dung email được đưa tới LLM provider do người dùng cấu hình (khớp NFR-SEC-02, R-13). |
| FR-GM-03 | M | Nội dung email chỉ đưa vào ngữ cảnh job khi job cần; không index/lưu trữ nền toàn bộ hộp thư; phần email trích vào ledger tuân chính sách lưu trữ FR-LG-07. |
| FR-DR-01 | M | Drive CHỈ ĐỌC ở MVP: tìm file, đọc metadata, đọc nội dung các định dạng phổ biến (Google Docs/Sheets qua export, PDF, text, ảnh); KHÔNG tạo, sửa, xóa, chia sẻ. |
| FR-DR-02 | M | Chiến lược scope (ĐÃ CHỐT — OQ-14 + mục 13.6): giai đoạn hiện tại dùng `drive.readonly` qua kênh BYO OAuth client (FR-CF-11) — agent tự tìm toàn Drive; `drive.file` + picker là cấu hình dành cho kênh đại trà khi mở rộng người dùng phổ thông. Framework hỗ trợ cả hai qua manifest; đích dài hạn khi kích hoạt CASA: `drive.readonly` trên client trung tâm. |
| FR-DR-03 | M | Vì Gmail/Drive không có thao tác ghi ở MVP: mọi tool của hai connector này gắn cờ read-only trong manifest; hooks vẫn áp dụng được quy tắc trên thao tác ĐỌC nếu người dùng khai (ví dụ "đọc email từ người X phải hỏi tôi") `[Đề xuất]`. |

---

## 11. YÊU CẦU PHI CHỨC NĂNG (NFR)

### 11.1. Hiệu năng

| ID | Yêu cầu | Ngưỡng `[Đề xuất, hiệu chỉnh sau spike]` |
| --- | --- | --- |
| NFR-PF-01 | Tài nguyên pet khi idle | Mục tiêu mềm `[Đề xuất]`, KHÔNG phải tiêu chí chọn stack (SP-3 chọn theo tiềm năng): dùng làm ngưỡng theo dõi tối ưu hoá, không phải gate |
| NFR-PF-02 | Độ trễ mở ô thoại | ≤ 500ms từ click đến nhận focus |
| NFR-PF-03 | Phản hồi xác nhận của pet-agent | ≤ 2s (ack), không tính thời gian chạy job |
| NFR-PF-04 | Animation | ≥ 30fps, không giật khi máy tải 70% CPU |
| NFR-PF-05 | Job đơn giản (tạo 1 task) end-to-end | Trung vị ≤ 30s |

### 11.2. Độ tin cậy

| ID | Yêu cầu |
| --- | --- |
| NFR-RL-01 | App crash → job đang chạy khôi phục trạng thái từ ledger khi mở lại: hoặc resume an toàn hoặc chuyển `failed` kèm phần đã làm; KHÔNG bao giờ "mất tích" job. |
| NFR-RL-02 | Mất mạng giữa job → retry theo FR-AG-08; hết retry → `failed` sạch sẽ theo FR-AG-07. |
| NFR-RL-03 | Ghi ledger là điều kiện tiên quyết của tool call: không ghi được ledger → không thực thi thao tác (fail-closed). |
| NFR-RL-04 | Pet chạy liên tục 8 giờ không crash, không rò rỉ bộ nhớ (kiểm bằng soak test). |

### 11.3. Bảo mật &amp; riêng tư

| ID | Yêu cầu |
| --- | --- |
| NFR-SEC-01 | Token OAuth lưu trong secure storage của OS (Keychain/Credential Manager), không lưu plaintext. |
| NFR-SEC-02 | Dữ liệu gửi tới LLM provider: chỉ nội dung cần cho job (lệnh, ảnh đính kèm, dữ liệu Notion liên quan); công bố rõ trong chính sách dữ liệu hiển thị lúc onboarding. |
| NFR-SEC-03 | Ledger và lịch sử hội thoại lưu cục bộ trên máy người dùng `[Đề xuất: local-first cho MVP; đồng bộ cloud là quyết định Phase sau]`. |
| NFR-SEC-04 | Ảnh chụp màn hình người dùng gửi vào: xóa khỏi bộ nhớ tạm sau khi job kết thúc; bản lưu trong ledger tuân theo chính sách lưu trữ FR-LG-07. |
| NFR-SEC-05 | Lớp hook phê duyệt phải nằm ngoài vòng kiểm soát của LLM (thực thi ở tầng ứng dụng), để prompt injection không vô hiệu hóa được nó. |

### 11.4. Khả dụng &amp; tương thích

| ID | Yêu cầu |
| --- | --- |
| NFR-CP-01 | Windows 10+ và macOS 13+ `[Đề xuất]`; hành vi always-on-top và tray nhất quán giữa hai OS. |
| NFR-CP-02 | Hỗ trợ đa màn hình: pet giữ đúng vị trí tương đối; không "lạc" khi tháo màn hình phụ. |
| NFR-CP-03 | Giao diện đa ngôn ngữ (ĐÃ CHỐT — OQ-5): **tiếng Việt + tiếng Anh**, chuyển đổi trong Cài đặt, mặc định theo ngôn ngữ hệ điều hành `[Đề xuất]`. Mọi chuỗi UI đi qua tầng i18n từ đầu (không hardcode). Văn bản do pet-agent sinh (ô thoại, thông báo, hỏi đáp) theo ngôn ngữ người dùng đang dùng trong hội thoại `[Đề xuất]`; persona spec phải định nghĩa giọng văn cho CẢ HAI ngôn ngữ. |

### 11.5. Backend

| ID | Yêu cầu | Ngưỡng `[Đề xuất, hiệu chỉnh theo quy mô beta]` |
| --- | --- | --- |
| NFR-BE-01 | Độ sẵn sàng trong giai đoạn beta | ≥ 99.5% uptime tháng; có status page |
| NFR-BE-02 | ~~Overhead LLM gateway~~ — không còn áp dụng (ADR-007: không có gateway) | — |
| NFR-BE-03 | Secrets phía server (client_secret của Notion/Google cho OAuth broker) lưu trong secret manager; không xuất hiện trong repo, binary, log; có quy trình xoay vòng key. LLM key KHÔNG tồn tại phía server (ADR-007) | Bắt buộc |
| NFR-BE-04 | Backup database hằng ngày, kiểm chứng khôi phục được | Retention 30 ngày |
| NFR-BE-05 | Dữ liệu backend không bao giờ chứa: nội dung lệnh của người dùng, dữ liệu Notion, ảnh, ledger — các dữ liệu đó chỉ tồn tại trên máy client | Bắt buộc; kiểm bằng review schema + audit log |
| NFR-BE-06 | ~~Log payload LLM~~ — không còn áp dụng: hội thoại LLM không đi qua server (ADR-007) | — |
| NFR-BE-07 | Chịu tải đồng thời tối thiểu bằng 2× quy mô closed beta dự kiến cho các endpoint auth + OAuth broker (kiểm bằng load test trước phát hành) | Theo OQ-8 |

---

## 12. MÔ HÌNH DỮ LIỆU (mức khái niệm)

Các thực thể chính và quan hệ; chi tiết schema thuộc tài liệu kỹ thuật.

### 12.1. Dữ liệu phía client (local-first)

```
User ─┬─ ConnectorAccount (Notion OAuth, workspace, default database)
      ├─ ApprovalConfig (mode: off|smart|on)
      │     └─ ApprovalRule (mô tả NL, bản biên dịch: điều kiện→chặn,
      │                      trạng thái: draft|confirmed, kết quả test)
      ├─ Conversation (các lượt trao đổi với pet-agent)
      └─ Job
            ├─ thuộc tính: id, yêu cầu gốc (text + ảnh), trạng thái,
            │   mode phê duyệt tại thời điểm tạo, timestamps, kết quả nén
            ├─ ActionRecord[] (ledger, append-only)
            │     └─ thuộc tính: seq, loại, tool, tham số, kết quả,
            │         snapshot_trước, snapshot_sau, reversible: bool,
            │         compensating_action (nullable), timestamp
            ├─ ApprovalRequest[] (thao tác chờ duyệt, quyết định, người quyết)
            └─ undo_of: Job.id (nullable — job này là undo của job nào)
```

Ràng buộc quan trọng:

- `ActionRecord` bất biến sau khi ghi (FR-LG-02).
- `Job.undo_of` tạo chuỗi truy vết: job gốc ↔ job undo.
- `ApprovalRule` chỉ tham gia hook khi `confirmed`.

### 12.2. Dữ liệu phía backend

```
Account (google_sub, email, trạng thái)
   ├─ Device (device_id, tên máy, lần hoạt động cuối)
   └─ Session (refresh_token_hash, hạn, thiết bị phát hành)
InviteAllowlist (email hoặc mã invite, hạn, trạng thái, account kích hoạt)
RateLimitState (chống lạm dụng auth/broker — cache store, không cần DB)

Đã loại bỏ theo ADR-007/008: UsageRecord, TelemetryEvent, ModelRouteConfig
(model routing giờ là cấu hình client — FR-AG-11).
```

Ràng buộc quan trọng phía backend:

- KHÔNG có bảng nào chứa: token connector, LLM credential, nội dung lệnh,
dữ liệu nền tảng, ảnh, ledger, hay bất kỳ nội dung hội thoại LLM nào
(NFR-BE-05, ADR-007) — backend chỉ biết danh tính và phiên, không biết
người dùng làm gì.

---

## 13. ĐẶC TẢ TÍCH HỢP CONNECTOR

### 13.1. Notion (đọc + ghi)

| Hạng mục | Nội dung |
| --- | --- |
| Xác thực | OAuth 2.0 public integration; scope tối thiểu đủ đọc/ghi database và page được người dùng cấp |
| Phạm vi truy cập | Chỉ các database/page người dùng chia sẻ cho integration khi kết nối — không mặc định toàn workspace |
| Nhóm thao tác đọc | Query database (lọc/sắp xếp), retrieve page + properties, retrieve database schema |
| Nhóm thao tác ghi | Create page (task), update page properties, archive page; di chuyển/sắp xếp thể hiện qua cập nhật thuộc tính thứ tự/trạng thái tương ứng cấu trúc database của người dùng |
| Snapshot phục vụ undo | Trước mỗi ghi: đọc trọn properties của đối tượng → lưu vào ActionRecord (FR-NT-04) |
| Bảng compensating action | create page → archive page; update properties → update về snapshot; archive → unarchive. Thao tác nào không lập được công thức ngược → irreversible (FR-NT-05) |
| Rate limit | Thiết kế hàng đợi + backoff theo giới hạn công bố của Notion; ngưỡng chính xác và hành vi burst xác nhận trong spike SP-1 |
| Lỗi cần xử lý riêng | 401 (token hết hạn → FR-NT-07), 403 (mất quyền đối tượng), 404 (đối tượng bị xóa — quan trọng với undo), 409/conflict, 429 (rate limit) |
| Giới hạn đã biết cần spike xác nhận | Mức chi tiết của properties đọc được trước khi ghi; khả năng khôi phục page đã archive; hành vi với database có schema tuỳ biến lạ |

Lưu ý phát hành: public integration của Notion phải qua vòng security
review của Notion trước khi publish rộng rãi — đưa vào track xét duyệt
(mục 13.4).

### 13.2. Gmail (chỉ đọc)

| Hạng mục | Nội dung |
| --- | --- |
| Xác thực | OAuth 2.0 (Google Identity); ủy quyền từng người dùng qua consent screen |
| Scope | Scope đọc tối thiểu đủ cho liệt kê/tìm/đọc message — thuộc nhóm **restricted** của Google (mục 13.4) |
| Nhóm thao tác | Tìm kiếm theo truy vấn (from/subject/nhãn/thời gian), đọc message (headers + body), đọc danh sách nhãn |
| Không có ở MVP | Gửi, trả lời, sửa, xóa, gắn nhãn, đọc đính kèm nặng `[Đề xuất: đính kèm để Phase sau]` |
| Undo | Không áp dụng (không thao tác ghi) |
| Tuân thủ | Disclosure Limited Use trong onboarding; dữ liệu email không index nền, chỉ vào ngữ cảnh job khi cần (FR-GM-03) |
| Lỗi cần xử lý riêng | 401 (re-consent), 403 (thiếu scope/bị thu hồi), 429 (quota), token refresh hết hạn ở trạng thái app chưa verified (xem 13.4) |

### 13.3. Google Drive (chỉ đọc)

| Hạng mục | Nội dung |
| --- | --- |
| Xác thực | OAuth 2.0 (Google Identity), cùng consent với Gmail hoặc tách riêng theo FR-CF-04 |
| Scope | Theo quyết định OQ-14: `drive.file` + picker (nhóm không cần verification) HOẶC scope đọc rộng (nhóm restricted) |
| Nhóm thao tác | Tìm file theo tên/loại/thời gian, đọc metadata, đọc nội dung: Google Docs/Sheets/Slides qua export, PDF/text/ảnh tải trực tiếp |
| Không có ở MVP | Tạo, sửa, xóa, di chuyển, chia sẻ, đổi quyền |
| Undo | Không áp dụng (không thao tác ghi) |
| Lỗi cần xử lý riêng | File quá lớn (giới hạn kích thước đọc `[Đề xuất: 20MB]`), định dạng không hỗ trợ (báo rõ trong kết quả job), 403/404 khi file bị đổi quyền hoặc xóa |

### 13.4. ~~Outlook / Microsoft 365~~ — ĐÃ LOẠI BỎ (v2.1)

Connector Outlook/Microsoft 365 bị loại khỏi phạm vi sản phẩm theo quyết
định của product owner ngày 11/09/2026 (xem Nhật ký thay đổi). Số mục được
giữ nguyên để mọi tham chiếu chéo trong tài liệu không bị lệch.

**Hệ quả phải mang theo:** Outlook từng là đường email DUY NHẤT chạy được
một-click mà không cần CASA. Sau khi loại, Gmail qua BYO OAuth client
(FR-CF-11) là đường email duy nhất của sản phẩm — mọi người dùng đều phải
tự tạo Google Cloud project và chịu hạn refresh token 7 ngày ở trạng thái
Testing. Xem R-12 (đã tái định khung) và mục 13.6.

### 13.5. Yêu cầu xét duyệt OAuth theo nền tảng (track song song bắt buộc)

| Nền tảng | Cơ chế ủy quyền | Cấp xét duyệt | Hệ quả kế hoạch |
| --- | --- | --- | --- |
| Notion | OAuth 2.0 public integration; người dùng chọn trang/database cấp quyền ngay trong luồng auth | Security review của Notion trước khi publish | Nộp sớm; trong lúc chờ, dev/alpha dùng internal integration token |
| Gmail | OAuth 2.0; consent screen của Google | Scope đọc email thuộc nhóm **restricted** → Google app verification + **CASA** (audit bên thứ ba do Google ủy quyền, khung Assurance Level: AL1 = developer test + lab review, AL2 = lab test trực tiếp; Google gán mức, không tự chọn), tái chứng nhận mỗi 12 tháng; số liệu chi tiết tại mục 13.7. App chưa verified: giới hạn 100 test user + màn hình cảnh báo + refresh token 7 ngày ở trạng thái Testing | **Track CASA HOÃN theo quyết định OQ-15** — chiến lược phát hành thay thế tại mục 13.6; kích hoạt lại theo ngưỡng ở mục 13.7 |
| Google Drive | OAuth 2.0; cùng hạ tầng consent với Gmail | `drive.file`: không cần verification; `drive.readonly`: restricted như Gmail | ĐÃ CHỐT (OQ-14): đích là `drive.readonly` gộp cùng hồ sơ CASA với Gmail; khi CASA hoãn → kênh đại trà dùng `drive.file` + picker, kênh advanced dùng `drive.readonly` (mục 13.6) |

**Kết luận vận hành (đã xác minh từ tài liệu chính thức — thay thế spike
SP-5 cũ):**

1. Google, app External ở trạng thái Testing: refresh token hết hạn sau
**7 ngày**; ủy quyền của test user cũng hết hạn 7 ngày kể từ lúc consent;
giới hạn **100 test user**. Hệ quả kế hoạch: alpha nội bộ dùng
Gmail/Drive-restricted phải chấp nhận re-consent hằng tuần; verification
phải hoàn tất TRƯỚC closed beta để token trở thành dài hạn. Sau khi loại
Outlook (v2.1), đây là ràng buộc email DUY NHẤT của sản phẩm — không còn
đường vòng nào.
2. Notion: public integration cần security review của Notion trước khi
publish; trong lúc chờ, dev/alpha dùng internal integration token.

### 13.6. Chiến lược phát hành khi HOÃN track CASA (quyết định OQ-15)

Bối cảnh: track Google verification + CASA tốn chi phí thường niên và thời
gian nhiều tuần → product owner quyết định HOÃN cho tới khi có ngân sách.
Các phương án thay thế đã được đánh giá:

| Phương án | Cách hoạt động | Độ phức tạp tích hợp | Tiện lợi cho người dùng khi kết nối | Đánh giá |
| --- | --- | --- | --- | --- |
| **A. BYO OAuth client** (mô hình đã kiểm chứng thực tế bởi gogcli — CLI Google Workspace mã nguồn mở, MIT) | Mỗi người dùng tự tạo Google Cloud project + Desktop/Web OAuth client của riêng họ, nạp client credentials vào app; app chạy OAuth với client đó. Mỗi người là developer + người dùng duy nhất của OAuth app của chính họ → KHÔNG cần verification/CASA | Trung bình-thấp với ta: connector framework thêm chế độ nạp client per-user (FR-CF-11), luồng OAuth loopback cục bộ; hướng dẫn từng bước trong app | **Kém** — ~10 bước kỹ thuật trên Google Cloud Console (tạo project, bật Gmail/Drive API, cấu hình consent screen, thêm chính mình làm test user, tạo client, tải JSON); kèm hạn refresh token 7 ngày ở trạng thái Testing → re-consent hằng tuần. Trái trực diện FR-CF-02 → chỉ phù hợp alpha nội bộ + power user | **CHỌN làm kênh advanced** — không phải kênh đại trà |
| B. Nhúng/tích hợp trực tiếp gogcli (binary + `gog mcp`, MCP server stdio read-only mặc định) | Bundle binary, gọi qua MCP làm connector Google | Trung bình: spawn process + MCP client (khớp FR-CF-09); nhưng snapshot/ledger vẫn phải tự bọc; thêm phụ thuộc binary ngoài, đồng bộ phiên bản | **Kém như A** — auth vẫn là BYO client của người dùng; không cải thiện UX kết nối | Không chọn cho MVP: không giải quyết đúng nút thắt (UX auth), trùng lặp connector framework sẵn có; giữ làm tham chiếu thiết kế |
| C. Dịch vụ OAuth trung gian đã qua CASA (shared verified app của bên thứ ba) | Người dùng auth qua OAuth app đã verified của nhà cung cấp trung gian | Thấp về kỹ thuật | **Tốt** (một-click) | Không chọn: phí theo user/tháng (vẫn là "tốn ngân sách", thường đắt hơn CASA về dài hạn) và bên thứ ba đứng giữa dòng dữ liệu email — xung đột nguyên tắc local-first/NFR-BE-05 |
| ~~**D. Phát hành đại trà KHÔNG cần restricted scope**~~ | *(v2.1 — KHÔNG CÒN KHẢ THI)* Phương án này dựa vào Outlook làm email chính. Sau khi loại Outlook, D mất chân email: kênh đại trà chỉ còn Notion + Drive `drive.file`, **không có email nào**. | — | — | **Không còn áp dụng** — kênh đại trà cho người dùng phổ thông hiện KHÔNG có đường email cho tới khi kích hoạt CASA (mục 13.7) |

**Quyết định tổng hợp (thay OQ-15 — cập nhật v1.7):**

1. **Giai đoạn hiện tại: phương án A (BYO OAuth client) là KÊNH CHÍNH cho
các connector Google** (Gmail chỉ đọc + `drive.readonly`). Cơ sở quyết
định: người dùng giai đoạn đầu là chính product owner và nhóm nhỏ có
kiến thức kỹ thuật — chấp nhận các bước thiết lập phức tạp hơn để đổi
lấy đầy đủ năng lực (agent tự tìm toàn Drive, đọc Gmail) với chi phí
xét duyệt bằng 0. App cung cấp hướng dẫn thiết lập từng bước trong
luồng kết nối (FR-CF-11). Lưu ý vận hành: OAuth client External ở trạng
thái Testing chịu hạn refresh token 7 ngày → re-consent hằng tuần; nếu
tài khoản thuộc Google Workspace, đặt user type Internal để miễn cả
verification lẫn hạn 7 ngày.
2. Notion vẫn dùng OAuth client trung tâm của app (một-click, không
CASA) — chuẩn UX FR-CF-02 giữ nguyên cho connector này.
3. **(v2.1 — thay cho phương án D)** Sau khi loại Outlook, KHÔNG còn kênh
email một-click nào. Mở rộng ra người dùng phổ thông không rành kỹ
thuật đòi hỏi hoàn tất track Google verification + CASA — đây giờ là
điều kiện BẮT BUỘC, không còn là lựa chọn tối ưu hoá. Ngưỡng kích hoạt
tại mục 13.7 vì vậy được siết lại tương ứng.
4. Track Google verification + CASA **tạm hoãn — kích hoạt khi mở đại trà
Gmail/`drive.readonly` cho người dùng phổ thông và có ngân sách**; khi
hoàn tất, hai connector này chuyển sang OAuth client trung tâm một-click,
BYO-client vẫn giữ như lựa chọn tự chủ cho ai muốn.

### 13.7. Số liệu chi phí &amp; thời gian track CASA (đã tra cứu, làm căn cứ kích hoạt)

Khung hiện hành: CASA vận hành theo **Assurance Level** (AL0 tự đánh giá
không cấp chứng nhận; **AL1** = developer test + lab review, tương đương
Tier 2 cũ; **AL2** = lab test trực tiếp, tương đương Tier 3). **Google gán
mức, không tự chọn**, dựa trên độ nhạy dữ liệu + số người dùng, và mức đã
gán có tính "dính" qua các năm. Tier 2 self-scan miễn phí đã bị loại bỏ —
mọi app restricted scope đều phải trả phí assessor độc lập.

**Chi phí tiền mặt (giá công bố):**

| Lab | AL1 / Tier 2 | AL2 / Tier 3 |
| --- | --- | --- |
| TAC Security (giá Google đàm phán; Google chỉ định hướng dev tới TAC cho Tier 2) | $540 basic; **$720 Premium (khuyến nghị — rescan không giới hạn)**; $1.800 Enterprise | ~$4.500/app |
| NetSentries | $900–1.500 | — |
| NCC Group | từ $1.200 | từ $7.000 |
| Bishop Fox | từ $1.500 | từ $8.000 |

Dự báo cho app này: **AL1 với xác suất cao** (user base nhỏ, local-first,
backend không chạm dữ liệu Google, không lên Marketplace) → ngân sách
**$720/năm (~19 triệu VND/năm theo tỷ giá tham khảo ~26.000, cần kiểm tra
lại khi chi)**; kịch bản xấu bị gán AL2: $4.500/năm. Kiểm soát rủi ro AL2
bằng scope profile theo kênh (FR-CF-04): kênh đại trà chỉ dùng bộ scope hẹp.

**Công sức `[ước lượng]`:** năm đầu ~56–120 giờ (hồ sơ + privacy policy +
homepage verified domain + demo video ~16–30h; hardening ASVS + scan theo
config/Docker image chính thức của ADA ~24–50h; remediation ~16–40h). Tái
chứng nhận hằng năm ~16–40 giờ — là bài test toàn diện lại bất kể có thay
đổi hay không, và tiêu chí recert ngặt hơn (cấm cả finding CWE mức
medium-likelihood, năm đầu chỉ cấm high).

**Thời gian:** lab AL1 ~1–3 tuần, AL2 ~2–4 tuần kể từ khi đủ hồ sơ; tổng
thực tế gồm chuẩn bị + remediation + vòng xét OAuth verification của Google:
**8–20 tuần** — dự trù vài tháng.

**Điểm phải hỏi lab trước khi ký (chưa có tiền lệ công bố):** app là desktop
local-first, backend mỏng không chứa dữ liệu Google — đối tượng DAST scan
của AL1 là gì (backend hay binary desktop)? Câu trả lời quyết định scope và
chi phí thực.

**Ngưỡng kích hoạt track:** người dùng đầu tiên KHÔNG có nền kỹ thuật cần
Gmail/`drive.readonly` (không đi được kênh BYO-client). Hai việc làm ngay từ
bây giờ để giảm công sức khi kích hoạt: thiết kế theo ASVS từ đầu (trùng
phần lớn NFR-SEC hiện có) và dựng sẵn privacy policy + homepage có domain
đã verify (điều kiện của OAuth verification, không riêng CASA).

---

## 14. KIẾN TRÚC HỆ THỐNG &amp; TECHNOLOGY STACK

### 14.1. Sơ đồ khối

```
┌──────────────────────────── Desktop App ────────────────────────────┐
│                                                                     │
│  ┌───────────┐    ┌──────────────┐     ┌───────────────────────┐    │
│  │ Pet Layer │◄──►│  Pet-Agent   │────►│      Job Manager      │    │
│  │ (render + │    │ (persona +   │     │ (queue, vòng đời,     │    │
│  │  ô thoại) │    │  tools tạo   │     │  cancel, timeout)     │    │
│  └───────────┘    │  job — QĐ-1) │     └──────────┬────────────┘    │
│                   └──────────────┘                │                 │
│  ┌───────────┐                          ┌─────────▼────────────┐    │
│  │ App Window│◄────────────────────────►│    Worker-Agent(s)   │    │
│  │ (jobs,    │                          │ (harness: prompt +   │    │
│  │  ledger,  │                          │  tools + hooks +     │    │
│  │  approval)│                          │  nghĩa vụ ledger)    │    │
│  └───────────┘                          └───┬─────────────┬────┘    │
│                                             │             │         │
│                             ┌───────────────▼──┐   ┌──────▼──────┐  │
│                             │  Approval Hooks  │   │   Notion    │  │
│                             │ (chặn cứng ngoài │   │  Connector  │  │
│                             │  vòng LLM —      │   │ (snapshot + │  │
│                             │  NFR-SEC-05)     │   │  rate queue)│  │
│                             └──────────────────┘   └──────┬──────┘  │
│  ┌──────────────────────────────────────────────┐         │         │
│  │  Local Store: Jobs, Ledger, Rules, Config    │         │         │
│  └──────────────────────────────────────────────┘         │         │
└───────────────────────────────────────────────────────────┼─────────┘
                    │ LLM API (pet-agent, worker-agent,     │ Notion API
                    ▼ bộ biên dịch quy tắc)                 ▼
```

Nguyên tắc kiến trúc rút từ các QĐ:

- Pet-agent và worker-agent là các agent tách biệt, giao tiếp qua Job
Manager — không có orchestrator tập trung (QĐ-1).
- Approval Hooks thực thi ở tầng ứng dụng, đứng GIỮA worker-agent và
connector — LLM không thể bỏ qua (QĐ-2, NFR-SEC-05).
- Connector chịu trách nhiệm snapshot trước ghi — undo là năng lực của tầng
connector + ledger, không phụ thuộc "thiện chí" của agent (QĐ-2).

### 14.2. Technology stack — **ĐÃ CHỐT** (product owner quyết định, ghi nhận ADR-001..009)

| ADR | Tầng | Quyết định | Ghi chú triển khai |
| --- | --- | --- | --- |
| ADR-001 | Khung app desktop | **Electron** | 2 cửa sổ: pet (trong suốt, frameless, always-on-top, click-through từng phần) + cửa sổ app; agent runtime ở main/utility process. SP-3 đổi tính chất thành spike KIỂM CHỨNG (Electron + Rive đạt yêu cầu trên 2 OS), không còn là spike lựa chọn |
| ADR-002 | Engine render &amp; animation pet | **Rive** | State machine của Rive ánh xạ 1:1 với 5 trạng thái pet (FR-PET-02); designer làm việc độc lập với dev; đường lui: thay engine trong cửa sổ pet không đụng phần còn lại |
| ADR-003 | Frontend (cửa sổ app + ô thoại) | **React + TypeScript + Tailwind CSS** | — |
| ADR-004 | Agent harness | **pi agents (pi.dev) — nhúng qua SDK, mở rộng bằng TypeScript extensions** | pi cung cấp vòng agentic, tool registry, session JSONL, provider layer, skills; ta xây trên nền đó: tool sinh từ connector manifest, MỌI tool được wrap hook + ledger trước execute (FR-AG-02); tool coding mặc định của pi không đăng ký cho worker-agent |
| ADR-005 | Backend | **Node.js + Fastify + TypeScript + PostgreSQL** | Shared types với client qua monorepo; phạm vi backend thu gọn theo ADR-006/007/008 |
| ADR-006 | Xác thực người dùng | **Google Sign-In** | Backend verify ID token → phát JWT của app; closed beta gate bằng allowlist `[Đề xuất]` |
| ADR-007 | LLM provider | **KHÔNG có LLM gateway — cấu hình provider phía client theo cơ chế providers của pi** | Subscription /login, API key, hoặc custom provider; credential trong secure storage OS; ánh xạ vai trò → model là cấu hình client (FR-AG-11); bảo đảm đa dạng provider; người dùng tự chịu chi phí provider của mình |
| ADR-008 | Quan sát &amp; telemetry sản phẩm | **HOÃN — chưa implement giai đoạn này** | Backend vẫn có log/error tracking vận hành tối thiểu (FR-BE-11); metrics mục 5 đo bằng khảo sát/phỏng vấn/log tự nguyện |
| ADR-009 | Monorepo, đóng gói, native | **pnpm workspaces + Turborepo; electron-builder + electron-updater; code signing (Apple notarization + Windows cert); native module escape hatch bằng Rust (napi-rs)** | Rust không phải khung app mà là lối thoát cho thao tác OS sâu — xem ghi chú dưới bảng |
| — | Local store (client) | **SQLite (better-sqlite3)** | Ledger append-only + jobs + config, local-first (NFR-SEC-03) |

**Về vai trò của Rust trong kiến trúc Electron:** Electron main process
(Node.js) đã phủ phần lớn tương tác OS mà MVP cần — cửa sổ trong suốt
always-on-top, tray, global shortcut, notification, clipboard, đa màn hình.
Khi cần chạm OS sâu hơn mức Electron API cung cấp, chuẩn mở rộng là **native
module nạp vào Node**, viết bằng Rust qua napi-rs (hoặc Swift/Obj-C cho API
riêng của macOS): ví dụ click-through theo từng pixel của pet, thao tác
focus đặc thù, và nhất là **thu âm thanh hệ thống ở Phase 3** — gần như chắc
chắn cần native code, đặc biệt trên macOS. Nguyên tắc: Rust là công cụ điểm
(targeted) dùng khi có nhu cầu cụ thể, không phải nền tảng của ứng dụng.

### 14.3. Backend service

#### 14.3.1. Sơ đồ khối

```
┌─────────────┐        ┌──────────────────── Backend ────────────────────┐
│  Desktop    │  TLS   │                                                 │
│  Client     │◄──────►│  ┌────────────┐  ┌──────────────┐               │
│             │        │  │ Auth       │  │ OAuth Broker │──► Notion     │
│ (agents,    │        │  │ (JWT,      │  │ (exchange,   │    (token     │
│  hooks,     │        │  │  invite,   │  │  không lưu   │     endpoint) │
│  ledger —   │        │  │  devices)  │  │  token)      │               │
│  local)     │        │  └────────────┘  └──────────────┘               │
│  (LLM đi   │        │   (KHÔNG có LLM gateway — ADR-007: client gọi   │
│   thẳng     │        │    thẳng provider qua lớp providers của pi)     │
│   provider) │        │                                                 │
│             │        │  ┌────────────┐  ┌──────────────┐               │
│             │        │  │ Telemetry  │  │ Version /    │               │
│             │        │  │ Ingest     │  │ Update       │               │
│             │        │  └────────────┘  └──────────────┘               │
│             │        │        │                │                       │
│             │        │  ┌─────▼────────────────▼─────┐  ┌───────────┐  │
│             │        │  │ Database (Postgres)        │  │ Secret    │  │
│             │        │  │ + cache cho rate limit     │  │ Manager   │  │
│             │        │  └────────────────────────────┘  └───────────┘  │
└─────────────┘        └─────────────────────────────────────────────────┘
```

#### 14.3.2. API surface (v1) `[Đề xuất — chi tiết request/response thuộc tài liệu kỹ thuật]`

| Endpoint | Method | Mô tả | Xác thực |
| --- | --- | --- | --- |
| /v1/auth/google | POST | Nhận Google ID token từ client, verify, đối chiếu allowlist closed beta, trả access + refresh token của app | Public |
| /v1/auth/refresh | POST | Gia hạn phiên | Refresh token |
| /v1/auth/logout | POST | Thu hồi refresh token | JWT |
| /v1/oauth/{provider}/authorize-url | GET | Cấp authorize URL + state cho provider (notion, google...) | JWT |
| /v1/oauth/{provider}/exchange | POST | Đổi authorization code lấy token của provider, trả về client (broker tổng quát — FR-CF-03) | JWT |
| /v1/oauth/{provider}/refresh | POST | Refresh token qua broker khi provider yêu cầu client_secret | JWT |

| /v1/app/version | GET | Manifest phiên bản mới nhất | Public |
| /v1/health | GET | Health check | Public |

#### 14.3.3. Stack đề xuất `[Đề xuất]`

| Tầng | Phương án | Ghi chú |
| --- | --- | --- |
| Runtime | Container hoặc serverless đều đáp ứng được; ưu tiên phương án đội dev vận hành quen | LLM Gateway cần hỗ trợ streaming response tốt |
| Database | PostgreSQL (managed) | Đủ cho toàn bộ mô hình 12.2 |
| Cache | Redis hoặc tương đương cho rate limit state | Có thể gộp vào DB ở quy mô beta |
| Secrets | Secret manager của nhà cung cấp hạ tầng | NFR-BE-03 |
| Quan sát | Log tập trung + error tracking cho backend (telemetry sản phẩm HOÃN theo ADR-008) | FR-BE-11 |

#### 14.3.4. Nguyên tắc phân giới client ↔ backend

1. **Backend là dịch vụ production đầy đủ** về xác thực, dữ liệu, vận hành,
bảo mật — được kiểm thử và giám sát như mọi service nghiêm túc.
2. **Backend không thực thi logic nghiệp vụ của job:** agent, hooks, ledger,
undo chạy ở client. Đây là ranh giới thiết kế (giữ local-first và giữ
hooks sát tool call), không phải xếp hạng tầm quan trọng.
3. **Backend không thấy nội dung công việc của người dùng** (NFR-BE-05):
sau ADR-007, backend chỉ biết "ai đăng nhập, kết nối gì" — hội thoại LLM
và chi phí thuộc quan hệ trực tiếp người dùng ↔ provider.
4. Ranh giới này sẽ được xét lại ở Phase 2 nếu chọn hướng scheduler chạy
server-side (job chạy khi máy người dùng tắt) — khi đó cần quyết định lại
OQ-9 về nơi giữ Notion token.

---

## 15. PHỤ THUỘC GIỮA TÍNH NĂNG &amp; LỘ TRÌNH MILESTONES

### 15.1. Đồ thị phụ thuộc chính

```
Connector Notion (đọc/ghi + snapshot)
   ├─► Worker-agent harness ─► Job Manager ─► Pet-agent &amp; ô thoại
   ├─► Action Ledger ─► Undo bù trừ
   └─► Approval Hooks (cần cả bộ biên dịch quy tắc NL)
Pet render layer (độc lập, chạy song song từ đầu)
Cửa sổ app (phụ thuộc Job Manager + Ledger)
Backend service (độc lập với lõi client — chỉ còn auth + OAuth broker +
   version manifest; LLM không phụ thuộc backend theo ADR-007)
```

Hàm ý: **ledger và snapshot phải có TRƯỚC khi worker-agent được phép ghi
thật** — không build "agent chạy trước, log bổ sung sau".

### 15.2. Milestones `[Đề xuất — không gắn thời lượng, đội dev ước lượng]`

| Mốc | Nội dung | Điều kiện hoàn thành |
| --- | --- | --- |
| M0 — Spikes &amp; track xét duyệt | SP-1..SP-4 (mục 16 — SP-5 đã đóng bằng kết luận nghiên cứu tại 13.4–13.6); KHỞI ĐỘNG track xét duyệt còn hiệu lực: nộp Notion security review (track Google CASA HOÃN theo mục 13.6; track Microsoft đã loại cùng connector Outlook ở v2.1) | Mọi giả định kỹ thuật rủi ro có kết luận; các ADR nền tảng đã chốt; hồ sơ Notion đã nộp |
| M1 — Lõi thực thi tin cậy được | Connector + snapshot + ledger + worker-agent harness trên pi SDK + job manager (chưa có UI, điều khiển bằng CLI/dev tool; provider cấu hình theo pi — đây là thiết kế chính thức ADR-007, không còn là dev-mode) | US-2.1, US-3.1 pass ở môi trường dev; kiểm thử "không thao tác ngầm" pass; wrap hook+ledger phủ 100% tool đăng ký |
| M2 — Lớp an toàn | Approval hooks + bộ biên dịch quy tắc + undo bù trừ | US-3.2, US-4.1, US-4.2 pass; hard gate 0-lọt pass |
| M3 — Pet &amp; trải nghiệm | Pet render + pet-agent + ô thoại + thông báo | EPIC 1 pass |
| M4 — App window &amp; onboarding | FR-APP-*; luồng WF-1 trọn vẹn | EPIC 5 pass |
| M5 — Backend service (phạm vi thu gọn theo ADR-006/007/008) | Google Sign-In + allowlist, OAuth broker connector, version manifest, health/rate-limit. Build SONG SONG với M1–M4 | FR-BE mức Must pass; load test NFR-BE-07 (auth + broker) pass; secret scan sạch (NFR-BE-03); luồng đăng nhập Google → kết nối connector qua broker chạy trọn |
| M6 — Alpha nội bộ | Dùng thật 2 tuần trong team, chạy trên backend thật | Thu số liệu sơ bộ M-V*, M-T* qua khảo sát nội bộ + log cục bộ chia sẻ tự nguyện (ADR-008); sửa lỗi ưu tiên |
| M7 — Closed beta | 20–50 người dùng ngoài `[Đề xuất]` | Đo đủ bộ metrics mục 5; quyết định go/no-go mở rộng |

---

## 16. RỦI RO &amp; PHƯƠNG ÁN GIẢM THIỂU

| ID | Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- | --- |
| R-1 | Một số thao tác ghi không dựng được công thức bù trừ tĩnh hoặc snapshot không đủ chi tiết | Trung | **Spike SP-1 — Năng lực bù trừ theo nền tảng:** với TỪNG thao tác ghi trong manifest, xác định snapshot lấy được gì, công thức bù trừ tĩnh có tồn tại không, hay thuộc nhóm irreversible. Tư duy đúng: undo là SUY LUẬN thao tác ngược từ ledger (FR-UD-01), irreversible là kết quả bình thường được chấp nhận — gắn cờ, hiển thị minh bạch ở preview undo, gate bằng phê duyệt (FR-AP-05) — KHÔNG phải lý do thu hẹp phạm vi, và KHÔNG áp tư duy undo của source code |
| R-2 | Hội thoại đúc kết quy tắc hội tụ kém (hỏi lan man nhiều lượt) hoặc bản biên dịch cuối sai ý (chặn thiếu/chặn thừa) | Cao | **Spike SP-2 — Hội thoại đúc kết quy tắc:** đánh giá tổ hợp system prompt + agent + model trên kịch bản thiết lập NHIỀU LƯỢT — người dùng nói ý định thô, agent hỏi làm rõ (thời điểm? phạm vi? ngoại lệ?), đúc kết, người dùng xác nhận bản diễn giải rồi mới biên dịch thành hooks. Đo: số lượt tới khi chốt, tỉ lệ bản biên dịch đúng ý sau xác nhận. KHÔNG yêu cầu người dùng cung cấp đủ thông tin một lần hay tuân chuẩn câu từ; fail-closed khi không chắc (FR-AP-04) + test tự động (FR-AP-06) |
| R-3 | Render always-on-top ổn định trên cả 2 OS khó hơn dự kiến (đặc biệt macOS) | Trung | **Spike SP-3 — Chọn stack render theo TIỀM NĂNG CAO NHẤT:** prototype trên cả 2 OS, đánh giá theo trần khả năng — chất lượng animation (và đường lên 3D về sau), hành vi always-on-top/không cướp focus, hệ sinh thái, tốc độ phát triển. Tài nguyên máy người dùng KHÔNG phải tiêu chí chọn (NFR-PF-01 chỉ là mục tiêu mềm theo dõi). Đầu ra: ADR chốt stack |
| R-4 | Vòng hoạt động agentic không đủ tin cậy trên công việc thật → job sai nhiều, người dùng mất niềm tin sớm | Trung | **Spike SP-4 — Đánh giá VÒNG HOẠT ĐỘNG AGENT, không phải oneshot LLM call (FR-AG-10):** bộ kịch bản end-to-end chạy trong harness đầy đủ (skills, rules, hooks, `ask_user` đa lượt, tự kiểm chứng trước khi báo xong); đo tỉ lệ hoàn thành đúng CẢ QUÁ TRÌNH — cho phép agent hỏi lại và lặp; kết quả spike quyết định cấu trúc skills/rules ban đầu của harness, không dùng để đòi hỏi người dùng chuẩn hoá đầu vào |
| — | (SP-5 đã ĐÓNG, không cần spike) Các câu hỏi OAuth/ủy quyền/xét duyệt của Notion, Gmail, Drive đã được kết luận bằng nghiên cứu tài liệu chính thức | — | Kết luận tại mục 13.4–13.5; việc còn lại là VẬN HÀNH track xét duyệt (nộp Notion review, Google verification + CASA) từ M0 |
| R-5 | Approval làm phiền quá mức ở mode on → người dùng tắt hết kiểm soát (mode off) rồi gặp sự cố → mất niềm tin kép | Trung | Theo dõi M-T3; thiết kế smart mode làm mặc định sau tuần đầu `[Đề xuất]`; approve nhanh ngay trên ô thoại |
| R-6 | Chi phí LLM/job vượt mức chấp nhận với người dùng | Trung | Tách model theo vai trò (FR-AG-11: pet-agent dùng model nhẹ, worker dùng model mạnh); hiển thị token usage từ session pi `[Đề xuất]`; thu số liệu qua alpha nội bộ |
| R-7 | Tính cách pet gây khó chịu thay vì gắn bó | Thấp | Persona spec review sớm; A/B mức độ "nói nhiều" trong beta; luôn có nút giảm thông báo |
| R-8 | Prompt injection qua nội dung Notion/ảnh chụp khiến agent làm việc ngoài lệnh | Trung | Hooks ngoài vòng LLM (NFR-SEC-05) là tuyến phòng thủ chính; nội dung đọc từ Notion đánh dấu là dữ liệu, không phải chỉ thị, trong harness |
| R-9 | Backend sập | Thấp (đã hạ sau ADR-007) | Bán kính ảnh hưởng thu hẹp: LLM không qua backend nên job vẫn chạy với phiên đăng nhập và connector đã kết nối; chỉ chặn đăng nhập mới + kết nối connector mới. NFR-BE-01 + status page; client hiển thị SYSTEM card đúng trạng thái |
| R-10 | Lộ secrets phía server (Notion client_secret, LLM keys) | Cao | Secret manager + xoay vòng key định kỳ (NFR-BE-03); nguyên tắc quyền tối thiểu; audit log truy cập secrets; secret scan trong CI |
| R-11 | (Tái định khung sau ADR-007) Người dùng beta bất ngờ vì chi phí provider của chính mình; đội dev thiếu số liệu cost/job | Trung | Onboarding nói rõ mô hình BYO-provider và chi phí thuộc tài khoản provider của người dùng; hiển thị token usage từ session pi trong chi tiết job `[Đề xuất]`; thu số liệu cost qua phỏng vấn beta (ADR-008) |
| R-12 | **(Tái định khung v2.1 — mức tăng từ Trung lên Cao)** Sau khi loại Outlook, Gmail qua BYO OAuth client là đường email DUY NHẤT. Mọi người dùng — kể cả người không rành kỹ thuật — đều phải tự tạo Google Cloud project (~10 bước) và chịu re-consent mỗi 7 ngày ở trạng thái Testing. Kênh đại trà không có email | Cao | Chấp nhận có ý thức cho giai đoạn một người dùng (product owner tự vận hành được luồng BYO). Điều kiện thoát: hoàn tất Google verification + CASA TRƯỚC khi nhận người dùng thứ hai không có nền kỹ thuật — mục 13.7 giờ là đường găng của việc mở rộng, không còn là hạng mục tuỳ chọn. Connector framework (FR-CF-04 scope profile) cho phép chuyển sang client trung tâm chỉ bằng đổi cấu hình khi CASA xong |
| R-14 | Phụ thuộc pi agents (ADR-004) — dự án mã nguồn mở còn trẻ: breaking change giữa các phiên bản, hoặc ngừng phát triển | Trung | Pin version + khóa lockfile, nâng cấp có chủ đích theo release notes; giấy phép MIT cho phép fork khi cần; lớp bọc hook+ledger của ta nằm NGOÀI pi (wrap tool trước khi đăng ký) nên thay harness không phá QĐ-2; theo dõi upstream qua kênh chính thức |
| R-13 | Vi phạm chính sách Limited Use của Google khi đưa nội dung email vào LLM | Cao | Disclosure rõ trong onboarding (FR-GM-02), nêu rõ email đi tới provider do NGƯỜI DÙNG tự cấu hình (ADR-007); email không index nền (FR-GM-03); backend không bao giờ nhận nội dung email (NFR-BE-05); rà chính sách Google về dữ liệu người dùng với AI/LLM trong hồ sơ verification `[hạng mục bắt buộc của track xét duyệt]` |
| R-15 | Thiên lệch kiểm chứng khi người thiết kế là người dùng duy nhất: overfit vào thói quen bản thân, vô thức né các lệnh agent xử lý kém, bao dung với UX mà người khác sẽ bỏ đi | Trung | Giao thức tự kiểm chứng có cấu trúc (ghi chú mục 5); dùng sản phẩm qua ĐÚNG các luồng chính thức như người dùng thường (nguyên tắc mục 1); điều kiện thoát giai đoạn một người dùng: đưa 2–3 người tin cậy vào dùng thật với dữ liệu của họ trước khi kết luận mở rộng |

---

## 17. TIÊU CHÍ PHÁT HÀNH (RELEASE CRITERIA — closed beta)

Phát hành beta khi và chỉ khi TẤT CẢ điều sau đạt:

1. **Hard gate an toàn:** bộ test quy tắc phê duyệt đạt **0 trường hợp lọt**
(100% thao tác khớp quy tắc bị chặn trước tool call) — không thương lượng.
2. Toàn bộ FR mức Must (mục 10) pass kiểm thử chấp nhận.
3. Toàn bộ AC của EPIC 1–5 pass.
4. Kiểm thử "không thao tác ngầm" (FR-LG-05) pass trên 10 job mẫu.
5. Soak test pet 8 giờ (NFR-RL-04) pass trên cả Windows và macOS.
6. Kịch bản khôi phục sau crash (NFR-RL-01) pass.
7. Bộ 20 lệnh chuẩn đạt ngưỡng US-2.1/AC3.
8. Chính sách dữ liệu (NFR-SEC-02) hiển thị trong onboarding và được review.
9. Toàn bộ FR-BE mức Must (theo phạm vi 1.5) pass; load test auth + broker
đạt NFR-BE-07; secret scan sạch (NFR-BE-03); kiểm chứng NFR-BE-05 bằng
review schema và mẫu dữ liệu thật.
10. Kịch bản backend gián đoạn: client hiển thị đúng trạng thái, lệnh mới
được xếp hàng và tự phục hồi khi backend trở lại (theo R-9).

---

## 18. NGOÀI PHẠM VI &amp; LỘ TRÌNH SAU MVP `[Đề xuất]`

| Phase | Nội dung | Ghi chú |
| --- | --- | --- |
| Phase 2 | Phương diện 2: natural-language scheduler (tạo/quản lý lịch qua cả hai kênh theo QĐ-4); connector Gmail để hiện thực kịch bản report email | Tái dùng toàn bộ hạ tầng job/ledger/approval của MVP |
| Phase 3 | Phương diện 3: record &amp; tổng hợp họp; util buttons quanh pet | Cần spike thu âm thanh hệ thống (macOS là điểm khó) trước khi cam kết |
| Phase 4 | Xem lại QĐ-3: cho phép lai scheduler × chức năng cố định; thêm connector (Jira, **Outlook/Microsoft 365** — loại khỏi MVP ở v2.1, SharePoint, Slack); pet 3D/tuỳ biến; trí nhớ dài hạn của pet | Chỉ mở khi metrics niềm tin (M-T*) của MVP đạt |

---

## 19. CÂU HỎI MỞ (cần product owner chốt trước/không muộn hơn M1)

| ID | Câu hỏi | Chặn hạng mục |
| --- | --- | --- |
| OQ-1 | **ĐÃ CHỐT (v1.6):** hệ phê duyệt off/smart/on của riêng ứng dụng — on chặn mọi thao tác ghi; smart đánh giá hai tầng (mẫu tĩnh + LLM phụ trợ: tự duyệt / tự từ chối / đẩy lên người dùng); off vẫn giữ ledger + hardline blocklist. Đặc tả FR-AP-01, FR-AP-10..13 | — |
| OQ-2 | Xác nhận FR-AP-05: thao tác irreversible mặc định cần phê duyệt ở smart/on? | FR-AP-05, hooks |
| OQ-3 | Persona của pet: tên, tính cách, giọng văn (định nghĩa cho cả tiếng Việt và tiếng Anh — NFR-CP-03), mức độ "nói nhiều" — cần một persona spec riêng | FR-PET-10, US-1.4 |
| OQ-4 | Hình thức pet 2D: phong cách đồ hoạ, một nhân vật cố định cho MVP? | M3 |
| OQ-5 | **ĐÃ CHỐT (v1.7):** đa ngôn ngữ tiếng Việt + tiếng Anh; i18n từ đầu; persona song ngữ | NFR-CP-03 |
| OQ-6 | Ngưỡng metrics mục 5 (đang là `[Đề xuất]`): giữ hay hiệu chỉnh? | Kế hoạch đo beta |
| OQ-7 | **ĐÃ CHỐT (ADR-007):** BYO provider qua pi — người dùng tự chọn provider; chính sách dữ liệu hiển thị theo provider người dùng cấu hình (NFR-SEC-02 diễn đạt theo hướng này) | — |
| OQ-8 | Quy mô closed beta và kênh tuyển người dùng | M7, NFR-BE-07 |
| OQ-9 | Notion token: giữ nguyên client-only (đề xuất hiện tại, local-first) hay server lưu giữ — quyết định này mở/đóng đường cho scheduler server-side ở Phase 2 | FR-BE-02, Phase 2 |
| OQ-10 | **ĐÃ CHỐT (ADR-006):** Google Sign-In; closed beta gate bằng allowlist email/invite `[Đề xuất cần xác nhận cách gate]` | FR-BE-01 |
| OQ-11 | Nhà cung cấp hạ tầng backend + region lưu trữ dữ liệu (ràng buộc pháp lý dữ liệu người dùng nếu có) | 14.3, NFR-BE |
| OQ-12 | **ĐÓNG (ADR-007):** không còn budget cap phía server — chi phí thuộc provider account của người dùng | — |
| OQ-13 | **ĐÃ THAY THẾ (v2.1):** quyết định cũ (email gồm CẢ Gmail và Outlook) bị huỷ. Email của MVP chỉ còn **Gmail**, đi track BYO OAuth client; Outlook loại khỏi phạm vi. Hệ quả tại mục 13.4, 13.6 và R-12 | — |
| OQ-14 | **ĐÃ CHỐT (v1.6):** gộp — đích là `drive.readonly` chung hồ sơ CASA với Gmail; trong thời gian hoãn CASA: đại trà dùng `drive.file` + picker, advanced dùng `drive.readonly` qua BYO-client | FR-DR-02, mục 13.6 |
| OQ-15 | **ĐÃ CHỐT (v1.6), CẬP NHẬT (v2.1):** HOÃN track CASA vì ngân sách; kênh advanced = BYO OAuth client cho Gmail + `drive.readonly`. Sau khi loại Outlook, phương án đại trà một-click không còn tồn tại (mục 13.6) → CASA chuyển thành điều kiện BẮT BUỘC để mở rộng người dùng, không còn là lựa chọn | Mục 13.6, 13.7, R-12 |

---

## 20. NHẬT KÝ THAY ĐỔI

Bắt buộc theo quy ước đóng băng ở đầu tài liệu: mọi thay đổi sau 09/09/2026
phải ghi lại và được product owner phê duyệt.

### v2.2 — 12/09/2026 — Dữ liệu thuộc về tài khoản, không thuộc về máy

**Người quyết định:** product owner.
**Lý do nêu ra:** dùng trên máy nào cũng phải có cùng dữ liệu, cấu hình và lịch
sử; đăng nhập là đủ, người dùng KHÔNG phải mang theo bất cứ thứ gì (mật khẩu
phụ, file khoá, hay máy cũ) từ máy này sang máy khác.

**Thay đổi:**

| Hạng mục | Trước | Sau |
| --- | --- | --- |
| Vị trí dữ liệu | Local-first, gắn với từng máy (mục 1, NFR-SEC-03) | Thuộc về tài khoản; job, ledger, rule, cấu hình và uỷ quyền connector đồng bộ tới mọi máy đã đăng nhập |
| Vai trò backend | Chỉ xác thực, OAuth broker, update manifest; KHÔNG thấy nội dung công việc | Thêm kho đồng bộ mã hoá khi lưu và sổ đăng ký thiết bị; khoá do dịch vụ quản lý nên ranh giới riêng tư là VẬN HÀNH (hạn chế quyền truy cập khoá, ghi audit), không còn là ranh giới mật mã |
| Mã hoá đầu-cuối (E2E) | — | ĐÃ CÂN NHẮC VÀ LOẠI: không thoả mãn yêu cầu khôi phục chỉ bằng đăng nhập trên máy thay thế |
| OQ-9 (token Notion client-only hay server giữ) | Còn mở | ĐÃ CHỐT: server giữ, ở dạng mã hoá khi lưu, và đi theo tài khoản |
| Chạy job đa thiết bị | — | Job gắn với máy tạo ra nó; máy khác xem trạng thái và lịch sử, không thực thi |
| Hoạt động offline | Mặc định vì local-first | Giữ nguyên: kho cục bộ vẫn là bản làm việc của mỗi máy |

**Phạm vi ghi nhận:** thân tài liệu PRD v2.1 GIỮ NGUYÊN, không viết lại. Đặc tả
có hiệu lực của thay đổi này nằm ở `docs/spec/`: hiến pháp bản 2.0.0 (nguyên tắc
VII được định nghĩa lại) và change `req-022-account-sync`. Khi PRD và `docs/spec/`
mâu thuẫn về vị trí dữ liệu, `docs/spec/` là nguồn đúng.

---

### v2.1 — 11/09/2026 — Loại bỏ connector Outlook / Microsoft 365

**Người quyết định:** product owner.
**Lý do nêu ra:** đã có Gmail nên không cần thêm đường email thứ hai.

**Thay đổi:**

| Hạng mục | Trước | Sau |
| --- | --- | --- |
| Số connector MVP | 4 (Notion, Gmail, Outlook, Drive) | 3 (Notion, Gmail, Drive) |
| S-M5c | Connector Outlook | Xoá |
| FR-OL-01..04 | 4 yêu cầu | Xoá |
| Mục 13.4 | Đặc tả Outlook | Đánh dấu ĐÃ LOẠI BỎ, giữ số mục để không lệch tham chiếu chéo |
| Mục 13.5 | Có dòng Outlook + kết luận vận hành số 2 | Xoá cả hai |
| Mục 13.6 phương án D | Kênh đại trà: Outlook + `drive.file` | Không còn khả thi — mất chân email |
| OQ-13 | Email gồm cả Gmail và Outlook | Thay thế: chỉ Gmail |
| R-12 | Mức Trung | **Mức Cao** — tái định khung |
| M0 | Nộp Notion review + Microsoft publisher verification | Chỉ còn Notion review |
| Phase 4 | — | Outlook chuyển thành connector hậu-MVP |

**Hệ quả phải mang theo — ghi lại để không bị quên khi mở rộng:**

Outlook là đường email DUY NHẤT trong thiết kế cũ chạy được một-click mà
không cần CASA. Sau khi loại:

1. Gmail qua BYO OAuth client (FR-CF-11) là đường email duy nhất của sản phẩm.
2. Mọi người dùng đều phải tự tạo Google Cloud project (~10 bước) và chịu
hạn refresh token 7 ngày ở trạng thái Testing — không còn đường vòng.
3. Kênh đại trà cho người dùng phổ thông **không có email** cho tới khi
hoàn tất Google verification + CASA. Track CASA (mục 13.7) do đó chuyển
từ hạng mục tuỳ chọn thành **đường găng của việc mở rộng người dùng**.
4. Spike SP-14 (Entra ID) bị loại khỏi kế hoạch M0.

Quyết định này phù hợp với giai đoạn hiện tại — người dùng duy nhất là
product owner, tự vận hành được luồng BYO. Rủi ro nằm ở thời điểm nhận
người dùng thứ hai không có nền kỹ thuật.

---

## PHỤ LỤC A — ĐẶC TẢ TƯƠNG TÁC PET &amp; Ô THOẠI (INTERACTION SPEC)

Phụ lục này là nguồn chuẩn cho implement lớp tương tác. Nguyên tắc bao trùm,
kế thừa từ idea brief: **ô thoại là kênh chính của mọi tương tác nhanh**;
cửa sổ app là nơi xử lý sâu. Mọi thứ làm được ở ô thoại đều làm được ở app,
nhưng ô thoại được tối ưu cho "liếc và bấm một cái".

### A.1. Mô hình khái niệm — ba lớp của pet surface

```
┌─ Pet surface ──────────────────────────────┐
│  1. Pet sprite   — nhân vật + animation    │
│     trạng thái (FR-PET-02) + badge         │
│  2. Ô thoại      — hiển thị 1 CARD hoặc    │
│     COMPOSER; neo vào pet, tự chọn hướng   │
│     mở về phía còn không gian màn hình     │
│  3. Badge        — số card đang chờ, gắn   │
│     trên pet khi ô thoại đóng/thu gọn      │
└────────────────────────────────────────────┘
```

Ô thoại KHÔNG phải một luồng chat cuộn dài. Nó là "cửa sổ nhìn vào một
thông điệp tại một thời điểm". Lịch sử hội thoại đầy đủ nằm trong cửa sổ
app (FR-APP-05). Lý do thiết kế: giữ dấu chân màn hình tối thiểu và giữ
nguyên tắc "không trở thành nguồn xao nhãng" của idea brief.

### A.2. Hệ card — anatomy chuẩn từng loại

Mọi card có phần khung chung: icon loại card, tên job rút gọn (khi liên
quan đến job), nút "Mở trong app", nút đóng/thu gọn. Phần thân theo loại:

| Loại | Mục đích | Thân card | Hành động | Blocking? | Tự ẩn |
| --- | --- | --- | --- | --- | --- |
| **ACK** | Xác nhận đã nhận lệnh / đã resume | 1 câu theo giọng persona ("Nhận rồi, để tôi lo.") | Không | Không | 5s |
| **PROGRESS** (Should) | Job chạy dài (&gt; 60s) cập nhật tiến độ | 1 dòng trạng thái hiện tại | Hủy job | Không | Thay bằng card kế tiếp của job |
| **ASK** | Agent hỏi để gỡ điểm mơ hồ (kiểu ask của Codex/Claude Code/Hermes) | Câu hỏi 1 câu; 0–4 nút option (label ≤ 30 ký tự, hover/bấm giữ xem mô tả phụ); ô nhập tự do | Chọn option / gõ trả lời / Bỏ qua &amp; hủy job / Mở trong app | CÓ — job `waiting_input` | Không; thu gọn badge sau 60s |
| **APPROVAL** | Xin phê duyệt thao tác bị hook chặn | Hành động định làm; đối tượng (tên task/database); thay đổi **trước → sau** dự kiến; quy tắc nào kích hoạt | **Approve** / **Deny** / (S) Approve cùng loại còn lại trong job / Mở trong app | CÓ — job `waiting_approval` | Không; thu gọn badge sau 60s |
| **RESULT** | Báo job xong | Tóm tắt ≤ 200 ký tự: việc gì xong + con số chính | Mở chi tiết (→ trang job trong app, nơi có Undo) | Không | 30s (10–120s cấu hình) |
| **ERROR** | Job fail / hủy giữa chừng | Lý do 1 câu + "đã làm được đến đâu" | Mở chi tiết / Đề nghị undo phần đã làm | Không (nhưng persistent) | Không; thu gọn badge |
| **SYSTEM** | Trạng thái hệ thống: mất mạng, backend gián đoạn, token connector hết hạn, lỗi LLM provider (hết hạn credential, hết quota phía provider) | Mô tả + hướng khắc phục 1 dòng | Mở app đúng mục cài đặt liên quan | Không | Không; badge tới khi hết lỗi |

Quy tắc nội dung: mọi văn bản trên card do pet-agent sinh theo persona spec
(FR-PET-10), TRỪ phần dữ liệu cứng của APPROVAL (đối tượng, trước→sau, quy
tắc) — phần đó do hệ thống render từ dữ liệu hook, agent không được diễn
đạt lại (chống việc agent "nói giảm nói tránh" thao tác nguy hiểm).

### A.3. Máy trạng thái ô thoại

```
                    click pet (queue rỗng)
        ┌──────────────────────────────────────┐
        │                                      ▼
   ┌────┴────┐   card mới tự bung        ┌──────────┐
   │ HIDDEN  │──────────────────────────►│   CARD   │◄─┐
   │ (chỉ pet│   (trừ DND / app focus)   │ (1 card) │  │ ‹ › duyệt
   │ ± badge)│                           └────┬─────┘  │ hàng đợi
   └────▲────┘        click pet (có queue)   │ ▲       │
        │      ┌─────────────────────────────┘ └───────┘
        │      │  Esc / click ngoài / hết giờ tự ẩn
        │      │  (card blocking → về badge, không mất)
        │      ▼
        │ ┌──────────┐  gửi lệnh → ACK
        └─│ COMPOSER │────────────────► CARD (ACK)
          └──────────┘
```

Quy tắc chuyển trạng thái:

1. **Card mới tự bung** khi: không bật DND, cửa sổ app không được focus
(FR-INT-16), và ô thoại đang HIDDEN hoặc đang hiển thị card ưu tiên
thấp hơn (card mới ưu tiên cao hơn được phép thay chỗ hiển thị — card cũ
về hàng đợi, không mất).
2. **Click pet:** có card chờ → mở CARD ưu tiên nhất; không có → COMPOSER.
Trong CARD luôn có nút/lối tắt "giao việc khác" chuyển sang COMPOSER.
3. **Esc / click ra ngoài:** đóng ô thoại; card blocking chưa xử lý chuyển
thành badge — không bao giờ bị hủy ngầm.
4. **Tự bung không cướp focus** (FR-INT-04): ô thoại render ở lớp không
kích hoạt; chỉ khi người dùng click vào nó thì mới nhận bàn phím. Đây là
yêu cầu cứng — vi phạm là phá vỡ lời hứa cốt lõi "không đứt mạch".

### A.4. Hàng đợi &amp; quy tắc ưu tiên

1. Thứ tự ưu tiên hiển thị: **ASK = APPROVAL (FIFO giữa chúng) &gt; ERROR &gt;
RESULT &gt; ACK/PROGRESS**. SYSTEM hiển thị dạng badge riêng biệt, chỉ tự
bung khi nó chặn hành động người dùng vừa làm (ví dụ gửi lệnh khi mất mạng).
2. **Một job — một suất hàng đợi:** card mới của một job thay card
non-blocking cũ của chính nó. Card blocking chỉ được thay khi đã có
quyết định của người dùng hoặc job bị hủy.
3. **Badge** hiển thị tổng số card chờ; phân biệt màu khi có blocking
`[Đề xuất: chi tiết màu thuộc design spec]`.
4. **Chống dội bom:** khi nhiều card cùng đến, ô thoại chỉ tự bung MỘT lần
với card ưu tiên nhất; các card sau vào thẳng hàng đợi (badge nhảy số),
không bung liên tiếp.
5. (Could) Gộp card: ≥ 3 RESULT chờ → một card gộp "3 việc đã xong" liệt kê
ngắn, bấm mở app.

### A.5. Cơ chế ASK — đặc tả tool `ask_user`

```
ask_user {
  question: string          // 1 câu hỏi duy nhất, gộp mọi ý còn thiếu
  options?: [{              // 0–4 lựa chọn nhanh
    id: string
    label: string           // ≤ 30 ký tự, hiển thị trên nút
    description?: string    // giải thích phụ, xem khi hover/bấm giữ
  }]
  allow_free_text?: bool    // mặc định true
}
→ trả về: { answer: { option_id } | { text } } sau khi người dùng phản hồi
```

Ràng buộc hành vi:

1. Gọi `ask_user` → job chuyển `waiting_input`, pet đổi animation chờ.
2. Mỗi job tối đa MỘT ASK mở tại một thời điểm; agent muốn hỏi nhiều ý phải
gộp thành một câu (nhất quán FR-AG-05). Harness từ chối call ASK thứ hai
khi call thứ nhất chưa được trả lời.
3. Câu trả lời đến từ ô thoại HOẶC cửa sổ app — hai nơi là một hàng chờ
duy nhất, xử lý nơi này thì nơi kia cập nhật realtime.
4. Ghi ledger: một bản ghi loại `decision` chứa question, options, câu trả
lời, nguồn trả lời (bubble/app), thời điểm.
5. "Bỏ qua &amp; hủy job" = hủy theo FR-AG-06 (kèm đề nghị undo phần đã làm).
6. Timeout `waiting_input` dùng chung cấu hình với phê duyệt (mặc định 30
phút): quá hạn → job tạm dừng an toàn, resume từ app, card về badge.
7. Phân giới ASK vs APPROVAL: ASK là *agent thiếu thông tin để quyết*;
APPROVAL là *agent đã quyết nhưng hook chặn lại chờ phép*. Hai cơ chế
không thay thế nhau — agent không được dùng ASK để "lách" hook, vì hook
đánh giá ở tầng tool call, sau mọi câu trả lời ASK.

### A.6. APPROVAL card — chi tiết hành vi

1. Nội dung phần dữ liệu (đối tượng, trước→sau, quy tắc kích hoạt) render
trực tiếp từ payload của hook — không qua LLM (xem A.2, chống nói giảm).
2. **Approve:** hook mở khóa đúng tool call bị chặn; job resume; card chuyển
ACK ngắn. **Deny:** worker-agent nhận tín hiệu, chọn bỏ qua thao tác hoặc
kết thúc job kèm giải thích; mọi nhánh ghi ledger (khớp FR-AP-*).
3. Nhiều APPROVAL trong một job → hiển thị tuần tự theo thứ tự phát sinh;
nút (S) "Approve các thao tác cùng loại còn lại trong job này" áp cho
các hook CÙNG quy tắc + CÙNG loại tool trong phạm vi job, ghi ledger như
một quyết định, hết hiệu lực khi job kết thúc (FR-INT-09).
4. Quyết định từ ô thoại và từ app là một — chống double-decision bằng khóa
trạng thái phía Job Manager (bên đến sau nhận thông báo "đã được xử lý").

### A.7. Quy tắc chống xao nhãng (tổng hợp, mức bắt buộc)

1. Không cướp keyboard focus khi tự bung (FR-INT-04).
2. Không âm thanh mặc định; bật được trong cài đặt (Could).
3. Animation bung/thu ngắn (≤ 250ms `[Đề xuất]`), không nhấp nháy lặp.
4. Chỉ tự bung một lần cho một đợt card (A.4.4); DND dồn tất cả về badge.
5. Kênh thông báo duy nhất khi pet hiển thị là ô thoại — không dùng OS
notification song song (tránh nhân đôi); OS notification CHỈ dùng khi
pet đang ẩn (FR-INT-14).

### A.8. Tương tác chuột &amp; bàn phím với pet

| Tương tác | Hành vi |
| --- | --- |
| Click trái pet | Theo A.3.2 (card ưu tiên nhất hoặc composer) |
| Kéo pet | Di chuyển; vị trí nhớ qua phiên (FR-PET-01); ô thoại tự đổi hướng neo theo vị trí mới |
| Click phải pet | Menu: Mở app / DND / Ẩn pet / Thoát (+ hiển thị mode phê duyệt hiện hành, bấm dẫn tới app — FR-INT-12) |
| Hover pet | (S) Tooltip 1 dòng: trạng thái + số job đang chạy |
| Double-click pet | Mở cửa sổ app `[Đề xuất]` |
| Trong composer | Enter gửi; Shift+Enter xuống dòng; Esc đóng; Ctrl/Cmd+V dán ảnh; kéo-thả file ảnh |
| Trong ASK card | Phím số 1–4 chọn option khi ô thoại ĐANG có focus (người dùng đã click vào) `[Đề xuất]` |
| Phím tắt toàn cục | (C) Mở composer từ bất kỳ đâu (FR-PET-09) |

### A.9. Đồng bộ ô thoại ↔ cửa sổ app

1. Mọi card tồn tại song song trong app: APPROVAL/ASK nằm ở hàng chờ ghim
đầu danh sách job (FR-APP-02); RESULT/ERROR nằm trong chi tiết job.
2. Xử lý ở một nơi → nơi kia cập nhật ngay; card đã xử lý rời khỏi ô
thoại/badge trong ≤ 1s.
3. App đang focus → card mới không bung ở ô thoại (FR-INT-16), pet vẫn đổi
animation để giữ tính "sống".

### A.10. Edge cases bắt buộc xử lý

| # | Tình huống | Hành vi chuẩn |
| --- | --- | --- |
| E1 | Pet nằm sát mép/góc màn hình | Ô thoại tự chọn hướng mở còn không gian; không bao giờ tràn ra ngoài vùng hiển thị |
| E2 | Đa màn hình, tháo màn hình đang chứa pet | Pet + ô thoại di chuyển về màn hình chính, giữ nguyên trạng thái card |
| E3 | Người dùng ẩn pet khi còn card chờ | Card blocking + ERROR đẩy qua OS notification (FR-INT-14); mở lại pet → hàng đợi còn nguyên |
| E4 | Job bị hủy khi ASK/APPROVAL đang hiển thị | Card tự rút khỏi ô thoại và app; ledger ghi hủy |
| E5 | Crash giữa lúc có card blocking | Khởi động lại: dựng lại hàng đợi từ job state + ledger (FR-INT-15); job vẫn ở waiting_* |
| E6 | Ứng dụng fullscreen (họp, trình chiếu) | Mặc định: vẫn hiển thị theo quy tắc thường; (C) tùy chọn auto-DND khi phát hiện fullscreen `[Đề xuất]` |
| E7 | Hai nơi cùng bấm quyết định một card | Khóa trạng thái Job Manager; bên sau nhận "đã xử lý" (A.6.4) |
| E8 | Gửi lệnh khi backend gián đoạn | Composer vẫn nhận; lệnh vào hàng chờ cục bộ; SYSTEM card báo trạng thái; tự gửi lại khi backend trở lại (khớp R-9, release criteria #10) |
| E9 | ASK có options nhưng người dùng gõ tự do mâu thuẫn với mọi option | Câu trả lời tự do là nguồn chuẩn; agent xử lý như ngữ cảnh mới, được phép hỏi lại MỘT lần nếu vẫn mơ hồ |
| E10 | Card RESULT tự ẩn trước khi người dùng kịp đọc | Không mất: nằm trong danh sách job của app; badge không đếm RESULT đã tự ẩn `[Đề xuất]` |