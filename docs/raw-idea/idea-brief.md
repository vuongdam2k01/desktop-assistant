# IDEA BRIEF — Desktop Assistant

## 1. Tên ý tưởng &amp; phát biểu một câu

**Tên tạm:** Desktop Assistant.

**Đề xuất tên:**

- **Deskmate** — bạn đồng hành trên bàn làm việc.
- **Sidekick** — trợ thủ luôn đứng cạnh, không chen vào giữa.
- **Pixi** — gợi hình ảnh một sinh vật nhỏ sống trên màn hình.

**Phát biểu một câu:** Một ứng dụng desktop hoàn chỉnh chứa hệ agent AI kết nối  
sẵn các nền tảng công việc, phục vụ ba dạng nhu cầu — việc giao bất chợt, việc  
theo lịch trình tự thiết lập bằng ngôn ngữ tự nhiên, và các chức năng cố định  
như tổng hợp họp — với điểm nhấn cốt lõi là một nhân vật/pet hoạt hình thường  
trực trên màn hình làm điểm chạm tương tác chính.

## 2. Hạt nhân của ý tưởng

Đây là **một sản phẩm hoàn chỉnh: ứng dụng desktop trợ lý công việc chạy bằng**  
**hệ agent**, không phải một overlay/widget. Nó có đầy đủ giao diện quản lý, cấu  
hình, tương tác như mọi ứng dụng desktop khác; các agent hoạt động nền là điều  
mặc nhiên của kiến trúc, không phải đặc điểm cần nhấn mạnh.

Bản chất của nó nằm ở sự kết hợp của hai tầng:

1. **Tầng năng lực (hệ thống):** hệ agent LLM theo triết lý harness, kết nối  
các nền tảng công việc (Notion, Jira, Gmail, Drive, SharePoint, Outlook),  
phục vụ người dùng qua đúng ba phương diện chức năng: **tương tác bất chợt**  
**— công việc lịch trình sẵn — chức năng cố định của ứng dụng**.
2. **Tầng trải nghiệm (điểm nhấn):** nhân vật/pet hoạt hình trên desktop —  
chức năng cốt lõi, chủ đạo, đồng thời là nguồn gốc và điểm nhấn cảm hứng  
chính của toàn bộ sản phẩm. Pet là điểm chạm nhanh cho cả ba phương diện  
chức năng ở tầng dưới.

