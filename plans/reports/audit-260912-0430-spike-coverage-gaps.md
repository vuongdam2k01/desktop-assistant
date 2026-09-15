# RÀ SOÁT ĐỘ PHỦ SPIKE M0 — Desktop Assistant

| | |
| --- | --- |
| Ngày | 12/09/2026 |
| Phạm vi | 17 spike hiện có đối chiếu với toàn bộ yêu cầu PRD v2.1 |
| Phương pháp | Đối chiếu cơ học 126 ID yêu cầu, sau đó phân định "kiểm chứng thật" với "chỉ nhắc tên" |
| Kết luận ngắn | Nhánh agent và dữ liệu phủ tốt. **Ba mảng lớn chưa có spike nào**, trong đó một mảng là claim kiến trúc trung tâm của sản phẩm |

---

## 1. SỐ LIỆU

| Chỉ số | Giá trị |
| --- | --- |
| ID yêu cầu trong PRD | 126 |
| ID được spike nhắc tới | 52 |
| ID không spike nào nhắc | 74 |
| Trong số 74, đã chết (ĐÃ LOẠI BỎ / HOÃN) | 7 |
| **Lỗ hổng thật cần xét** | **67** |

Cảnh báo về cách đọc: "được nhắc tới" không đồng nghĩa "đã kiểm chứng". Ví dụ
FR-CF-01 (connector manifest) xuất hiện trong report SP-1 và SP-9, nhưng chỉ ở
dạng *"dữ liệu này là đầu vào cho manifest"* — chưa ai viết một manifest thật.
Độ phủ thực tế thấp hơn 52/126.

Và không phải 67 mục đều cần spike. Spike tồn tại để khử rủi ro của **giả định
mà nếu sai thì sửa rất đắt**, không phải để phủ mọi dòng yêu cầu. Phần dưới
phân loại theo mức độ đắt khi sai.

---

## 2. LỖ HỔNG MỨC ĐỎ — claim kiến trúc trung tâm chưa kiểm chứng

### 2.1. FR-CF-06 — sinh tool động từ manifest: KHÔNG SPIKE NÀO

Đây là lỗ hổng nghiêm trọng nhất của toàn bộ M0.

PRD §10.10 đặt nguyên tắc: *"connector là dữ liệu + adapter, không phải code
đặc thù rải trong lõi. Thêm nền tảng thứ N (mục tiêu: hàng chục đến hàng trăm)
= viết một manifest + một adapter, không sửa Job Manager, hooks, ledger hay UI."*

S-M5 xếp connector framework vào nhóm Must have, và §1 lấy chính nó làm lý do
biện minh cho phạm vi MVP.

Thực tế đã chạy:

| Spike | Cách gọi tool |
| --- | --- |
| SP-1 | Gọi thẳng Notion API bằng script viết tay |
| SP-8 | `src/agent/mock-tools.ts` — tool giả, một hình dạng duy nhất |
| SP-9, SP-15 | Dùng lại lối gọi tay của SP-1 |

**Chưa ai viết một manifest rồi sinh tool từ nó.** Nghĩa là mệnh đề trung tâm
"thêm connector không phải sửa lõi" đang là niềm tin, không phải kết quả.

Hậu quả nếu sai: toàn bộ FR-CF-01..10 phải thiết kế lại, kéo theo Job Manager,
lớp hook và ledger. Đây đúng là loại rủi ro mà M0 sinh ra để bắt, và M0 sắp
kết thúc mà chưa chạm tới.

### 2.2. FR-CF-07 — hook và ledger đồng nhất trên NHIỀU connector: chưa kiểm chứng

SP-8 chứng minh hook chặn được 20/20 ca đối kháng — nhưng trên **mock tool một
hình dạng**. Mệnh đề của FR-CF-07 mạnh hơn hẳn: hook và ledger hoạt động đồng
nhất trên *mọi* connector thông qua hợp đồng manifest, và thao tác
`irreversible` của bất kỳ connector nào tự động thuộc diện FR-AP-05 mà không
cần code riêng.

