# ĐẦU VÀO CHO SPIKE — ngữ cảnh không bí mật

> File này **được commit**. Nó mô tả môi trường spike để agent hiểu mình đang
> làm việc với cái gì. Mọi khoá và credential nằm ở `spikes/.env.local` và
> `spikes/secrets/`, cả hai đều bị `.gitignore` loại trừ.
>
> Trạng thái: ✅ **ĐẦU VÀO ĐÃ ĐỦ** (11/09/2026) — LLM, Notion ×3, Google đều
> kiểm chứng thật. `verify-inputs.sh`: 10 đạt · 0 hỏng · 0 chưa điền.
> Còn chờ: duyệt 20 câu trong `spikes/fixtures/README.md`, và một máy Windows.

---

## 1. LLM

| Mục | Giá trị | Ghi chú |
| --- | --- | --- |
| Nhà cung cấp / endpoint | BytePlus Ark — `https://ark.ap-southeast.bytepluses.com/api/coding/v3` | OpenAI-compatible, gói coding plan |
| Model khả dụng | catalog 56 model, gói coding plan mở một tập con | Model ngoài gói trả "does not support the coding plan feature" |
| STRONG (worker, undo) | `deepseek-v4-pro-ga-260813` | ctx 1.048.576 / out 393.216 · KHÔNG có vision |
| CHEAP (pet, risk judge) | `deepseek-v4-flash-ga-260731` | ctx 1.048.576 / out 393.216 · KHÔNG có vision |
| VISION (đầu vào ảnh) | `seed-2-0-pro-260328` | ctx 262.144 / out 131.072 · có cả tool calling |
| Có tool calling? | ✅ đã gọi thật, cả 3 model | Xác nhận bằng `spikes/scripts/verify-inputs.sh` |
| Có vision? | ✅ chỉ họ Seed 2.0 — Ark từ chối ảnh nhỏ hơn 14px | Thiếu thì nhánh đầu vào ảnh (FR-PET-04) không kiểm chứng được |

---

## 2. Notion

**Đầu vào duy nhất cần cung cấp: 3 token.** Không có biến page ID hay database
ID nào — agent tự dò bằng `POST /v1/search` và ghi kết quả ra
`spikes/fixtures/notion.json`. Lý do: cái gì dò được thì không bắt người điền.

| Workspace | Biến | Vai trò trong SP-1 | Trạng thái |
| --- | --- | --- | --- |
| `spike-a-simple` | `NOTION_TOKEN_A` | Schema đơn giản — Title, Status, Due date | ✅ page gốc `spike a` |
| `spike-b-complex` | `NOTION_TOKEN_B` | Schema phức tạp — thêm Assignee, Tags, Relation, Rollup, Formula | ✅ page gốc `spike b` |
| `spike-c-order` | `NOTION_TOKEN_C` | Có thứ tự — thêm Priority, Order (number) | ✅ page gốc `spike c` |

Database do agent tạo, người dùng chỉ cần cấp quyền vào một page trống. Ba
workspace phải khác schema thật sự: SP-1/Q4 (Notion không có thuộc tính thứ tự
native, "sắp xếp lại task" ánh xạ vào đâu) và Q6 (schema lạ: rollup, formula,
relation) hỏi chính xác về sự khác biệt đó. Ba workspace giống nhau thì spike
chỉ trả lời được một phần.

**Xác nhận phạm vi phá hoại:** cả ba workspace là workspace test dùng một lần,
agent được phép tạo / sửa / archive / undo thật.

---

### Môi trường Notion đã dựng — 11/09/2026

| Workspace | Database | Dòng | Thuộc tính |
| --- | --- | --- | --- |
| `spike-a-simple` | Tasks | 12 | Name, Status (select), Due date |
| `spike-b-complex` | Projects | 4 | Name, Status |
| `spike-b-complex` | Tasks | 14 | + Assignee (people), Tags (multi_select), **Project (relation)**, **Project status (rollup)**, **Days left (formula)** |
| `spike-c-order` | Tasks | 13 | + Priority (select), **Order (number)** |

ID cụ thể nằm ở `spikes/fixtures/notion.json`, sinh tự động, không sửa tay.
Dựng lại bằng `spikes/scripts/notion-setup.py` và `notion-setup-b.py`.