Điều khiến đây là MỘT ý tưởng chứ không phải hai (một "app agent" + một "pet  
desktop"): pet không tồn tại độc lập mà là **mặt tiền tương tác** của hệ agent;  
ngược lại, hệ agent nếu thiếu pet sẽ chỉ là một công cụ tự động hoá không bản  
sắc. Ý tưởng nằm chính ở khớp nối giữa hai tầng này.

## 3. Động cơ &amp; ý định gốc

1. **Thói quen kiểm tra lặp lại** (ví dụ mở email mỗi 2 tiếng) — việc có tính  
chu kỳ mà người dùng muốn "chuyển giao" cho assistant, bằng cách mô tả tự  
nhiên thay vì điền form tạo cron job.
2. **Chi phí chuyển ngữ cảnh** — khi đang tập trung mà phát sinh việc phụ, thao  
tác thủ công trên app khác làm mất mạch làm việc; cần một điểm chạm giao  
việc gần bằng 0 chi phí.
3. **Khát vọng "assistant có linh hồn"** — người dùng cảm nhận được một thực  
thể sống động đang làm việc cùng mình, không phải một cửa sổ phần mềm; đây  
là cảm hứng gốc sinh ra toàn bộ ý tưởng.

## 4. Mô tả hoàn chỉnh

### 4.1. Bức tranh tổng thể

Sản phẩm là một **ứng dụng desktop hoàn chỉnh** gồm hai mặt:

- **Cửa sổ ứng dụng đầy đủ:** nơi quản lý và cấu hình mọi thứ — kết nối nền  
tảng, thiết lập lịch trình, xem report chi tiết, cấu hình prompt, tương tác  
sâu — như bao ứng dụng desktop khác.
- **Nhân vật/Pet trên desktop:** thực thể hoạt hình 2D/3D nổi tự do trên màn  
hình, là điểm chạm tương tác nhanh và kênh thông báo trong lúc người dùng  
đang làm việc khác. Đây là chức năng cốt lõi, chủ đạo của sản phẩm.

Ứng dụng chạy nền liên tục (điều tất yếu vì có agent hoạt động), và toàn bộ  
năng lực của nó được tổ chức theo **ba phương diện chức năng**:


| Phương diện                           | Kích hoạt bởi                                             | Ví dụ tiêu biểu                                                |
| ------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| **1. Tương tác bất chợt**             | Người dùng, tại thời điểm bất kỳ                          | Giao việc "thêm task X vào Notion, cân bằng lại các việc khác" |
| **2. Công việc lịch trình sẵn**       | Lịch do người dùng thiết lập trước bằng ngôn ngữ tự nhiên | Report email mới theo khung giờ cố định                        |
| **3. Chức năng cố định của ứng dụng** | Người dùng gọi tính năng có sẵn                           | Record &amp; tổng hợp nội dung cuộc họp                        |


Ba phương diện dùng chung hạ tầng (hệ agent + connector) và dùng chung điểm  
chạm (pet + cửa sổ app), nhưng khác nhau ở nguồn kích hoạt và mức độ định hình  
sẵn của công việc.

### 4.2. Các thành phần cấu thành

1. **Cửa sổ ứng dụng đầy đủ:** giao diện quản lý trung tâm — kết nối nền tảng,  
danh sách lịch trình đã tạo, report đầy đủ, cấu hình prompt format, và các  
khu vực tương tác/quản trị khác. Đây là "nhà" của sản phẩm; pet là "người  
đại diện" đứng ngoài cửa.
2. **Nhân vật / Pet (chức năng cốt lõi):** thực thể hoạt hình 2D/3D có  
animation và hiệu ứng tương tác, không phải hình tĩnh. Vai trò: điểm chạm  
nhanh cho cả ba phương diện chức năng — nhận lệnh bất chợt, phát thông báo  
khi lịch trình chạy xong, mở lối tắt đến chức năng cố định qua util button.
3. **Ô thoại (speech bubble):** khung thoại kiểu truyện tranh gắn với pet.  
Kênh đầu ra (thông báo/tóm tắt ngắn) và kênh đầu vào (nhập lệnh giao việc)  
`[Suy luận: hợp nhất từ hai kịch bản sử dụng]`. Bấm vào ô thoại thông báo →  
mở cửa sổ app với nội dung chi tiết tương ứng.
4. **Util buttons:** cụm nút tiện ích ẩn/hiện quanh pet khi bấm vào nó, cơ chế  
giống AssistiveTouch. Là lối tắt đến các **chức năng cố định** (hiện có: nút  
record/stop cuộc họp).
5. **Hệ agent (lõi thực thi):** các agent dùng LLM theo triết lý harness — có  
khung điều phối, công cụ, setup ban đầu để xử lý công việc phức tạp, nhiều  
bước, dài hơi. Là bộ máy chung phục vụ cả ba phương diện chức năng.
6. **Lớp kết nối nền tảng (connectors):** Notion, Jira, Gmail, Drive,  
SharePoint, Outlook — cấp cho agent quyền đọc và ghi trên hiện trường công  
việc thật của người dùng.
7. **Bộ lập lịch bằng ngôn ngữ tự nhiên (natural-language scheduler):** năng  
lực tổng quát cho phép người dùng MÔ TẢ một công việc lặp lại và lịch chạy  
của nó bằng lời ("mỗi 2 tiếng tổng hợp email mới cho tôi"), hệ thống tự  
chuyển thành job định kỳ do agent thực thi — tương tự cơ chế cron trong các  
nền tảng như OpenClaw, Hermes agent, Claude Code. **Không phải form cứng**  
**tạo cron job, và report email chỉ là một instance**; người dùng có thể tạo  
lịch trình cho bất kỳ công việc nào agent làm được.
8. **Các chức năng cố định của ứng dụng:** những tính năng được đội ngũ phát  
triển xây sẵn, có quy trình và UI riêng, người dùng chỉ việc gọi ra dùng.  
Đại diện hiện có: **bộ ghi &amp; tổng hợp cuộc họp** — thu trực tiếp âm thanh  
hệ thống (không join vào nền tảng họp nên chạy được với Teams, Meet, Zoom  
hay bất kỳ app nào), start/stop thủ công qua util button, phân tích và xuất  
bản tổng hợp theo format người dùng đã mô tả bằng ngôn ngữ tự nhiên trong  
phần cấu hình.
9. **Bộ nhập liệu đa phương thức:** chấp nhận văn bản, hình ảnh (ví dụ ảnh  
chụp đoạn chat) kèm mô tả — tương tự trải nghiệm nhập của Claude/ChatGPT.

### 4.3. Luồng hoạt động chính (theo ba phương diện)

**Phương diện 1 — Tương tác bất chợt:**

1. Đang làm việc, người dùng phát sinh nhu cầu (ví dụ nhận yêu cầu mới qua chat).
2. Bấm vào pet → nhập lệnh vào ô thoại: gõ chữ, hoặc thả ảnh chụp đoạn chat  
kèm một câu mô tả.
3. Quay lại việc đang làm ngay; agent tự thực thi ở nền (đọc ngữ cảnh trên  
Notion, tạo task, sắp xếp lại các task khác...).
4. Xong việc, agent báo lại `[Suy luận: qua ô thoại]`; người dùng đọc bản tóm  
tắt nhanh, không cần tương tác thêm.

**Phương diện 2 — Công việc lịch trình sẵn:**

1. Người dùng thiết lập một lần, bằng ngôn ngữ tự nhiên: mô tả việc cần làm  
lặp lại + khung giờ (ví dụ: "tổng hợp email mới và báo tôi lúc 9h, 11h,  
14h, 16h").
2. Hệ thống chuyển mô tả thành job định kỳ. Danh sách job quản lý được trong  
cửa sổ app `[Suy luận: hệ quả tự nhiên của việc app có giao diện quản lý]`.
3. Đến giờ, agent tự chạy job trên các nền tảng đã kết nối.
4. Pet hiện ô thoại thông báo kết quả ngắn ("Bạn có X email mới, 1 quan trọng,  
2 xem sau được"); bấm vào → cửa sổ app mở report đầy đủ; không bấm → ô  
thoại tự ẩn `[Suy luận]`.

**Phương diện 3 — Chức năng cố định (đại diện: tổng hợp họp):**

1. Trước khi họp, bấm vào pet → dàn util button xoè ra → bấm nút record.
2. App thu âm thanh hệ thống suốt cuộc họp; nút record chuyển thành stop.
3. Họp xong, bấm stop → app phân tích và trả bản tổng hợp theo format đã cấu  
hình bằng ngôn ngữ tự nhiên. Chức năng gọi được bất cứ lúc nào, không giới  
hạn ở ngữ cảnh họp, nhưng được thiết kế chủ yếu cho họp.

### 4.4. Cơ chế then chốt — "phép màu" nằm ở đâu

Phép màu gồm ba mảnh khớp nhau:

- **Bất đối xứng giữa chi phí giao việc và khối lượng việc được làm:** người  
dùng bỏ ra vài giây (một cú bấm + một câu lệnh + có thể một tấm ảnh), đổi  
lại một chuỗi thao tác nhiều bước trên nhiều nền tảng được agent làm trọn ở  
hậu trường. Nguyên lý: agent + connector đã nối sẵn, harness cho phép đi hết  
chuỗi dài thay vì dừng ở "trả lời".
- **Ngôn ngữ tự nhiên là giao diện thiết lập, không chỉ là giao diện ra lệnh:**  
cả việc bất chợt (phương diện 1), lịch trình định kỳ (phương diện 2) lẫn  
format đầu ra (cấu hình prompt của phương diện 3) đều định nghĩa bằng lời mô  
tả — không form cứng, không cú pháp cron. Người dùng "dặn việc" cho assistant  
đúng như dặn một trợ lý người thật.
- **Hiện diện thường trực, chiếm chỗ tối thiểu:** pet luôn ở đó nên chi phí  
"gọi trợ lý" gần bằng 0; đầu ra chủ động luôn bị nén thành mẩu tin ngắn trên  
ô thoại, chi tiết chỉ mở khi người dùng chủ động kéo (pull) — trợ lý không  
trở thành nguồn xao nhãng mới.

Trên cùng là lớp "phép màu cảm xúc" — điểm nhấn cảm hứng gốc của sản phẩm: mọi  
tương tác nhanh đều đi qua một nhân vật có animation (và có thể có tính cách),  
khiến người dùng cảm nhận mình đang **giao việc cho một ai đó** — một  
"assistant có linh hồn".

## 5. Từ điển khái niệm

- **Ba phương diện chức năng:** khung phân loại chính thức mọi năng lực của  
ứng dụng — (1) tương tác bất chợt, (2) công việc lịch trình sẵn, (3) chức  
năng cố định của ứng dụng.
- **Tương tác bất chợt:** yêu cầu phát sinh tại thời điểm bất kỳ từ người  
dùng, agent xử lý ngay theo lệnh.
- **Công việc lịch trình sẵn:** công việc lặp lại do người dùng thiết lập  
trước, hệ thống tự chạy theo lịch — tương đương cron job ở OpenClaw, Hermes  
agent, Claude Code, nhưng tạo bằng mô tả ngôn ngữ tự nhiên.
- **Chức năng cố định:** tính năng xây sẵn trong ứng dụng với quy trình riêng  
(ví dụ tổng hợp họp), người dùng gọi ra dùng chứ không tự định nghĩa.
- **Nhân vật / Pet:** thực thể hoạt hình 2D/3D nổi trên desktop; chức năng cốt  
lõi, chủ đạo và điểm nhấn cảm hứng chính của sản phẩm; điểm chạm nhanh cho  
cả ba phương diện chức năng.
- **Ô thoại:** khung thoại kiểu truyện tranh gắn vào pet; kênh thông báo ngắn  
và kênh nhập lệnh.
- **Util button:** cụm nút chức năng ẩn/hiện quanh pet theo kiểu AssistiveTouch;  
lối tắt đến các chức năng cố định.
- **Cửa sổ ứng dụng đầy đủ:** giao diện desktop hoàn chỉnh của sản phẩm để  
quản lý, cấu hình và tương tác sâu.
- **Agent:** đơn vị thực thi dùng LLM, có công cụ và quyền trên các nền tảng  
đã kết nối, xử lý công việc nhiều bước.
- **Harness:** khung điều phối + setup ban đầu bao quanh LLM để agent làm được  
việc phức tạp, dài hơi một cách ổn định.
- **Natural-language scheduler:** năng lực chuyển một mô tả bằng lời thành job  
định kỳ do agent thực thi.
- **Report:** bản tổng hợp do agent tạo ra; có bản ngắn (ô thoại) và bản đầy  
đủ (trong cửa sổ app).
- **Cấu hình prompt:** phần cài đặt cho phép mô tả bằng ngôn ngữ tự nhiên  
format đầu ra mong muốn (hiện áp dụng cho bản tổng hợp họp).

## 6. Phạm vi của ý tưởng

**NẰM TRONG ý tưởng:**

- Một ứng dụng desktop hoàn chỉnh: có giao diện quản lý, cấu hình, tương tác  
đầy đủ; chạy nền liên tục vì có agent hoạt động.
- Nhân vật/pet hoạt hình 2D/3D là chức năng cốt lõi, chủ đạo — kèm ô thoại và  
util button.
- Hệ agent LLM theo harness, kết nối và thao tác (đọc + ghi) trên Notion,  
Jira, Gmail, Drive, SharePoint, Outlook.
- Năng lực lập lịch tổng quát bằng ngôn ngữ tự nhiên cho công việc lặp lại  
(report email định kỳ là một instance, không phải tính năng fix cứng).
- Giao việc bất chợt bằng văn bản + hình ảnh, thực thi nền, báo kết quả tóm tắt.
- Chức năng cố định: record âm thanh hệ thống và tổng hợp nội dung họp, format  
tuỳ biến bằng ngôn ngữ tự nhiên.

**NẰM NGOÀI ý tưởng (dễ hiểu nhầm là thuộc về nó):**

- Không phải một overlay/widget chỉ chạy ngầm đội lốt pet — nó là app desktop  
đầy đủ; pet là điểm nhấn chứ không phải toàn bộ hình hài.
- Không phải virtual pet giải trí — pet ở đây là giao diện công việc, không  
phải game nuôi thú `[Suy luận từ định hướng chung]`.
- Không phải chatbot hỏi–đáp kiến thức tổng quát; trọng tâm là thực thi công  
việc trên nền tảng, dù đầu vào giống Claude/ChatGPT `[Suy luận]`.
- Không phải công cụ quản lý dự án thay thế Notion/Jira — nó thao tác lên các  
công cụ đó chứ không chứa dữ liệu dự án làm nguồn chính `[Suy luận]`.
- Không phải bot join vào cuộc họp — nó thu âm thanh từ chính máy người dùng,  
độc lập với nền tảng họp.
- Không phải một "cron UI" kiểu kỹ thuật với form và cú pháp lịch — việc lập  
lịch hình thành từ mô tả ngôn ngữ tự nhiên.
- Không có phiên bản mobile trong phạm vi hiện tại của ý tưởng.

## 7. Kịch bản minh hoạ

**Kịch bản A — Chuyển giao thói quen kiểm tra email (phương diện 2).**  
Lan `[Suy luận: tên nhân vật minh hoạ]` đã kết nối các nền tảng công việc của  
mình với ứng dụng và đang làm việc trên máy như bình thường. Thói quen cũ của  
cô: cứ khoảng 2 tiếng lại tự mở hộp thư kiểm tra email mới. Cô chuyển thói  
quen đó sang cho assistant bằng một câu mô tả tự nhiên — "cứ mỗi 2 tiếng, tổng  
hợp email mới và báo tôi" — thay vì điền form tạo cron job (nơi nhập câu này —  
cửa sổ app hay ô thoại của pet — là điểm còn mở, xem mục 8.4). Từ đó, ứng dụng  
thường trực dưới dạng một nhân vật hiển thị tự do trên desktop. Đến khung giờ  
báo cáo: (1) nhân vật dùng agent tổng hợp nội dung các email mới; (2) rồi hiện  
ra một ô thoại kiểu truyện tranh; (3) nội dung là một lời nhắn ngắn: "Bạn đang  
có 7 email mới, có 1 cái quan trọng, 2 cái có thể xem sau." Lan liếc qua — nếu  
cần, cô **bấm vào ô thoại, ứng dụng mở lên và hiển thị đầy đủ bản report bên**  
**trong app** để cô đọc chi tiết; nếu không, cô cứ làm việc tiếp, không mở hộp  
thư, không đứt mạch.

**Kịch bản B — Ra lệnh nhanh không rời luồng làm việc (phương diện 1).**  
Minh `[Suy luận: tên nhân vật minh hoạ]` đang làm việc song song trên nhiều dự  
án, và lúc này đang ở giữa một task đòi hỏi tập trung cao. Anh ngó qua tin  
nhắn thì thấy đồng nghiệp vừa giao một nhiệm vụ X. Anh muốn lập task cho nó  
ngay trên Notion để khỏi quên, đồng thời cân bằng lại các task hiện có — vì  
task mới này bị chèn vào giữa kế hoạch. Nếu làm thủ công (mở Notion, tạo task,  
điều chỉnh hàng loạt thông tin liên quan), sự liền mạch của công việc đang tập  
trung sẽ mất. Thay vào đó: (1) anh bấm vào nhân vật trên màn hình; (2) nhập  
vào ô thoại: "Hãy thêm cho tao task X vào Notion, cân bằng lại các công việc  
khác"; (3) rồi để đó, quay lại task đang làm, giao phần còn lại cho agent. Đầu  
vào cũng có thể giàu hơn thế: nhiệm vụ giao qua ứng dụng chat thì anh chỉ cần  
chụp đoạn tin nhắn, vất ảnh vào cho nhân vật kèm một câu mô tả — agent tự hiểu  
phần còn lại, giống cách nhập liệu ở Claude hay ChatGPT. Khi làm xong, agent  
báo lại; Minh chỉ đọc bản tóm tắt nhanh kết quả là xong, không phải tương tác  
thêm.

**Kịch bản C — Ghi âm và tổng hợp cuộc họp online (phương diện 3).**  
Hà `[Suy luận: tên nhân vật minh hoạ]` sắp tham gia một cuộc họp online — trên  
Microsoft Teams, Google Meet, Zoom hay bất kỳ ứng dụng họp nào cũng được, vì  
chức năng không phụ thuộc nền tảng họp. (Chức năng này cô có thể gọi ra bất cứ  
lúc nào, nhưng nó được xây chủ yếu cho tình huống họp.) Trước khi vào họp:  
(1) cô bấm vào pet trên màn hình; (2) pet xoè ra một nhóm util button — cách  
ẩn/hiện giống AssistiveTouch trên điện thoại; (3) trong đó có một button dành  
cho việc record và tổng hợp nội dung. Cô bấm button này: ứng dụng bắt đầu  
record, **lấy trực tiếp âm thanh từ máy qua audio** để hiểu nội dung cuộc họp,  
và chính button đó chuyển thành button stop. Họp xong, cô bấm stop; ứng dụng  
phân tích nội dung vừa thu và trả về bản tổng hợp — theo đúng format cô đã cấu  
hình từ trước bằng một câu mô tả ngôn ngữ tự nhiên trong phần cấu hình của ứng  
dụng, ví dụ: "tóm tắt theo 3 mục: quyết định — việc cần làm kèm người phụ  
trách — vấn đề còn treo" `[Suy luận: ví dụ format minh hoạ]`.

## 8. Các lựa chọn thiết kế còn mở

1. **Pet là một agent có tính cách, hay chỉ là vỏ giao diện?**
  - *Phương án 1: Pet = agent nhân cách hoá, độc lập với hệ agent còn lại.*  
  Đạt mục tiêu "assistant có linh hồn" — nhất quán với việc pet là điểm nhấn  
  cảm hứng chính; nhưng kiến trúc phức tạp hơn (một agent điều phối đứng  
  trên các agent thực thi) và tính cách có thể gây nhiễu khi người dùng chỉ  
  cần việc được làm.
  - *Phương án 2: Pet = lớp UI thuần, agent phía sau vô danh.* Đơn giản, dễ  
  kiểm soát; nhưng "linh hồn" chỉ còn là animation — mâu thuẫn với vị trí  
  chức năng cốt lõi, chủ đạo của pet.
2. **Hệ agent đóng kín hay mở?**
  - *Đóng gói sẵn:* người dùng không thấy/không chỉnh agent; trải nghiệm gọn.
  - *Hệ quản lý agent riêng:* mạnh và linh hoạt, nhưng kéo sản phẩm về phía  
  công cụ kỹ thuật.
3. **Ranh giới giữa "lịch trình sẵn" và "chức năng cố định":** một chức năng  
cố định có thể được đặt lịch không (ví dụ "tự record mọi cuộc họp trong  
calendar")? Nếu có, hai phương diện 2 và 3 giao nhau — cần định nghĩa rõ  
phương diện nào "sở hữu" job lai như vậy.
4. **Điểm nhập để thiết lập lịch trình:** câu mô tả tạo job định kỳ được nhập  
ở đâu — trong cửa sổ app đầy đủ (khu vực lịch trình), qua ô thoại của pet  
như một lệnh bất chợt ("từ giờ cứ 2 tiếng thì..."), hay cả hai? Nếu cả hai,  
ranh giới giữa "một lệnh bất chợt" và "một lệnh tạo lịch" do agent tự nhận  
diện — đây là điểm chạm trực tiếp giữa phương diện 1 và 2.
5. **Giao diện quản lý job lịch trình:** tạo bằng ngôn ngữ tự nhiên đã rõ,  
nhưng xem — sửa — tạm dừng — xoá job diễn ra thế nào trong cửa sổ app: danh  
sách job kiểu kỹ thuật, hay tiếp tục hội thoại tự nhiên ("bỏ cái lịch  
report email chiều đi")? Mỗi hướng cho một cảm giác sản phẩm rất khác nhau.
6. **Mức độ chủ động của pet:** chỉ lên tiếng theo lịch và khi xong việc, hay  
được phép chủ động gợi ý? Chủ động hơn = "có linh hồn" hơn nhưng dễ phá  
nguyên tắc "không trở thành nguồn xao nhãng".
7. **2D hay 3D; một nhân vật cố định hay cho chọn/tuỳ biến:** ảnh hưởng chi  
phí animation và mức độ gắn bó cảm xúc.
8. **Xử lý audio họp tại máy hay trên cloud:** ảnh hưởng riêng tư, tốc độ, độ  
chính xác `[Suy luận: điểm chưa được đề cập trong ý tưởng gốc]`.

## 9. Giả định nội tại

- Người dùng làm việc chủ yếu và liên tục trên một máy desktop, nơi pet luôn  
nhìn thấy được.
- Người dùng chấp nhận một nhân vật hoạt hình chiếm chỗ thường trực trên màn  
hình khi làm việc nghiêm túc — và coi đó là điểm cộng chứ không phải phiền  
nhiễu.
- Mô tả ngôn ngữ tự nhiên đủ để hệ thống suy ra chính xác một job định kỳ  
(việc gì, lịch nào, báo ra sao) mà không cần form xác nhận rườm rà.
- Người dùng sẵn sàng trao cho agent quyền **ghi** (tạo, sửa, sắp xếp lại  
task) và tin bản tóm tắt kết quả mà không tự kiểm tra từng thao tác.
- Agent với harness phù hợp đủ tin cậy để hiểu đúng lệnh ngắn/ảnh chụp và thực  
thi đúng trên nền tảng thật, kể cả job chạy định kỳ không có người giám sát.
- Một mẩu thông báo ngắn trên ô thoại đủ để người dùng ra quyết định "xem ngay  
/ để sau".
- Máy của người dùng cho phép thu âm thanh hệ thống với chất lượng đủ để tổng  
hợp nội dung họp chính xác.
- Khái niệm "email quan trọng" và "cân bằng task" có thể được agent suy ra đủ  
đúng từ ngữ cảnh hoặc cấu hình của người dùng.

## 10. Điểm mơ hồ &amp; mâu thuẫn trong ý tưởng gốc

1. **"Cân bằng lại các task"** không có tiêu chí (deadline, ưu tiên, khối  
lượng?). → Brief mô tả nó như hành động sắp xếp lại thứ tự/lịch task, để  
tiêu chí là câu hỏi mở.
2. **Tiêu chí email "quan trọng"** không được định nghĩa. → Tạm coi là do  
agent đánh giá, ghi thành giả định và câu hỏi.
3. **Trace/quản lý việc agent đã làm** là điểm được chính ý tưởng gốc nêu là  
chưa rõ. → Brief chỉ ghi nhận đây là mắt xích còn thiếu, không tự bịa cơ  
chế.
4. **Pet có phải một agent không** — câu hỏi mở trong ý tưởng gốc. → Trình bày  
thành lựa chọn thiết kế mở (mục 8.1).
5. **Ranh giới lịch trình sẵn vs. chức năng cố định** chưa được vạch — khung 3  
phương diện chưa nói job lai xử lý thế nào. → Nêu thành lựa chọn mở  
(mục 8.3).
6. **Điểm nhập để tạo lịch trình** (cửa sổ app hay ô thoại của pet) chưa được  
nói rõ. → Nêu thành lựa chọn mở (mục 8.4); kịch bản A giữ trạng thái mở này  
thay vì chọn hộ một hướng.
7. **Ô thoại vừa là đầu ra vừa là đầu vào** không được nói tường minh (một  
kịch bản dùng nó để thông báo, một kịch bản dùng để nhập lệnh). → Tạm hợp  
nhất thành một thành phần hai chế độ, gắn nhãn suy luận.
8. **Kênh báo kết quả khi agent làm xong việc bất chợt** không nói rõ. → Tạm  
suy luận là qua ô thoại, đồng bộ với phương diện 2.
9. **Nội dung cụ thể của cửa sổ app đầy đủ** — được khẳng định là "quản lý,  
cấu hình, tương tác như bao ứng dụng khác" nhưng chưa liệt kê các khu vực.  
→ Brief suy ra các khu vực tối thiểu từ các chức năng đã nêu (kết nối, lịch  
trình, report, cấu hình prompt), gắn nhãn suy luận nơi cần.

## 11. Câu hỏi để hoàn thiện ý tưởng

1. Một chức năng cố định (như tổng hợp họp) có thể được đưa vào lịch trình  
không? Ranh giới và quan hệ giữa phương diện 2 và 3 là gì khi chúng giao  
nhau?
2. Người dùng xem lại và kiểm chứng những gì agent đã làm ở đâu, dưới dạng gì  
(nhật ký hành động, diff trước/sau, khả năng hoàn tác) — cho cả việc bất  
chợt lẫn job định kỳ chạy không người giám sát?
3. Pet là MỘT agent điều phối có tính cách đứng trên các agent thực thi, hay  
chỉ là gương mặt hiển thị? Nếu có tính cách, nó thể hiện ở đâu ngoài  
animation (giọng văn ô thoại? phản ứng theo trạng thái việc?)?
4. Câu mô tả tạo lịch trình được nhập ở đâu — cửa sổ app, ô thoại của pet, hay  
cả hai — và nếu cả hai thì agent phân biệt "lệnh bất chợt" với "lệnh tạo  
lịch" bằng cách nào?
5. Quản lý các job lịch trình trong cửa sổ app theo kiểu nào: danh sách chỉnh  
sửa được, hay tiếp tục bằng hội thoại tự nhiên ("bỏ lịch report chiều đi")?
6. Khi nói "cân bằng lại các task", agent dựa vào tiêu chí gì, và được tự  
quyết đến đâu trước khi phải hỏi lại người dùng?
7. Khi nhiều việc chạy song song (job định kỳ trùng giờ + việc bất chợt + đang  
record họp), pet thể hiện và xếp hàng thông báo như thế nào để không thành  
nguồn xao nhãng?
8. "Quan trọng" trong report email do agent tự suy, do người dùng dạy dần, hay  
do quy tắc khai báo trước (có thể chính bằng câu mô tả khi tạo lịch)?
9. Một "công việc" trong app có vòng đời chuẩn không (nhận → chạy → chờ xác  
nhận → xong), và người dùng có thể can thiệp giữa chừng (huỷ, sửa lệnh)  
không?
10. Bản tổng hợp họp và các report được lưu ở đâu, tìm lại bằng cách nào —  
trong app, hay đẩy về một nền tảng đã kết nối (Notion/Drive)?
11. Danh mục chức năng cố định dự kiến gồm những gì ngoài tổng hợp họp — hay  
triết lý là giữ chức năng cố định tối thiểu và dồn mọi thứ về hai phương  
diện kia?

## Hướng mở rộng đáng cân nhắc (tách khỏi ý tưởng gốc)

- **Trạng thái pet phản ánh trạng thái hệ thống:** pet "gõ phím" khi agent  
đang chạy, "ngủ" khi rảnh, "cầm phong bì" khi có report chờ — biến animation  
thành kênh thông tin ngầm, tăng "linh hồn" mà không thêm thông báo.
- **Nâng cấp từ việc bất chợt thành lịch trình:** khi người dùng lặp lại một  
yêu cầu bất chợt nhiều lần, hệ thống gợi ý "muốn tôi làm việc này định kỳ  
không?" — cây cầu tự nhiên nối phương diện 1 sang phương diện 2.
- **Prompt format tuỳ biến cho mọi loại report**, không riêng bản tổng hợp họp  
— vì cơ chế cấu hình bằng ngôn ngữ tự nhiên đã có sẵn trong ý tưởng.