Kiểm chứng mệnh đề đó cần tối thiểu **hai connector khác hình dạng**: Notion
(đọc + ghi, có snapshot, có bù trừ) và Gmail (chỉ đọc, không bù trừ). Chưa có.

### 2.3. FR-CF-02 và FR-CF-03 — luồng Connect chuẩn và OAuth broker: KHÔNG SPIKE NÀO

FR-CF-02 định nghĩa trải nghiệm kết nối chuẩn cho MỌI connector: *"danh mục app
→ bấm Connect → trình duyệt mở trang ủy quyền → quay về app ở trạng thái đã kết
nối. KHÔNG có bước kỹ thuật nào với người dùng."*

SP-13 kiểm chứng **BYO OAuth client** — người dùng tự tạo client trong Google
Cloud project của họ. Đó là kênh advanced của riêng Google (§13.6), KHÔNG phải
luồng chuẩn.

Luồng chuẩn dành cho Notion đi qua **OAuth broker phía backend** (FR-CF-03,
FR-BE-02): backend giữ `client_secret`, nhận authorization code từ client, đổi
token, trả về client, và **không lưu token**. Đường này chưa từng chạy một lần.

Trong spike, Notion dùng internal integration token — đúng theo §13.5 cho giai
đoạn dev, nhưng nghĩa là luồng OAuth thật của connector chủ lực vẫn trắng.

---

## 3. LỖ HỔNG MỨC ĐỎ — toàn bộ backend không có spike

PRD §1 ghi rõ: *"MVP gồm HAI thành phần triển khai ngang hàng: Desktop client
và Backend service — có database và API riêng, xây dựng, kiểm thử, vận hành với
tiêu chuẩn đầy đủ của một dịch vụ production."*

Số spike chạm tới backend: **0**. Chỉ SP-11 nhắc tên FR-BE-01/02 khi bàn nơi
lưu token phía client.

Chưa kiểm chứng:

| Yêu cầu | Nội dung | Vì sao không bỏ qua được |
| --- | --- | --- |
| FR-BE-01 | Google Sign-In → verify ID token → phát JWT của app | ADR-006, cổng vào của mọi người dùng |
| FR-BE-02 | OAuth broker, **server KHÔNG lưu token connector** | Bảo đảm kiến trúc, không phải chi tiết triển khai |
| FR-BE-08 | Mọi endpoint yêu cầu JWT, bắt buộc TLS | |
| FR-BE-11 | Health endpoint, logging, rate limit chống lạm dụng | |
| NFR-BE-03 | `client_secret` trong secret manager, có quy trình xoay vòng | |
| NFR-BE-05 | Backend KHÔNG BAO GIỜ chứa nội dung lệnh, dữ liệu Notion, ảnh, ledger | Kiểm bằng review schema + audit log — chưa làm |
| NFR-BE-07 | Chịu tải 2× quy mô closed beta cho auth + broker | **Là tiêu chí phát hành #9** |

Lập luận phản biện: backend là công việc chuẩn mực, ít mới lạ về kỹ thuật, nên
không cần spike. Lập luận đó đúng với phần CRUD, nhưng sai với ba điểm:

1. **Ranh giới dữ liệu (NFR-BE-05) là bảo đảm kiến trúc, không phải tính năng.**
   Sai ở đây là sự cố riêng tư, phát hiện muộn thì phải sửa cả schema lẫn luồng.
2. **OAuth broker tổng quát hoá (FR-CF-03) không phải việc chuẩn mực.** Nó phải
   phục vụ nhiều provider chỉ bằng cấu hình, giữ `client_secret` server-side,
   hỗ trợ PKCE khi provider cho phép, và refresh qua broker khi provider đòi
   `client_secret` — bốn ràng buộc đan nhau.
3. **NFR-BE-07 là tiêu chí phát hành.** Không thể ký phát hành bằng niềm tin.

---

## 4. LỖ HỔNG MỨC CAM — tầng tương tác ô thoại