Rollup và Formula đã kiểm chứng **tính ra giá trị thật**, không chỉ tồn tại:
`Days left=8`, `Project status=['Đang chạy']`.

### Phát hiện sớm cho SP-1 — kiểm chứng bằng API thật

1. **Notion API TẠO ĐƯỢC property kiểu `status`.** Niềm tin phổ biến rằng phải
   thay bằng `select` là đã lỗi thời. Đọc ngược schema xác nhận `type: status`
   với options mặc định (Not started / In progress / Done), và ghi giá trị vào
   thành công. Lưu ý: options do Notion sinh, không tự khai lúc tạo.
   → SP-1 phải thử cả `status` lẫn `select`, vì hai kiểu này hành xử khác nhau
   khi ghi và khi dựng snapshot cho undo (FR-NT-04).

2. **Rollup phải thêm SAU khi relation tồn tại.** Không khai chung một lượt lúc
   tạo database được — phải `POST /databases` tạo relation trước, rồi `PATCH`
   thêm rollup. Ràng buộc thứ tự này phải phản ánh trong connector manifest
   (FR-CF-01) nếu manifest cho phép tạo schema.

3. **Validate định dạng trước, quyền sau.** ID sai dạng UUID trả `400
   validation_error`; ID đúng dạng mà không có quyền trả `404`. Connector phải
   phân biệt hai lỗi này — nhầm lẫn sẽ báo sai nguyên nhân cho người dùng.

### ⚠️ Sai lệch năng lực giữa token spike và token sản phẩm — ĐÃ KIỂM CHỨNG 11/09/2026

Spike dùng **internal integration** (PRD §13.5), sản phẩm dùng **public
integration qua OAuth** (FR-NT-01). Hai loại này khác nhau **về năng lực**,
không chỉ khác cách xác thực. Đã xác nhận bằng lỗi thật từ Notion API:

> *"Provide a `parent.page_id` or `parent.database_id` parameter to create a
> page, or use a public integration with `insert_content` capability.
> Internal integrations aren't owned by a single user, so creating
> workspace-level private pages is not supported."*

| Thao tác | Internal (spike) | Public/OAuth (sản phẩm) |
| --- | --- | --- |
| Tạo page trong nhánh được cấp quyền | ✅ | ✅ |
| Tạo page **cấp workspace** | ❌ không hỗ trợ | ✅ được |

**Hệ quả bắt buộc cho SP-1:** không được kết luận "connector Notion không tạo
được page cấp workspace" rồi ghi vào connector manifest (FR-CF-01). Đó là giới
hạn của loại token dùng để thử, KHÔNG phải giới hạn của sản phẩm. Mọi năng lực
không tái hiện được bằng internal token phải gắn nhãn **CHƯA KIỂM CHỨNG — cần
public integration**, không gắn nhãn "không hỗ trợ".

### Mô hình quyền hai tầng — đã kiểm chứng

Notion tách quyền làm hai tầng độc lập, phải cấp CẢ HAI mới hoạt động:

| Tầng | Cấp ở đâu | Nghĩa |
| --- | --- | --- |
| **Capabilities** | Trang cấu hình connection | Được phép làm gì: Read / Update / Insert content |
| **Content access** | Tab Content access, hoặc `···` → Connections trên từng page | Được làm lên cái gì |

Bằng chứng: với capabilities đủ cả ba nhưng content access rỗng, `POST /search`
trả về **0 đối tượng** dù workspace có 8 page. Token hợp lệ (`/users/me` trả
200, bot `spike-c` @ `spike-c-order`) — tức deny-by-default với nội dung.

Quyền content access **thừa kế xuống toàn nhánh**, gồm cả đối tượng tạo về sau,
nên cấp một gốc là đủ cho cả cây bên dưới.

Ngoài ra `User capabilities` là trục quyền RIÊNG, không bị chặn bởi content
access: với mức "Read user information including email addresses", bot liệt kê
được thành viên workspace dù không thấy nội dung nào. Với sản phẩm, FR-CF-04
(scope tối thiểu) nên chọn mức thấp nhất đủ dùng.

---

## 3. Google — Gmail / Drive ✅ ĐÃ KIỂM CHỨNG THẬT (11/09/2026)

**Quyết định:** hộp thư THẬT, chỉ đọc. `GOOGLE_USE_REAL_MAILBOX=true`.
Nội dung email đi qua LLM provider cấu hình ở `LLM_BASE_URL`.

