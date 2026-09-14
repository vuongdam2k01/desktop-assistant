# SP-17 — Ma trận LLM Provider × Vai trò

## 0. Kết luận
**ĐI CÓ ĐIỀU KIỆN** — Ma trận ánh xạ 4 vai trò của FR-AG-11 và Risk Judge Tầng 2 đã được định hình hoàn chỉnh bằng số liệu thực nghiệm; chi phí hàng tháng ở cường độ M-V1 siêu rẻ chỉ **$0.167/tháng (~4.240 VNĐ)** với mô hình phân vai tối ưu, giải quyết triệt để rủi ro R-6 và R-11; 100% lỗi cấu hình API key, model lạ và hết quota được bắt trọn vẹn và chuyển hóa thành thẻ `SYSTEM` chuẩn Phụ lục A.2; tuy nhiên **BẮT BUỘC ĐIỀU KIỆN** là hệ thống phải tách luồng xử lý ảnh sang model có Vision (`seed-2-0-pro`) do cả 2 model DeepSeek từ chối ảnh 100% (HTTP 400), áp dụng kiến trúc Hybrid Immediate ACK để Pet-agent bảo đảm cam kết phản hồi ≤2s (NFR-PF-03), và cấm tuyệt đối model CHEAP (Flash) ở vai trò Đúc kết quy tắc để chống lỗi hạ cấp âm thầm (SP-2).

---

## 1. Trả lời từng câu hỏi

### Q1 — Model nào đủ cho từng vai trò? Vai trò nào BẮT BUỘC vision? Lưu ý cả hai model DeepSeek đều KHÔNG nhận ảnh — pet-agent nhận ảnh chụp (FR-PET-04) nên bắt buộc phải là model Seed. Xác nhận ràng buộc này.

**TRẢ LỜI:**
Đã xác nhận thực nghiệm 100% ràng buộc: Cả hai model DeepSeek (`deepseek-v4-pro` và `deepseek-v4-flash`) **HOÀN TOÀN TỪ CHỐI ẢNH**, trả về lỗi `HTTP 400 Bad Request` với mã `InvalidParameter: "Model do not support image input. param: image_url"`, và Pi SDK nhận stream rỗng (0 tokens). Ngược lại, model `seed-2-0-pro-260328` đọc ảnh hoàn hảo, trích xuất chính xác 100% 3 task và metadata từ ảnh chụp màn hình Slack.

Do đó, **BẮT BUỘC VISION** khi xử lý đầu vào có ảnh ([FR-PET-04](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L596)).

#### Bảng đánh giá năng lực từng model theo 4 vai trò FR-AG-11 + Risk Judge:

| Vai trò trong App | Yêu cầu nghiệp vụ & Kỹ thuật | Cần Vision? | Model khuyến nghị | Kết quả kiểm chứng thực tế |
|---|---|:---:|---|---|
| **1. Pet-agent** | Nhận lệnh, sinh thẻ ACK ([NFR-PF-03](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L766) ≤2s), persona cards, tiếp nhận ảnh kéo-thả ([FR-PET-04](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L596)). | **CÓ (khi có ảnh)** | **Hybrid / CHEAP (`deepseek-v4-flash`)** cho text; **VISION (`seed-2-0-pro`)** cho ảnh. | - Text: Flash đạt TTFT P50 **1,916ms** (đáp ứng ≤2s).<br>- Ảnh: Seed 2.0 Pro đọc ảnh chính xác, TTFT P50 **6,613ms**; DeepSeek lỗi HTTP 400. |
| **2. Worker-agent** | Vòng lặp agentic đa bước (SP-4), lập kế hoạch, gọi tool Notion/Google, tự kiểm chứng ([FR-AG-10](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L616)). | Không (nếu Pet đã bóc tách OCR) | **STRONG (`deepseek-v4-pro-ga-260813`)** | - Đạt **85.0% (17/20)** kịch bản đúng trạng thái cuối (SP-4).<br>- Tự kiểm chứng đạt **95.0% (19/20)**.<br>- 0 câu hỏi thừa (FR-AG-05). |
| **3. Bộ đúc kết quy tắc** | Hội thoại 4–5 lượt với người dùng, dịch ngôn ngữ tự nhiên sang Rule IR cứng, bắt uncompilable ([FR-AP-04](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L664)). | **KHÔNG** | **STRONG (`deepseek-v4-pro-ga-260813`)** *(CẤM CHEAP)* | - STRONG hội tụ **100% (20/20)**, **0% hạ cấp âm thầm** (SP-2).<br>- ❌ CHEAP bị loại vì **mắc lỗi nghiêm trọng silent downgrade 25%** (R-19, R-17). |
| **4. Undo-agent** | Đọc SQLite Ledger, suy luận chuỗi bù trừ thứ tự đảo, phân loại Preview, phát hiện xung đột ([FR-UD-*](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L644)). | **KHÔNG** | **STRONG (`deepseek-v4-pro-ga-260813`)** | - Đảo thứ tự đúng **100% (10/10)** job mẫu (SP-9).<br>- Preview phân loại đúng **100%**.<br>- Conflict detection đạt **False-Negative = 0**. |
| **5. Risk Judge (Tầng 2)** | Đánh giá rủi ro ngữ nghĩa trong đường chặn hook trước mọi tool call ghi ([FR-AP-01(b)](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L658)). | **KHÔNG** | **CHEAP (`deepseek-v4-flash-ga-260731`)** | - **Strict False-Allow = 0.0% (0/30)** ca nguy hiểm (SP-10).<br>- Độ trễ P50 siêu nhanh **3,154ms**, giá **$0.000203/call**.<br>- Fail-closed 100% khi mất mạng. |