Phụ lục A là đặc tả chi tiết nhất trong PRD: 7 loại card có anatomy riêng, máy
trạng thái ô thoại, quy tắc ưu tiên hàng đợi, 9 ca biên. **12/16 FR-INT không
có spike nào.**

Phần lớn là logic UI tất định, rủi ro thấp, xây thẳng ở M3 được. Nhưng hai mục
KHÔNG thuộc nhóm đó:

### 4.1. FR-INT-07 — hợp đồng tool `ask_user`

Không spike nào chạm. SP-6 kiểm chứng pause/resume ở mức tổng quát, nhưng
FR-INT-07 và Phụ lục A.5 đặt ràng buộc chặt hơn:

- Tham số có cấu trúc: `question`, `options[] {id, label, description?}`,
  `allow_free_text`
- Job chuyển `waiting_input`, resume ĐÚNG điểm dừng với câu trả lời làm ngữ cảnh
- **Mỗi job tối đa MỘT ASK mở tại một thời điểm — harness phải TỪ CHỐI call ASK
  thứ hai khi call thứ nhất chưa được trả lời**
- Câu trả lời đến từ ô thoại HOẶC cửa sổ app, hai nơi là một hàng chờ duy nhất

Ràng buộc "từ chối ASK thứ hai" là hành vi harness, không phải UI — phải kiểm
chứng ở tầng agent. Và A.5 mục 7 cấm agent dùng ASK để lách hook; SP-8 có ca
EVASION về việc này nhưng chạy trên mock tool, không phải trên `ask_user` thật.

### 4.2. FR-PET-03 — Esc/click-ngoài TRẢ FOCUS về cửa sổ trước đó

Không spike nào chạm, và đây là chỗ đáng lo.

SP-7 đã chứng minh Electron thuần **không tự tránh được việc cướp focus** — chỉ
đạt 6/10, phải dùng native module Rust. Việc *chủ động trả focus về đúng cửa sổ
người dùng đang làm việc trước đó* khó hơn việc không cướp focus, vì phải nhớ
và khôi phục foreground window.

Nếu FR-PET-03 cũng cần native code thì phạm vi workstream Rust ở M1 rộng hơn
ước lượng hiện tại của SP-7.

---

## 5. LỖ HỔNG MỨC CAM — ca biên và bảo đảm chưa ai chạy

| Mục | Nội dung | Trạng thái |
| --- | --- | --- |
| **E8** | Gửi lệnh khi backend gián đoạn → composer vẫn nhận → hàng chờ cục bộ → SYSTEM card → tự gửi lại khi backend trở lại | **Là tiêu chí phát hành #10.** Không spike nào |
| **FR-LG-05** | Kiểm thử "không thao tác ngầm": mọi thay đổi trên Notion truy về được một bản ghi ledger, trên 10 job mẫu | **Là tiêu chí phát hành #4.** SP-9 chạy 10 job thật nhưng không đối soát theo chiều này |
| **NFR-RL-04** | Pet chạy liên tục 8 giờ không crash, không rò rỉ bộ nhớ | **Là tiêu chí phát hành #5.** SP-18 Q3 sẽ phủ khi chạy |
| **FR-AG-08** | Retry có kiểm soát: tối đa 3 lần, exponential backoff, mỗi retry ghi ledger | Không spike nào |
| **FR-AG-09** | Timeout job mặc định 10 phút → chuyển `failed` theo FR-AG-07 | Không spike nào |
| **Đa thiết bị** | FR-BE-01 cho phép một tài khoản nhiều thiết bị, nhưng NFR-SEC-03 để dữ liệu local-first không đồng bộ | PRD chưa bao giờ giải quyết. Người dùng mở máy thứ hai thấy gì? Không spike, và cũng không có câu hỏi mở nào ghi nhận |

Mục cuối không phải lỗ hổng spike mà là **lỗ hổng đặc tả** — đáng đưa vào danh
sách chốt gate.

---