| Hạng mục | Kết quả |
| --- | --- |
| Project | `desktop-assistant-spike-508308` |
| OAuth client | Desktop app, `installed`, redirect `http://localhost` |
| Tài khoản | `owner@example.com` (Test user) |
| Luồng consent | ✅ chạy trọn: authorize → code → token, có PKCE S256 |
| Scope được cấp | `gmail.readonly` + `drive.readonly` — đúng cả hai, không thiếu |
| Gmail đọc thật | ✅ 1.454 thư trong hộp, đọc được header/subject |
| Drive đọc thật | ✅ liệt kê được file và folder |
| `refresh_token` | ✅ CÓ, và **đã kiểm chứng dùng được** — lấy access_token mới rồi gọi Gmail thành công |
| access_token | hết hạn sau 3599 giây |

**Kết luận cho SP-13:** cấu hình BYO OAuth client hoạt động đầy đủ. Hai API đã
bật, scope đã khai, test user đã thêm — cả ba xác nhận gián tiếp qua việc luồng
chạy trót lọt.

**Mốc theo dõi hạn 7 ngày (SP-13/Q3):** consent lúc **2026-09-11 09:24 UTC**
→ refresh token dự kiến hết hạn khoảng **2026-09-18**. Khi tới hạn, quan sát
mã lỗi thật mà Google trả về để SP-13 trả lời Q3 bằng bằng chứng thay vì
trích dẫn tài liệu. Token lưu tại `spikes/secrets/google-tokens.json` kèm
trường `__granted_at`.

**Vẫn không trả lời được — SP-13/Q4:** user type Internal cần Google Workspace,
anh không có. Hạn 7 ngày do đó là thực tế cố định, không có đường vòng.

---

## 3b. Outlook / Microsoft 365 — ĐÃ LOẠI KHỎI PHẠM VI (PRD v2.1, 11/09/2026)

Connector Outlook bị loại theo quyết định product owner. **Spike SP-14
(Entra ID) không còn trong kế hoạch M0** — tổng số spike còn **16**.

Hệ quả agent phải biết: Gmail qua BYO OAuth client là đường email DUY NHẤT.
Không còn phương án email một-click nào, và hạn refresh token 7 ngày ở
trạng thái Testing không có đường vòng. Chi tiết tại PRD §13.4, §13.6, R-12.

---

## 4. Những gì KHÔNG có — và hệ quả

> Agent đọc mục này trước để khỏi mất công đi tìm thứ không tồn tại.

| Thiếu | Spike hỏng phần nào | Xử lý |
| --- | --- | --- |
| Google Workspace | SP-13/Q4 — user type Internal | Không kiểm chứng được. Mặc định kẹt ở External + Testing → **refresh token hết hạn 7 ngày, phải re-consent hằng tuần**. Ghi nhận là đặc tính, không phải lỗi. PRD §13.6 có nhắc lối thoát Internal — lối đó không áp dụng ở đây |
| Apple Developer Program | SP-16 — notarization | Không dry-run được notarize. Vẫn làm: nghiên cứu pipeline, checklist mua sắm, codesign ad-hoc cục bộ, dry-run auto-update trọn vẹn trên Windows |
| Provider LLM thứ hai | SP-10, SP-17 — so sánh chéo | Không chặn. Nếu endpoint phơi ra ≥2 model thì vẫn so sánh được theo mức năng lực |

**Không mục nào ở trên nằm trên đường găng.** SP-1, SP-6, SP-7, SP-8 chạy bình thường.

---

## 5. Máy chạy spike

### 5.1. Trạng thái hiện tại — cập nhật 13/09/2026

| Máy | Spike | Trạng thái |
| --- | --- | --- |
| Linux (headless) | SP-1, 2, 4, 6, 8, 9, 10, 15, 17, 19, 21 + phần logic SP-12 | ✅ đã xong |
| Windows (Claude Code **native**, không WSL) | SP-0, 3, 7, 11, 12/Q1, 13, 16, 18, 20 | ✅ đã xong |
| macOS (**Mac mini** M1, macOS 26.5.2, Antigravity chạy qua giao diện ngay trên máy) | SP-0/mac, 3/mac, 7/mac, 11/mac, 12/mac, 16/mac, 18/mac, SP-22 | ✅ **đã xong 13/09/2026** — kết quả ở `docs/spike-roadmap-macos.md` §4; bốn phát hiện đổi đặc tả đã vào spec qua `req-023-macos-platform-baseline` |