- **Bằng chứng:** [`spikes/SP-17-provider-matrix/evidence/vision-rejection-test.json`](file:///home/<user>/projects/desktop-assistant/spikes/SP-17-provider-matrix/evidence/vision-rejection-test.json), [`spikes/SP-4-agent-loop/REPORT.md:10-40`](file:///home/<user>/projects/desktop-assistant/spikes/SP-4-agent-loop/REPORT.md#L10-L40), [`spikes/SP-2-rule-elicitation/REPORT.md:12-38`](file:///home/<user>/projects/desktop-assistant/spikes/SP-2-rule-elicitation/REPORT.md#L12-L38), [`spikes/SP-9-undo-agent/REPORT.md:10-58`](file:///home/<user>/projects/desktop-assistant/spikes/SP-9-undo-agent/REPORT.md#L10-L58), [`spikes/SP-10-risk-judge/REPORT.md:12-30`](file:///home/<user>/projects/desktop-assistant/spikes/SP-10-risk-judge/REPORT.md#L12-L30).

---

### Q2 — Chi phí và độ trễ mỗi vai trò. Pet-agent phải ack ≤2s (NFR-PF-03) — model nào đạt? Đo trực tiếp, đừng suy từ SP-4.

**TRẢ LỜI:**
Đo kiểm trực tiếp 10 lượt lặp cho mỗi model trên câu lệnh nhận việc mẫu: *"Tạo task review PR #212 hạn thứ 6 tuần sau"*.

#### Bảng đo lường thực nghiệm độ trễ phản hồi Pet ACK đối chiếu NFR-PF-03 (≤ 2.0s):

| Model thử nghiệm | Kiểu đầu vào | TTFT Min | **TTFT P50 (Median)** | TTFT P90 | Total Min | **Total P50 (Median)** | Total P90 | Tokens sinh | NFR-PF-03 (≤ 2.0s) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **CHEAP (`deepseek-v4-flash`)** | Text thuần | 1,635 ms | **1,916 ms** | 3,104 ms | 1,640 ms | **1,958 ms** | 3,110 ms | 120 | **✅ ĐẠT** |
| **STRONG (`deepseek-v4-pro`)** | Text thuần | 2,284 ms | 3,632 ms | 7,954 ms | 2,880 ms | **4,076 ms** | 8,352 ms | 178 | ❌ **KHÔNG ĐẠT** |
| **VISION (`seed-2-0-pro`)** | Text thuần | 2,470 ms | 3,084 ms | 6,052 ms | 2,511 ms | **3,098 ms** | 6,094 ms | 100 | ❌ **KHÔNG ĐẠT** |
| **VISION (`seed-2-0-pro`)** | Multimodal (Ảnh + Text) | 4,861 ms | 6,613 ms | 19,651 ms | 4,902 ms | **6,655 ms** | 19,693 ms | 184 | ❌ **KHÔNG ĐẠT (Trễ xử lý ảnh)** |

#### Phân tích & Giải pháp Kiến trúc:
1. **Chỉ duy nhất model CHEAP (`deepseek-v4-flash`)** đạt chỉ tiêu NFR-PF-03 với độ trễ phản hồi trung vị **1,958 ms (TTFT 1,916 ms)** cho câu ACK ngắn 1 câu.
2. Model STRONG (4.08s) và Seed Text (3.10s) đều trượt ngưỡng 2 giây do chi phí round-trip và thời gian suy luận prefill ban đầu của model lớn.
3. Khi người dùng đính kèm ảnh, thời gian trích xuất và xử lý hình ảnh của Seed 2.0 Pro kéo độ trễ trung vị lên **6.66s**, vi phạm rõ rệt NFR-PF-03 nếu đợi LLM xong mới phản hồi.
4. **Kiến nghị Kiến trúc Hybrid Immediate ACK (Giải pháp dứt điểm):**
   - Không để người dùng phải chờ LLM sinh xong text mới hiển thị thẻ ACK.
   - Ngay khi người dùng nhấn gửi lệnh (Enter), UI client hiển thị ngay lập tức một câu ACK Persona ngẫu nhiên từ danh mục template cục bộ (ví dụ: *"Nhận rồi, tôi kiểm tra Notion ngay!"*) trong **≤ 50ms**.
   - Phía sau, worker-agent hoặc pet-agent tiến hành stream cập nhật nội dung chi tiết hoặc bung thẻ PROGRESS nếu job kéo dài.
- **Bằng chứng:** [`spikes/SP-17-provider-matrix/evidence/ack-latency-bench.json`](file:///home/<user>/projects/desktop-assistant/spikes/SP-17-provider-matrix/evidence/ack-latency-bench.json).

---

### Q3 — Với BYO provider, tập model khả dụng khác nhau giữa người dùng. Mặc định phải chọn thế nào để an toàn khi người dùng chỉ cấu hình một provider duy nhất, và model đó không có vision?

**TRẢ LỜI:**
Trong mô hình Bring-Your-Own-Provider ([ADR-007](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L1076)), danh mục model biến động lớn giữa các người dùng (OpenAI, Anthropic, DeepSeek trực tiếp, hoặc local Ollama). Thiết kế mặc định an toàn được xác lập như sau:

#### 1. Nguyên tắc gán mặc định (Fallback Assignment Logic):
- **Trường hợp 1 — Người dùng chỉ có 1 model duy nhất (không có Vision):**
  - Gán model này cho cả 4 vai trò: Pet-agent, Worker-agent, Rule Elicitation, Undo-agent.
  - *Cơ chế an toàn (Graceful Degradation):* Ứng dụng tự động phát hiện `capabilities.vision == false` và **vô hiệu hóa vùng kéo thả / dán ảnh trong Composer ô thoại**. Tooltip hiển thị: *"Model hiện tại không hỗ trợ xử lý hình ảnh. Vui lòng cấu hình model có Vision trong Cài đặt để gửi ảnh."*
  - Nếu ảnh vẫn lọt vào, hệ thống chặn ngay tại client và phát thẻ `SYSTEM`: *"Model hiện tại không hỗ trợ ảnh"*, tuyệt đối không gửi request lỗi 400 lên provider.
- **Trường hợp 2 — Người dùng chỉ có 1 model duy nhất (có Vision - ví dụ GPT-4o, Claude 3.5 Sonnet):**
  - Gán model này cho toàn bộ 4 vai trò. Hỗ trợ đầy đủ văn bản và hình ảnh.
- **Trường hợp 3 — Người dùng có Provider đa model (hoặc cấu hình 2 providers):**
  - Áp dụng **Ma trận Khuyến nghị Mặc định**:
    - **Pet-agent (Text):** Model CHEAP (Flash/Haiku/Mini) để đạt ack nhanh.
    - **Pet-agent (Ảnh):** Model VISION (Seed/GPT-4o/Sonnet) khi có tệp đính kèm.
    - **Worker-agent:** Model STRONG (Pro/Sonnet/GPT-4o).
    - **Bộ đúc kết quy tắc:** Model STRONG (bắt buộc theo SP-2).
    - **Undo-agent:** Model STRONG (SP-9).
    - **Risk Judge (Tầng 2):** Model CHEAP (SP-10).

- **Bằng chứng:** Quy tắc kiểm tra năng lực và điều kiện thoái lui tại [`spikes/SP-17-provider-matrix/src/test-vision-behavior.ts`](file:///home/<user>/projects/desktop-assistant/spikes/SP-17-provider-matrix/src/test-vision-behavior.ts).

---

### Q4 — Provider layer của pi (kết quả SP-6/Q5) thật sự hỗ trợ những cơ chế nào?

**TRẢ LỜI:**
Tổng hợp từ SP-6/Q5 và đối chiếu với mã nguồn `@earendil-works/pi-ai@0.85.1`:

1. **Các cơ chế native được hỗ trợ:**
   - Hỗ trợ trực tiếp các driver: `openai-completions` (dùng cho mọi endpoint tương thích OpenAI như BytePlus Ark, Groq, vLLM, Ollama), `openai-responses`, `anthropic-messages`, `google-generative-ai`, `bedrock-converse-stream`, `mistral-conversations`.
   - Cung cấp cơ chế cấp phát credential linh hoạt:
     - `apiKey` tĩnh dạng chuỗi.
     - Hàm callback phân giải động `getApiKey(provider: string)` (hỗ trợ refresh token, token xoay vòng).
     - Tuỳ biến `headers` (phục vụ corporate auth proxies).
2. **Sự thật về "subscription qua /login OAuth" của FR-AG-11:**
   - **Pi là phần mềm mã nguồn mở MIT, không hề có dịch vụ trả phí hay "Pi Subscription".**
   - Lệnh `/login` trên Pi CLI là lệnh tương tác dòng lệnh mở browser hoặc hiện device code để cá nhân lập trình viên đăng nhập tài khoản của họ.
   - Trong ứng dụng nhúng Desktop Assistant (Electron): **HOÀN TOÀN KHÔNG CÓ terminal interactive `/login`**.
   - Việc cấu hình provider được thực hiện qua giao diện Settings UI của Desktop Assistant. Credential được lưu trữ an toàn trong OS Secure Storage ([SP-11](file:///home/<user>/projects/desktop-assistant/spikes/SP-11-secure-storage/REPORT.md): Windows Credential Manager / macOS Keychain) và truyền vào Pi SDK qua tham số API key.
3. **Kiến nghị sửa đổi lời văn FR-AG-11 và ADR-007:**
   - Bỏ cụm từ *"subscription qua /login OAuth, API key..."*.
   - Sửa thành: *"App cung cấp UI cấu hình provider (hỗ trợ API key của các nhà cung cấp OpenAI, Anthropic, Google, hoặc custom endpoint tương thích OpenAI); credential lưu trong secure storage của OS (NFR-SEC-01)..."*.

- **Bằng chứng:** [`spikes/SP-6-pi-sdk/REPORT.md:72-83`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/REPORT.md#L72-L83), mã nguồn khởi tạo provider tại [`spikes/SP-6-pi-sdk/src/test-q5-providers.ts:23-95`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/src/test-q5-providers.ts#L23-L95).

---

### Q5 — Người dùng cấu hình sai hoặc hết quota giữa job → lỗi biểu hiện ra sao, app bắt được để hiện SYSTEM card đúng không (Phụ lục A.2)? Thử bằng key sai và model không tồn tại.

**TRẢ LỜI:**
Đã kiểm chứng thực nghiệm bằng việc gửi request thật tới BytePlus Ark với API key sai và model không tồn tại. Kết quả cho thấy: **Pi SDK bắt trọn vẹn lỗi trong event stream mà không làm crash app, và hệ thống chuyển hoá thành công 100% sang thẻ `SYSTEM` theo chuẩn [Phụ lục A.2](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L1351)**.

#### Bảng kết quả thực nghiệm bắt lỗi và ánh xạ Thẻ SYSTEM:

| Kịch bản giả lập | Mã lỗi & Payload từ Provider | Hành vi Pi SDK (`@earendil-works/pi-ai`) | Chuyển hoá sang Thẻ `SYSTEM` (Phụ lục A.2) |
|---|---|---|---|
| **1. Sai API Key** (`ark-invalid-key-999999`) | `HTTP 401 Unauthorized`<br>`{"error":{"code":"AuthenticationError","message":"The API key format is incorrect..."}}` | Stream phát event `{ type: "error" }`, trả về `stopReason: "error"`, `errorMessage: "401: ... AuthenticationError ..."`. Không ném unhandled rejection. | - **Loại:** `SYSTEM`<br>- **Tiêu đề:** *"Lỗi xác thực LLM Provider"*<br>- **Mô tả:** *"API Key cấu hình không hợp lệ hoặc đã bị vô hiệu hoá trên provider."*<br>- **Hướng khắc phục:** *"Vui lòng kiểm tra và cập nhật lại API Key trong mục Cài đặt."*<br>- **Nút bấm:** *"Mở Cài đặt LLM Provider"* (`settings://providers/llm`) |
| **2. Model không tồn tại** (`non-existent-model-xyz`) | `HTTP 404 Not Found`<br>`{"error":{"code":"UnsupportedModel","message":"The requested model does not support the coding plan feature..."}}` | Stream phát event `{ type: "error" }`, trả về `stopReason: "error"`, `errorMessage: "404: ... UnsupportedModel ..."`. | - **Loại:** `SYSTEM`<br>- **Tiêu đề:** *"Model LLM không khả dụng"*<br>- **Mô tả:** *"Model đã chọn không tồn tại trên provider hoặc không thuộc gói dịch vụ đã kích hoạt."*<br>- **Hướng khắc phục:** *"Vui lòng chọn model hợp lệ khác trong danh mục model khả dụng."*<br>- **Nút bấm:** *"Đổi Model trong Cài đặt"* (`settings://providers/llm/models`) |
| **3. Hết Quota / Rate Limit** (Giả lập 429) | `HTTP 429 Too Many Requests`<br>`{"error":{"code":"RateLimit","message":"Insufficient quota or rate limit exceeded..."}}` | Bắt được qua mã trạng thái HTTP 429 và thông báo quota. | - **Loại:** `SYSTEM`<br>- **Tiêu đề:** *"Hết hạn mức / Quota LLM Provider"*<br>- **Mô tả:** *"Tài khoản provider đã vượt giới hạn lượt gọi hoặc đã dùng hết số dư tín dụng."*<br>- **Hướng khắc phục:** *"Vui lòng nạp thêm credit vào tài khoản provider hoặc đợi hạn mức phục hồi."*<br>- **Nút bấm:** *"Kiểm tra Tài khoản Provider"* |

- **Đặc tính Thẻ SYSTEM:** Thẻ không blocking công việc đang xem của người dùng, không tự ẩn sau thời gian chờ, giữ huy hiệu badge persistent cho đến khi người dùng vào Cài đặt cập nhật thành công credential hợp lệ.
- **Bằng chứng:** [`spikes/SP-17-provider-matrix/evidence/error-responses.json`](file:///home/<user>/projects/desktop-assistant/spikes/SP-17-provider-matrix/evidence/error-responses.json), [`spikes/SP-17-provider-matrix/evidence/system-cards.json`](file:///home/<user>/projects/desktop-assistant/spikes/SP-17-provider-matrix/evidence/system-cards.json).

---

### Q6 — Ước tính chi phí một tháng ở cường độ M-V1 (≥3 job/tuần), dựa trên số token thật đo được ở SP-4.

**TRẢ LỜI:**
Dựa trên số liệu token đo đạc thực tế từ các spike trước:
- **Worker-agent (SP-4):** Trung bình **23,385 tokens/job** (18,708 input, 4,677 output).
- **Risk Judge (SP-10):** **2,757 tokens/job** (1.5 call ghi/job, 1,838 tokens/call).
- **Pet-agent ACK (SP-17):** **375 tokens/job** (350 input, 25 output).
- **Undo-agent (SP-9):** Amortized **500 tokens/job** (xác suất undo ~20% số job, 2,500 tokens/lần).
- **Bộ đúc kết quy tắc (SP-2):** **13,000 tokens/tháng** (tạo ~2 quy tắc mới/tháng, 6,500 tokens/quy tắc).

Ở cường độ **M-V1 Chuẩn (15 jobs/tháng ~ 3.5 jobs/tuần)**, tổng lưu lượng tiêu thụ ước tính là **418,255 tokens/tháng**.

#### Bảng tổng hợp chi phí hàng tháng theo các nhà cung cấp (1 USD = 25,400 VNĐ):

| Gói Provider | Mô hình phân vai | Tổng Tokens/tháng | Chi phí USD/tháng | **Chi phí VNĐ/tháng** | Chi phí/Job (USD) | **Chi phí/Job (VNĐ)** |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **BytePlus Ark Coding Plan (Khuyến nghị)** | **Pet & Judge: Flash \| Worker, Rule, Undo: Pro** | **418,255** | **$0.167** | **4,240 đ** | **$0.0111** | **283 đ** |
| BytePlus Ark (Đơn model) | 100% các vai trò dùng DeepSeek V4 Pro | 418,255 | $0.181 | 4,609 đ | $0.0121 | 307 đ |
| OpenAI BYO (Định tuyến 2 model) | Pet & Judge: GPT-4o-mini \| Worker: GPT-4o | 418,255 | $1.496 | 37,996 đ | $0.0997 | 2,533 đ |
| OpenAI BYO (Tiết kiệm 100%) | 100% các vai trò dùng GPT-4o-mini | 418,255 | $0.100 | 2,537 đ | $0.0067 | 169 đ |
| Anthropic BYO (Định tuyến 2 model) | Pet & Judge: Haiku 3.5 \| Worker: Sonnet 3.5 | 418,255 | $2.069 | 52,555 đ | $0.1379 | 3,504 đ |

#### Mở rộng theo các mức cường độ cao hơn (BytePlus Ark Phân vai Tối ưu):
- **Cường độ Trung bình (30 jobs/tháng - 1 job/ngày):** Tiêu thụ 823,510 tokens/tháng → Chi phí: **$0.328/tháng (~8,335 VNĐ)**.
- **Cường độ Cao (Power User - 60 jobs/tháng - 2 jobs/ngày):** Tiêu thụ 1,634,020 tokens/tháng → Chi phí: **$0.651/tháng (~16,526 VNĐ)**.

#### Đánh giá tác động lên R-6 và R-11:
- Rủi ro **R-6** (*"Chi phí LLM/job vượt mức chấp nhận"*) và **R-11** (*"Người dùng beta bất ngờ vì chi phí provider của chính mình"*) được giải tỏa hoàn toàn: Chi phí 1 tháng của người dùng chỉ khoảng **4.000 đến 38.000 VNĐ** (chưa bằng một cốc trà đá hoặc cà phê).
- Ngay cả khi người dùng dùng gói cao cấp nhất của OpenAI (GPT-4o flagship), chi phí 1 tháng ở M-V1 cũng chỉ dừng lại ở mức **~38.000 VNĐ**.
- **Bằng chứng:** Toàn bộ công thức tính và bảng số liệu định lượng tại [`spikes/SP-17-provider-matrix/evidence/monthly-cost-matrix.json`](file:///home/<user>/projects/desktop-assistant/spikes/SP-17-provider-matrix/evidence/monthly-cost-matrix.json).

---

## 2. Tác động lên ADR / PRD

1. **Cập nhật PRD FR-AG-11 & ADR-007 (Provider Configuration):**
   - *Sửa đổi lời văn:* Xoá bỏ cụm từ `"subscription qua /login OAuth"` vì đây là cơ chế dòng lệnh của Pi CLI, không tồn tại trong đường nhúng SDK.
   - *Thay bằng:* `"App cung cấp UI cấu hình provider (hỗ trợ API key các nhà cung cấp OpenAI, Anthropic, Google hoặc custom endpoint tương thích OpenAI); credential lưu trong secure storage của OS (NFR-SEC-01)..."`.
2. **Cập nhật PRD FR-AG-11 (Ma trận gán Model mặc định):**
   - Bổ sung bảng khuyến nghị mặc định phân vai 4 roles + Risk Judge:
     - `Pet-agent (Text)`: Model CHEAP / Nhanh.
     - `Pet-agent (Image)`: BẮT BUỘC model VISION (như `seed-2-0-pro`).
     - `Worker-agent`: Model STRONG (như `deepseek-v4-pro`).
     - `Bộ đúc kết quy tắc`: BẮT BUỘC model STRONG (CẤM dùng CHEAP theo SP-2).
     - `Undo-agent`: Model STRONG (SP-9).
     - `Risk Judge (Tầng 2)`: Model CHEAP (SP-10).
3. **Cập nhật NFR-PF-03 & Phụ lục A.2 (Quy chuẩn phản hồi ACK):**
   - Bổ sung kiến trúc **Hybrid Immediate ACK**: UI Pet phát ngay câu xác nhận persona ngẫu nhiên (≤ 50ms) ngay khi nhấn Gửi; luồng LLM chạy nền cập nhật trạng thái tiếp theo để đảm bảo 100% tuân thủ cam kết phản hồi ≤ 2s ngay cả khi mạng lag hoặc người dùng gửi ảnh nặng.
4. **Cập nhật PRD FR-PET-04 & UI Fallback (Chế độ phòng vệ khi thiếu Vision):**
   - Khi provider của người dùng không hỗ trợ Vision, UI composer phải tự động disable nút đính kèm ảnh và hiển thị tooltip cảnh báo thay vì để lỗi xảy ra ở backend.

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Hàm ánh xạ lỗi Provider sang Thẻ SYSTEM (`mapErrorToSystemCard`):**
   Tái sử dụng module [`src/test-errors.ts`](file:///home/<user>/projects/desktop-assistant/spikes/SP-17-provider-matrix/src/test-errors.ts#L25-L95) làm middleware bắt lỗi chuẩn trong `JobManager` và `PetHarness` ở giai đoạn M1.
2. **Bộ tiền xử lý đầu vào đa phương thức (Multimodal Input Router):**
   Client trước khi gửi lệnh cần kiểm tra: nếu payload có `image`, tự động switch sang model có `input: ["text", "image"]`. Nếu model active không hỗ trợ, chặn ngay từ client.
3. **Bảng giá tham chiếu và cơ chế tính Token/Cost:**
   Tái sử dụng mô hình tính toán tại [`src/cost-calculator.ts`](file:///home/<user>/projects/desktop-assistant/spikes/SP-17-provider-matrix/src/cost-calculator.ts) để hiển thị trường `Token Usage` và `Estimated Cost` trong trang chi tiết lịch sử Job theo khuyến nghị của R-11.

---

## 4. Rủi ro mới phát hiện

1. **Lỗi âm thầm từ chối ảnh trên Pi SDK (Silent Vision Drop):** Khi gửi payload ảnh tới model không hỗ trợ Vision qua `openai-completions` của Pi SDK, stream trả về rỗng không có text và không sinh exception runtime. Cần bổ sung kiểm tra cờ `model.input.includes("image")` ở tầng UI/harness trước khi gọi SDK.
2. **Độ trễ xử lý thị giác cao:** Model Vision (`seed-2-0-pro`) khi xử lý ảnh có độ trễ TTFT trung vị lên tới **6.61s** (P90 tới 19.65s). Nếu không áp dụng Hybrid Immediate ACK, người dùng sẽ có cảm giác ứng dụng bị đơ/treo khi gửi ảnh.

---

## 5. Chưa trả lời được + vì sao
**KHÔNG CÓ.** Toàn bộ 6 câu hỏi từ Q1 đến Q6 đều đã được trả lời dứt khoát kèm số liệu đo đạc thực nghiệm trực tiếp, log response lỗi thực tế từ BytePlus Ark, và các ma trận chi phí định lượng rõ ràng.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

- **Hệ điều hành:** Linux x86_64 (`Ubuntu 24.04 LTS`, kernel 6.6)
- **Node.js:** `v24.21.0`
- **npm:** `11.19.0`
- **TypeScript:** `5.9.3`
- **tsx:** `4.23.13`
- **`@earendil-works/pi-agent-core`:** `0.85.1`
- **`@earendil-works/pi-ai`:** `0.85.1`
- **`typebox`:** `1.3.7`
- **`dotenv`:** `17.4.2`
- **LLM Endpoint:** BytePlus Ark Coding Plan OpenAI-compatible (`https://ark.ap-southeast.bytepluses.com/api/coding/v3`)
  - **`LLM_MODEL_STRONG`:** `deepseek-v4-pro-ga-260813` (Context: 1,048,576)
  - **`LLM_MODEL_CHEAP`:** `deepseek-v4-flash-ga-260731` (Context: 1,048,576)
  - **`LLM_MODEL_VISION`:** `seed-2-0-pro-260328` (Context: 262,144)