## 6. LỖ HỔNG MỨC VÀNG

### 6.1. NFR-CP-03 — đa ngôn ngữ: không spike nào

Yêu cầu: tiếng Việt + tiếng Anh, **mọi chuỗi UI đi qua tầng i18n từ đầu, không
hardcode**, văn bản pet-agent sinh theo ngôn ngữ người dùng đang dùng, và
persona spec định nghĩa giọng văn cho CẢ HAI ngôn ngữ.

Corpus SP-2 và SP-4 có trộn song ngữ, nhưng đó là kiểm chứng model hiểu hai thứ
tiếng — không phải kiểm chứng cơ chế i18n hay persona song ngữ.

Rủi ro kỹ thuật thấp, nhưng "từ đầu, không hardcode" là ràng buộc phải quyết
định TRƯỚC khi viết dòng UI đầu tiên, nên thuộc tài liệu kỹ thuật chứ không
thuộc spike.

### 6.2. Persona spec (OQ-3) vẫn chưa tồn tại

Không phải spike mà là **hiện vật còn thiếu**. Nó chặn FR-PET-10 (mọi thông
điệp pet đi qua pet-agent, cấm hardcode chuỗi), US-1.4, và toàn bộ copy của
M3. Đã nêu từ đầu M0, đến giờ vẫn trống.

### 6.3. FR-APP-01..05 — cửa sổ app

Danh mục connector, danh sách job realtime, trang chi tiết job kèm ledger,
onboarding WF-1. Đều là xây thẳng, rủi ro kỹ thuật thấp. **Không đề nghị spike.**
Riêng WF-1 có ràng buộc đo được (US-5.1: từ cài đặt tới job đầu tiên ≤ 5 phút)
nhưng đó là phép đo beta, không phải spike M0.

---

## 7. NHỮNG GÌ ĐÃ PHỦ TỐT

Ghi lại để thấy rõ ranh giới:

| Mảng | Spike | Đánh giá |
| --- | --- | --- |
| Harness agent | SP-6, SP-4 | Vững. Wrap-before-execute và pause/resume kiểm chứng bằng code chạy |
| Hard gate | SP-8 | Rất vững ở phần evaluator: 0 lọt trên 20 ca đối kháng, p99 0.48ms — nhưng trên mock tool |
| Ledger và khôi phục crash | SP-12 (+Q1) | Vững cả Linux lẫn Windows |
| Bù trừ và undo | SP-1, SP-9 | Vững, có ma trận bù trừ dùng lại được |
| Đúc kết quy tắc | SP-2 | Vững, phát hiện lỗi âm thầm hạ cấp của model rẻ |
| Risk judge | SP-10 | Vững |
| Đồng thời | SP-15 | Vững |
| Chi phí và định tuyến model | SP-17 | Vững, có số tiền thật |
| Cửa sổ pet tĩnh | SP-7 | Vững, và lật được giả định Electron thuần |
| Secure storage | SP-11 | Vững, loại được Credential Manager bằng số liệu |
| Hạ tầng tự động hoá GUI | SP-0 | Vững, tái dùng được |

---

## 8. ĐỀ NGHỊ — ba spike bổ sung, không hơn

Nguyên tắc chọn: chỉ thêm spike cho giả định mà **sai thì sửa đắt**. Những mục
còn lại xử lý bằng tài liệu kỹ thuật hoặc đưa vào danh sách chốt gate.

### SP-19 · Connector framework end-to-end 🔴 — ưu tiên cao nhất

Phủ FR-CF-01, 02, 03, 04, 05, 06, 07, 08 và FR-BE-02.

Kiểm chứng mệnh đề trung tâm bằng cách viết manifest thật cho **hai connector
khác hình dạng** (Notion đọc+ghi có bù trừ, Gmail chỉ đọc), sinh tool từ
manifest, chạy qua đúng lớp hook và ledger của SP-8, và đo xem có phải sửa lõi
dòng nào không. Kèm luồng Connect chuẩn qua OAuth broker cho Notion.