Nhánh macOS đã mở lại và chạy xong đúng theo điều kiện thoát ghi ở 5.2: trước
khi bắt đầu M3. Mọi ô mà 5.2 liệt kê là bỏ ngỏ nay đã có report thật; bảng ở 5.2
giữ nguyên làm hồ sơ quyết định, với kết quả ghi kèm từng dòng.

Rủi ro mà 5.2 gọi là "chấp nhận có ý thức" — thao tác OS sâu trên macOS có thể
cần native module riêng — đã thành hiện thực một nửa. macOS **không** cần native
để giữ focus như Windows, nhưng phần native còn lại là AppKit và không dùng
chung dòng mã nào với Win32, nên workstream native của M1 là hai khối chứ không
phải một.

### 5.2. QUYẾT ĐỊNH 11/09/2026: HOÃN macOS *(đã kết thúc — giữ làm hồ sơ)*

Product owner quyết định tạm chưa test và chưa spike trên macOS, tập trung
Windows trước.

### Hệ quả phải mang theo

NFR-CP-01 yêu cầu sản phẩm chạy trên CẢ Windows và macOS. Hoãn macOS nghĩa là
sáu spike chỉ kết luận được một nửa, và phải gắn nhãn **"Windows only — macOS
CHƯA KIỂM CHỨNG"** thay vì nhãn ĐI/KHÔNG ĐI:

| Spike | Phần bỏ ngỏ | Mức nghiêm trọng |
| --- | --- | --- |
| **SP-7** cửa sổ pet ✅ | Không cướp focus, click-through, always-on-top trên macOS — **đã đo: 10/10 đạt bằng Electron thuần** | 🔴 **Cao** — SP-7 nằm trên đường găng, và R-3 của PRD nêu đích danh macOS là chỗ khó nhất. Gate pha 1 sẽ đóng với dữ liệu thiếu ở đúng OS rủi ro nhất |
| **SP-3** Electron + Rive ✅ | fps, anti-alias viền, tài nguyên idle trên macOS — **đã đo: 60 fps, viền sạch, render qua Metal** | 🟠 Trung |
| **SP-11** secure storage ✅ | Keychain — **đã đo: hoạt động, nhưng buộc phải ký bằng Apple Developer ID** | 🟠 Trung |
| **SP-12/Q1** native rebuild ✅ | ABI arm64/darwin cho `better-sqlite3` — **đã đo; kèm phát hiện lớn hơn: bắt buộc bật `fullfsync`** | 🟠 Trung |
| **SP-16** ký số ✅ | Apple notarization — **đã dry-run trọn vẹn; việc mua không chặn M0 nhưng phải xong trước Closed Beta** | 🟡 Thấp ở giai đoạn này |
| SP-0 hạ tầng | — | 🟢 Không ảnh hưởng, vốn là kiểm chứng theo từng máy |

**SP-13 không bị ảnh hưởng** — consent Google chạy trên Windows là đủ.

> **Cập nhật 13/09/2026:** ngoài sáu spike trên, `SP-18` (pet sống trên desktop,
> chạy sau khi bảng này được viết) cũng ghi phần macOS là hoãn, và phát sinh
> thêm một vùng không có đối ứng trên Windows là quyền hệ thống TCC cùng luồng
> onboarding. Cả hai đã có spike trong `docs/spike-roadmap-macos.md`:
> `SP-18/mac` và `SP-22`.

### Rủi ro chấp nhận có ý thức

ADR-009 dự liệu rằng thao tác OS sâu trên macOS nhiều khả năng cần native
module riêng. Nếu điều đó đúng, phát hiện muộn sẽ đắt. Điều kiện thoát hợp lý:
mở lại nhánh macOS **trước khi bắt đầu M3** (giai đoạn lặp thị giác cho pet),
không muộn hơn.

> **Điều kiện thoát đã được thực hiện ngày 13/09/2026**, trước khi M3 bắt đầu.
> Rủi ro nêu ở đoạn trên — native module riêng cho macOS — chính là câu hỏi
> trung tâm của `SP-7/mac` và `SP-18/mac`.