Đây là spike quan trọng nhất còn lại. Nếu nó fail, S-M5 và toàn bộ §10.10 phải
thiết kế lại — và biết điều đó bây giờ rẻ hơn biết ở M1 rất nhiều.

### SP-20 · Backend vertical slice

Phủ FR-BE-01, 02, 08, 10, 11 và NFR-BE-03, 05, 07.

Một lát cắt dọc mỏng nhưng thật: Google Sign-In → verify ID token → phát JWT →
gọi một endpoint có bảo vệ → OAuth broker đổi token Notion → **chứng minh bằng
dump schema và audit log rằng server không lưu token và không thấy nội dung
công việc** → load test đạt NFR-BE-07.

Chạy trọn trên **Windows**. Lý do quyết định là Q5 — nó đếm số thao tác người
dùng trong luồng Connect chuẩn FR-CF-02, mà mọi cách lách (tunnel, copy URL
callback) đều tự thêm bước kỹ thuật người dùng thật không gặp, làm con số mất
ý nghĩa. Windows có trình duyệt thật. Spike này không có GUI và không có native
module nên ràng buộc không-dùng-WSL của các spike khác không áp dụng.

Lưu ý: số đo load test lấy trên máy dev, phải đo lại trên máy chủ thật trước
khi ký tiêu chí phát hành #9.

### SP-21 · Hợp đồng ask_user và quản lý focus

Phủ FR-INT-07, FR-PET-03, và ca biên E8.

Ba câu hỏi có rủi ro thật trong tầng tương tác:
1. Harness có TỪ CHỐI được `ask_user` thứ hai khi call thứ nhất chưa trả lời không?
2. Trả focus về đúng cửa sổ trước đó có cần native module không? Nếu có, phạm
   vi workstream Rust ở M1 rộng hơn ước lượng của SP-7.
3. Lệnh gửi khi backend gián đoạn có vào hàng chờ cục bộ và tự gửi lại không?

Sau rà soát lại: FR-PET-03 (trả focus) đã chuyển sang **SP-18 Q29** vì cùng
tầng Win32 và cùng cần native module theo kết luận SP-7. Phần còn lại —
`ask_user` và E8 — là logic thuần nên **SP-21 chạy trên Linux**.

---

## 9. KHÔNG ĐỀ NGHỊ SPIKE — xử lý bằng cách khác

| Mục | Cách xử lý |
| --- | --- |
| FR-INT-01..16 phần còn lại, FR-APP-01..05 | Logic UI tất định. Xây thẳng ở M3–M4, không cần khử rủi ro trước |
| NFR-CP-03 i18n | Quyết định trong tài liệu kỹ thuật trước dòng UI đầu tiên |
| Persona spec (OQ-3) | Hiện vật thiết kế còn thiếu. Product owner chốt, không phải spike |
| FR-LG-05 không thao tác ngầm | Một lượt đối soát trên dữ liệu SP-9 đã có, không cần spike mới |
| FR-AG-08 retry, FR-AG-09 timeout | Xây và kiểm thử ở M1, rủi ro thấp |
| Đa thiết bị với dữ liệu local-first | **Lỗ hổng đặc tả.** Đưa vào danh sách chốt gate để product owner quyết |

---

## 10. CÂU HỎI CÒN TREO

1. Ba spike bổ sung này có làm M0 kéo dài quá mức chấp nhận không? Nếu buộc
   phải chọn một, tôi chọn SP-19 — nó kiểm chứng mệnh đề mà cả phạm vi MVP dựa vào.
2. Đa thiết bị: một tài khoản nhiều máy nhưng dữ liệu local-first không đồng bộ
   — người dùng mở máy thứ hai thấy gì? PRD chưa trả lời và cũng chưa ghi nhận
   đây là câu hỏi mở.
3. Persona spec còn trống từ đầu M0. Có chốt trước khi vào M3 không, hay để
   pet-agent tự hình thành giọng văn rồi chuẩn hoá sau?
