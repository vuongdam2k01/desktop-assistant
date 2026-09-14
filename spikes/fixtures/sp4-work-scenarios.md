# SP-4 — Bộ kịch bản giao việc end-to-end trên Notion (S-01..S-20)

> **Ground truth đóng băng.** Soạn mù ngày 11/09/2026. Agent chấm điểm KHÔNG sửa file
> này; thay đổi → `sp4-work-scenarios-v2.md` kèm lý do. Bộ này đồng thời là "bộ 20
> lệnh chuẩn" của release criteria #7 / US-2.1 AC3.

**Cách đo (FR-AG-10):** đo TRẠNG THÁI CUỐI trên Notion sau khi job kết thúc, kiểm chứng
bằng API. Agent được phép hỏi qua `ask_user` nhiều lượt; người đóng vai người dùng trả
lời đúng theo dòng "Câu trả lời của người dùng" ghi trong mục. KHÔNG chấm độ chính xác
parse một lượt. Hỏi khi thiếu thông tin then chốt = đúng; không hỏi mà đoán = lỗi;
hỏi khi đã đủ thông tin = lỗi (FR-AG-05). Mode phê duyệt khi chạy bộ này: **off**
(WF-2 happy path) — hook không chen vào, để đo riêng năng lực agent.

**Đã chốt 11/09/2026:** các đáp án từng treo (tiêu chí "cân bằng lại", văn bản vs
ảnh ở S-17) đã được product owner chốt — xem `README.md` §5. Dòng "Câu trả lời của
người dùng" dưới đây là bản cuối, người đóng vai người dùng khi chấm phải theo đúng.

## Quy ước

- **Mốc thời gian:** Thứ Sáu **11/09/2026 14:30** (Asia/Ho_Chi_Minh). Quy đổi: hôm
  qua = 10/09; thứ 2 tuần sau = 14/09; thứ 3 = 15/09; thứ 4 = 16/09; thứ 5 = 17/09;
  thứ 6 tuần sau = 18/09; "tuần này" còn lại = 11–13/09; "cuối tháng" = 30/09.
- **Nhân vật:** người dùng làm 2 dự án: *Mobile app Vinmart* (PM Linh, khách ngoài) và
  *HR portal nội bộ* (PM anh Tuấn). Đồng nghiệp: Hùng (dev), Trang (designer).
- **Seed** — trạng thái ban đầu chuẩn của từng workspace. Mỗi kịch bản ghi "Seed X
  nguyên bản" hoặc "Seed X + thay đổi". `created_by` ghi tên; task do app tạo ghi
  `bot`. Người dựng seed tạo page bằng tài khoản tương ứng, hoặc nếu không thể thì ghi
  created_by giả vào một thuộc tính text `_creator` và báo trong biên bản chạy.

### Seed A — workspace `spike-a-simple`, DB `Tasks` (Title · Status · Due date)

| # | Title | Status | Due date | created_by | created |
| --- | --- | --- | --- | --- | --- |
| A1 | Viết docs API HR portal | In progress | 2026-09-15 | user | 09/09 |
| A2 | Review PR #212 của Hùng | Not started | 2026-09-11 | user | 10/09 |
| A3 | Gửi report tuần cho Linh | Not started | 2026-09-12 | user | 10/09 |
| A4 | Fix bug đăng nhập SSO | In progress | 2026-09-18 | Tuấn | 08/09 |
| A5 | Họp retro sprint 14 | Not started | 2026-09-16 | Linh | 07/09 |
| A6 | Chuẩn bị demo Vinmart | Not started | 2026-09-22 | user | 04/09 |

### Seed B — workspace `spike-b-complex`

DB `Projects`: **P1** "Mobile app Vinmart" · **P2** "HR portal nội bộ". DB `Tasks` có
thêm Assignee, Tags (bug/feature/docs/meeting), Relation `Project`, Rollup, Formula.

| # | Title | Status | Due date | Assignee | Tags | Project | created_by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Design review màn checkout | In progress | 2026-09-14 | Trang | feature | P1 | Linh |
| B2 | Weekly report Vinmart | Not started | 2026-09-12 | user | docs | P1 | user |
| B3 | Monthly report HR | Not started | 2026-09-30 | user | docs | P2 | user |
| B4 | Fix crash khi upload avatar | Not started | 2026-09-17 | Hùng | bug | P2 | Tuấn |
| B5 | Viết test cho module payroll | Not started | 2026-09-21 | user | feature | P2 | user |
| B6 | Sync với khách về contract | Done | 2026-09-08 | user | meeting | P1 | user |
| B7 | Setup CI cho repo mobile | In progress | 2026-09-16 | user | feature | P1 | user |

### Seed C — workspace `spike-c-order`, DB `Tasks` (+ Priority, Order; Order nhỏ = làm trước)

| # | Order | Title | Priority | Status | Due date | created_by |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | 1 | Fix crash màn thanh toán | High | In progress | 2026-09-12 | user |
| C2 | 2 | Viết docs onboarding | Medium | Not started | 2026-09-18 | user |
| C3 | 3 | Review PR #212 của Hùng | Medium | Not started | 2026-09-11 | user |
| C4 | 4 | Refactor module auth | Low | Not started | 2026-09-25 | user |
| C5 | 5 | Trả lời feedback QA round 2 | High | Not started | 2026-09-15 | Linh |
| C6 | 6 | Update thư viện lên RN 0.80 | Low | Not started | 2026-10-02 | user |

### Seed Gmail / Drive (chỉ S-18..S-20) — phải gieo vào hộp thư / Drive thật trước khi chạy

- **G1** — From: `tuan.pham@<công ty>` · Subject: `Re: Contract HR portal - action items` ·
  Ngày 10/09 · Body: "Chốt sau meeting: (1) [user] gửi bản estimate phase 2 trước
  thứ 4 tuần sau; (2) Hùng fix môi trường staging; (3) [user] review lại điều khoản SLA
  với legal, deadline 19/9. Thanks."
- **G2** — From: `ngoc.tran@vinmart-demo.example` · Subject: `Dời lịch demo` · Ngày
  11/09 09:10 · Body: "Chào em, bên chị bận họp quý nên xin dời buổi demo app sang
  thứ 5 24/9 nhé, giờ giữ nguyên 10h. Cảm ơn em."
- **D1** — Drive file `Spec_Vinmart_Checkout_v3` (Google Docs), 4 heading cấp 1:
  `1. Overview`, `2. Cart`, `3. Payment`, `4. Order confirmation`; mỗi mục 2–3 đoạn
  lorem nghiệp vụ.

---

## Nhóm 1 — Đơn giản, rõ ràng (5)

### S-01
- **Workspace:** A
- **Trạng thái Notion ban đầu:** Seed A nguyên bản.
- **Lệnh người dùng:** "thêm task fix login vinmart vào notion, dl thứ 5"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG
- **Agent NÊN hỏi lại không?** KHÔNG — database mặc định duy nhất, tiêu đề và ngày đủ.
- **Trạng thái cuối đúng:**
  - Tồn tại đúng 1 page mới trong DB Tasks; Title chứa "fix login" và "Vinmart"
    (không phân biệt hoa thường); Due date = `2026-09-17`; Status = Not started.
  - 6 task seed không đổi thuộc tính nào.
- **Được phép sai lệch ở đâu:** Viết hoa/chuẩn hoá tiêu đề ("Fix login Vinmart"); có
  thể thêm nội dung body ghi nguồn lệnh.
- **Độ phức tạp:** đơn

### S-02
- **Workspace:** C
- **Trạng thái Notion ban đầu:** Seed C nguyên bản.
- **Lệnh người dùng:** "xong cái review PR của Hùng rồi nhé"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG
- **Agent NÊN hỏi lại không?** KHÔNG — chỉ một task khớp "review PR" + "Hùng".
- **Trạng thái cuối đúng:**
  - C3 Status = Done. C3 Order vẫn = 3, Priority, Due date không đổi.
  - Không task nào khác đổi; không tạo task mới.
- **Được phép sai lệch ở đâu:** Không có.
- **Độ phức tạp:** đơn

### S-03
- **Workspace:** A
- **Trạng thái Notion ban đầu:** Seed A nguyên bản.
- **Lệnh người dùng:** "push the SSO login bug to next week, monday is fine"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG
- **Agent NÊN hỏi lại không?** KHÔNG — một task khớp (A4), ngày đích nói rõ.
- **Trạng thái cuối đúng:**
  - A4 Due date = `2026-09-14`. Status của A4 giữ In progress.
  - Các task khác không đổi. (A4 do Tuấn tạo — ở mode off không có gì chặn; kịch bản
    này cố ý để đo agent có tự ngại "task người khác" mà hỏi thừa không.)
- **Được phép sai lệch ở đâu:** Không có.
- **Độ phức tạp:** đơn

### S-04
- **Workspace:** C
- **Trạng thái Notion ban đầu:** Seed C nguyên bản.
- **Lệnh người dùng:** "thêm task 'viết migration script cho bảng users', prio high, dl thứ 4, xếp trước task viết docs"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG
- **Agent NÊN hỏi lại không?** KHÔNG — "task viết docs" khớp duy nhất C2.
- **Trạng thái cuối đúng:**
  - Page mới: Title chứa "migration script" và "users"; Priority = High; Due date =
    `2026-09-16`; Status = Not started.
  - Thứ tự theo Order tăng dần sau job: C1 < **mới** < C2 < C3 < C4 < C5 < C6.
- **Được phép sai lệch ở đâu:** Cách gán số Order: (a) dồn C2..C6 mỗi cái +1 và mới =
  2, hoặc (b) mới = 1.5 / một số nằm giữa 1 và 2 mà không đụng task khác. Cả hai đều
  đúng miễn thứ tự tương đối như trên.
- **Độ phức tạp:** vừa

### S-05
- **Workspace:** B
- **Trạng thái Notion ban đầu:** Seed B nguyên bản.
- **Lệnh người dùng:** "tạo task 'họp align scope phase 2 với Linh' bên project vinmart, giao cho Linh, tag meeting, thứ 3 tuần sau"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG
- **Agent NÊN hỏi lại không?** KHÔNG
- **Trạng thái cuối đúng:**
  - Page mới trong DB Tasks: Title chứa "align scope phase 2"; Assignee = Linh (user
    Notion tên Linh, không phải text); Tags ∋ meeting; Relation Project = P1; Due date
    = `2026-09-15`; Status = Not started.
  - DB Projects không có page mới. Không task seed nào đổi.
- **Được phép sai lệch ở đâu:** Tags có thể thêm tag khác ngoài meeting? KHÔNG — chỉ
  meeting. Title có thể bỏ "với Linh".
- **Độ phức tạp:** vừa (2 thao tác: tra user Linh + tạo page với relation)

## Nhóm 2 — "Cân bằng lại task" (5) — chỗ mơ hồ nhất (PRD §10.1, idea brief §10.1)

### S-06
- **Workspace:** C
- **Trạng thái Notion ban đầu:** Seed C nguyên bản.
- **Lệnh người dùng:** "Hãy thêm cho tao task làm slide pitch cho Vinmart, dl thứ 3, cân bằng lại các công việc khác"
- **Đính kèm:** không
- **Mơ hồ?** CÓ — "cân bằng lại" không có tiêu chí (deadline? priority? khối lượng?).
- **Agent NÊN hỏi lại không?** CÓ — đúng MỘT câu gộp kèm option, ví dụ: "Cân bằng
  theo cách nào: (A) sắp Order theo deadline, (B) sắp theo Priority rồi deadline,
  (C) chỉ chèn task mới, không đụng cái khác?". Câu trả lời của người dùng khi
  chấm: **(A) theo deadline, không đổi Priority hay deadline của ai**.
- **Trạng thái cuối đúng:**
  - Page mới: Title chứa "slide pitch" và "Vinmart"; Due date = `2026-09-15`; Status
    = Not started; Priority ∈ {Medium, không đặt}.
  - Thứ tự Order tăng dần: C3 (09-11) < C1 (09-12) < {mới, C5} (09-15, thứ tự giữa
    hai cái này tuỳ) < C2 (09-18) < C4 (09-25) < C6 (10-02).
  - Không Due date, Priority, Status nào của C1..C6 thay đổi.
- **Được phép sai lệch ở đâu:** Giá trị Order tuyệt đối; thứ tự giữa mới và C5;
  Priority của task mới; thứ tự hỏi–tạo (tạo trước rồi hỏi cách cân bằng cũng chấp
  nhận).
- **Độ phức tạp:** phức (tạo 1 + đổi Order 5–6 task)

### S-07
- **Workspace:** A
- **Trạng thái Notion ban đầu:** Seed A nguyên bản.
- **Lệnh người dùng:** "tuần này ngập quá, dồn bớt việc sang tuần sau đi"
- **Đính kèm:** không
- **Mơ hồ?** CÓ — task nào, bao nhiêu, sang ngày nào.
- **Agent NÊN hỏi lại không?** CÓ — một câu gộp. Câu trả lời của người dùng khi
  chấm: **"cái nào chưa bắt đầu thì dời, đang làm thì giữ; ngày nào tuần sau cũng
  đc"**. Nếu agent tự ý dời mà không hỏi → LỖI dù kết quả trùng.
- **Trạng thái cuối đúng:**
  - A2 (09-11, Not started) và A3 (09-12, Not started) có Due date ∈ [2026-09-14,
    2026-09-18], và Due(A2) ≤ Due(A3) (giữ thứ tự tương đối).
  - A1 (In progress, 09-15) không đổi. A4, A5, A6 không đổi (deadline đã ở tuần sau
    hoặc xa hơn). Không tạo/archive task nào. Status không đổi.
- **Được phép sai lệch ở đâu:** Ngày cụ thể trong tuần sau; agent có thể dời cả hai
  vào cùng một ngày.
- **Độ phức tạp:** vừa

### S-08
- **Workspace:** C
- **Trạng thái Notion ban đầu:** Seed C nguyên bản.
- **Lệnh người dùng:** "reorder everything by deadline pls, earliest first"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG — tiêu chí nói rõ.
- **Agent NÊN hỏi lại không?** KHÔNG — hỏi là lỗi.
- **Trạng thái cuối đúng:**
  - Order tăng dần: C3 (09-11) → C1 (09-12) → C5 (09-15) → C2 (09-18) → C4 (09-25) →
    C6 (10-02). Với Order gán liền 1..6 thì C3=1, C1=2, C5=3, C2=4, C4=5, C6=6.
  - Không thuộc tính nào khác đổi (kể cả C5 do Linh tạo).
- **Được phép sai lệch ở đâu:** Giá trị Order không cần liền nhau, chỉ cần thứ tự.
- **Độ phức tạp:** vừa (4 task đổi Order — C1, C3, C2, C5; C4, C6 giữ nguyên)

### S-09
- **Workspace:** C
- **Trạng thái Notion ban đầu:** Seed C nguyên bản.
- **Lệnh người dùng:** "cái trả lời feedback QA khẩn lắm, đẩy lên đầu đi, còn lại lùi hết xuống"
- **Đính kèm:** không
- **Mơ hồ?** CÓ (nhẹ) — "lùi hết xuống" = dồn Order hay chỉ cần C5 đứng đầu?
- **Agent NÊN hỏi lại không?** KHÔNG — cả hai cách hiểu cho cùng kết quả kiểm chứng
  được (C5 đứng đầu, thứ tự còn lại giữ nguyên). Riêng câu hỏi "có nâng Priority
  không" — ground truth: KHÔNG đụng Priority (C5 đã High).
- **Trạng thái cuối đúng:**
  - Order tăng dần: C5 < C1 < C2 < C3 < C4 < C6.
  - Priority, Due date, Status của mọi task không đổi.
- **Được phép sai lệch ở đâu:** (a) C5=1, C1..C4 +1, C6=6; hoặc (b) C5=0 và không đụng
  ai. Cả hai đúng.
- **Độ phức tạp:** vừa

### S-10
- **Workspace:** B
- **Trạng thái Notion ban đầu:** Seed B nguyên bản.
- **Lệnh người dùng:** "cân đối lại việc giữa tao với Linh đi, tao đang ngập, Linh đang rảnh"
- **Đính kèm:** không
- **Mơ hồ?** CÓ — task nào chuyển, chuyển bao nhiêu; Linh hiện không có task nào
  Assignee trong seed nên "cân đối" thực chất là "giao bớt".
- **Agent NÊN hỏi lại không?** CÓ — một câu gộp, kèm danh sách task mở của người dùng
  (B2, B3, B5, B7) làm option. Câu trả lời khi chấm: **"Weekly report Vinmart với
  Setup CI"**. Tự ý reassign không hỏi → LỖI.
- **Trạng thái cuối đúng:**
  - B2 Assignee = Linh; B7 Assignee = Linh. B3, B5 Assignee vẫn = user.
  - Không tạo task mới, không đổi Status/Due date/Project của bất kỳ task nào; B1, B4,
    B6 không đổi.
- **Được phép sai lệch ở đâu:** Không có ngoài hình thức câu hỏi.
- **Độ phức tạp:** vừa

## Nhóm 3 — Mơ hồ có chủ đích, phải hỏi lại (4)

### S-11
- **Workspace:** A
- **Trạng thái Notion ban đầu:** Seed A nguyên bản (A2 và A3 đều created 10/09).
- **Lệnh người dùng:** "xoá cái task hôm qua tạo đi, ko cần nữa"
- **Đính kèm:** không
- **Mơ hồ?** CÓ — hai task tạo hôm qua.
- **Agent NÊN hỏi lại không?** CÓ — một câu với 2 option A2 / A3. Câu trả lời khi
  chấm: **"cái report"**.
- **Trạng thái cuối đúng:**
  - A3 `archived = true`. A2 không đổi, không archived. Không task nào khác đổi.
- **Được phép sai lệch ở đâu:** Không có.
- **Độ phức tạp:** đơn (1 thao tác ghi, nhưng phải hỏi)

### S-12
- **Workspace:** B
- **Trạng thái Notion ban đầu:** Seed B nguyên bản (B2 "Weekly report", B3 "Monthly report").
- **Lệnh người dùng:** "đổi dl task report sang cuối tháng"
- **Đính kèm:** không
- **Mơ hồ?** CÓ — hai task "report"; B3 đã là 30/09.
- **Agent NÊN hỏi lại không?** CÓ — hỏi task nào (agent có thể tự suy B3 đã đúng
  cuối tháng nên ý là B2, nhưng vẫn phải xác nhận vì hậu quả là đổi deadline). Câu
  trả lời khi chấm: **"weekly"**.
- **Trạng thái cuối đúng:**
  - B2 Due date = `2026-09-30`. B3 Due date vẫn `2026-09-30`. Không thuộc tính khác đổi.
- **Được phép sai lệch ở đâu:** Nếu agent KHÔNG hỏi mà đổi B2 kèm giải thích "B3 đã
  cuối tháng" → chấm là ĐÚNG MỘT PHẦN (kết quả đúng, quy trình thiếu), ghi riêng.
- **Độ phức tạp:** đơn

### S-13
- **Workspace:** B
- **Trạng thái Notion ban đầu:** Seed B nguyên bản (DB Projects chỉ có P1, P2).
- **Lệnh người dùng:** "create a kickoff task for the new project, sometime next week"
- **Đính kèm:** không
- **Mơ hồ?** CÓ — không có project mới nào trong DB Projects; ngày mơ hồ.
- **Agent NÊN hỏi lại không?** CÓ — một câu gộp: project nào (option P1/P2/tạo mới) +
  ngày. Câu trả lời khi chấm: **"project mới là Chatbot CS cho Vinmart, tạo luôn đi;
  thứ 3"**.
- **Trạng thái cuối đúng:**
  - DB Projects có page mới Title chứa "Chatbot CS" (và/hoặc "Vinmart"); P1, P2 không đổi.
  - DB Tasks có page mới: Title chứa "kickoff"; Relation Project = page project mới;
    Due date = `2026-09-15`; Status = Not started.
- **Được phép sai lệch ở đâu:** Assignee (không nói → để trống hoặc = user đều được);
  Tags (không có hoặc meeting).
- **Độ phức tạp:** vừa (2 create + relation)

### S-14
- **Workspace:** C
- **Trạng thái Notion ban đầu:** Seed C nguyên bản (C3 due 09-11, C1 due 09-12 là hai task "tuần này").
- **Lệnh người dùng:** "dời hết sang thứ 6 nhé"
- **Đính kèm:** không
- **Mơ hồ?** CÓ — "hết" là mọi task hay chỉ task tuần này; "thứ 6" là hôm nay (11/09)
  hay tuần sau (18/09).
- **Agent NÊN hỏi lại không?** CÓ — một câu gộp cả hai ý. Câu trả lời khi chấm:
  **"mấy cái deadline tuần này thôi, sang thứ 6 tuần sau"**.
- **Trạng thái cuối đúng:**
  - C3 Due date = `2026-09-18`; C1 Due date = `2026-09-18`.
  - C2, C4, C5, C6 Due date không đổi. Order, Priority, Status không đổi.
- **Được phép sai lệch ở đâu:** Không có.
- **Độ phức tạp:** vừa (2 update)

## Nhóm 4 — Có ảnh đính kèm (3)

### S-15
- **Workspace:** A
- **Trạng thái Notion ban đầu:** Seed A nguyên bản.
- **Lệnh người dùng:** "tạo task từ cái này"
- **Đính kèm:** ảnh chụp đoạn chat Zalo. Nội dung ảnh: bong bóng tin từ "Linh (PM)"
  lúc 13:52: "e ơi làm cho c cái checklist UAT cho app Vinmart nhé, cần trc thứ 4
  tuần sau để c gửi khách". Bên dưới là tin của người dùng: "ok c". Không có gì khác.
- **Mơ hồ?** KHÔNG (đủ tiêu đề + mốc thời gian; "trước thứ 4" chấp nhận 2 cách hiểu)
- **Agent NÊN hỏi lại không?** KHÔNG
- **Trạng thái cuối đúng:**
  - Page mới: Title chứa "checklist" và "UAT" (và tuỳ ý "Vinmart"); Due date ∈
    {`2026-09-15`, `2026-09-16`}; Status = Not started.
  - Không task seed nào đổi.
- **Được phép sai lệch ở đâu:** 15 hay 16/09; có thể ghi "nguồn: Linh, Zalo" vào body.
- **Độ phức tạp:** đơn

### S-16
- **Workspace:** B
- **Trạng thái Notion ban đầu:** Seed B nguyên bản (B4 và B5 đã tồn tại).
- **Lệnh người dùng:** "add mấy cái này vào notion, cái nào có rồi thì thôi"
- **Đính kèm:** ảnh chụp Slack, channel #hr-portal, tin từ "Tuan Pham" 11:03 AM:
  "@you three things before Friday: 1) fix the avatar upload crash 2) write tests
  for the payroll module 3) update the HR onboarding doc (the one on Drive). thanks!"
  Có 1 reaction 👍.
- **Mơ hồ?** CÓ (nhẹ) — "before Friday": hôm nay đã là thứ 6 → thứ 6 tuần sau.
- **Agent NÊN hỏi lại không?** KHÔNG — người dùng đã cho quy tắc xử lý trùng; ngày
  suy được.
- **Trạng thái cuối đúng:**
  - Đúng 1 page mới trong DB Tasks: Title chứa "onboarding doc" hoặc "HR onboarding";
    Project = P2; Due date ∈ {`2026-09-17`, `2026-09-18`}; Status = Not started.
  - KHÔNG có page mới nào trùng ý B4 (avatar crash) hay B5 (payroll tests). B4, B5
    không đổi thuộc tính (kể cả Due date).
- **Được phép sai lệch ở đâu:** Assignee của task mới (trống hoặc user); Tags (docs
  hoặc trống); 17 hay 18/09.
- **Độ phức tạp:** vừa (query kiểm trùng + 1 create)

### S-17
- **Workspace:** C
- **Trạng thái Notion ban đầu:** Seed C nguyên bản.
- **Lệnh người dùng:** "tạo task chuẩn bị demo cho khách, dl thứ 5"
- **Đính kèm:** ảnh chụp Zalo, tin từ "Linh (PM)": "demo khách chốt thứ 4 tuần sau
  nhé, 10h". Tin của người dùng bên dưới: "dạ".
- **Mơ hồ?** CÓ — ảnh nói thứ 4, text nói thứ 5 (người dùng cố ý để deadline chuẩn bị
  sau ngày demo? hay gõ nhầm?).
- **Agent NÊN hỏi lại không?** Ground truth: **KHÔNG** — lệnh gõ trực tiếp của
  người dùng là nguồn chuẩn (E9 Phụ lục A.10 cùng tinh thần); agent làm theo text và
  NÊU sự lệch trong thông báo kết quả. Nếu agent hỏi một câu → chấm ĐÚNG MỘT PHẦN,
  không phải sai. (Xác nhận A/B ở README.)
- **Trạng thái cuối đúng:**
  - Page mới: Title chứa "demo"; Due date = `2026-09-17`; Status = Not started.
  - Không đổi task seed. Nếu hỏi và người dùng trả lời "thứ 5" → cùng trạng thái cuối.
- **Được phép sai lệch ở đâu:** Priority (không nói → trống hoặc Medium); Order (cuối
  danh sách hoặc bất kỳ, miễn không đổi thứ tự tương đối của C1..C6).
- **Độ phức tạp:** đơn

## Nhóm 5 — Đa connector: đọc Gmail/Drive rồi ghi Notion (3) — FR-CF-10

### S-18
- **Workspace:** B
- **Trạng thái Notion ban đầu:** Seed B nguyên bản + Gmail có G1.
- **Lệnh người dùng:** "check mail anh Tuấn về cái contract, tạo task cho mấy việc của tao trong đó"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG (mail duy nhất khớp; "việc của tao" = mục gán [user])
- **Agent NÊN hỏi lại không?** KHÔNG
- **Trạng thái cuối đúng:**
  - Đúng 2 page mới trong DB Tasks:
    1. Title chứa "estimate" và "phase 2"; Due date = `2026-09-16` (trước thứ 4 tuần
       sau → chấp nhận `2026-09-15` hoặc `2026-09-16`); Project = P2; Assignee = user.
    2. Title chứa "SLA" (và/hoặc "legal"); Due date = `2026-09-19`; Project = P2;
       Assignee = user.
  - KHÔNG tạo task cho mục (2) của Hùng. Không task seed nào đổi.
- **Được phép sai lệch ở đâu:** Tags (docs/meeting/trống); Status = Not started; body
  có thể trích mail.
- **Độ phức tạp:** phức (search mail → đọc → lọc theo người → 2 create có relation)

### S-19
- **Workspace:** A
- **Trạng thái Notion ban đầu:** Seed A nguyên bản + Drive có D1.
- **Lệnh người dùng:** "the checkout spec on drive (v3) — make me one review task per section, due next wed"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG
- **Agent NÊN hỏi lại không?** KHÔNG — file duy nhất khớp "checkout spec" + "v3".
- **Trạng thái cuối đúng:**
  - Đúng 4 page mới, mỗi page Title chứa "review" và một trong: "Overview", "Cart",
    "Payment", "Order confirmation" (mỗi tên xuất hiện đúng 1 lần).
  - Cả 4 Due date = `2026-09-16`; Status = Not started.
  - Không task seed nào đổi.
- **Được phép sai lệch ở đâu:** Tiếng Việt hoá tiêu đề ("Review mục Payment") miễn còn
  tên section; thứ tự tạo.
- **Độ phức tạp:** phức (search Drive → đọc → tách heading → 4 create)

### S-20
- **Workspace:** A
- **Trạng thái Notion ban đầu:** Seed A nguyên bản (A6 "Chuẩn bị demo Vinmart" due 09-22) + Gmail có G2.
- **Lệnh người dùng:** "khách vinmart mail báo dời demo, check rồi update lại task chuẩn bị demo giúp"
- **Đính kèm:** không
- **Mơ hồ?** KHÔNG
- **Agent NÊN hỏi lại không?** KHÔNG
- **Trạng thái cuối đúng:**
  - A6 Due date ∈ {`2026-09-23`, `2026-09-24`} (deadline chuẩn bị = ngày demo hoặc
    trước 1 ngày). Title, Status của A6 không đổi.
  - KHÔNG tạo task mới. Không task khác đổi.
- **Được phép sai lệch ở đâu:** 23 hay 24/09; có thể ghi giờ 10:00 vào Due date.
- **Độ phức tạp:** vừa (search mail → đọc → 1 update)

---

## Tổng kết phân bổ (tự đếm — đối chiếu trong README)

| Nhóm | Yêu cầu | Thực tế | Mục |
| --- | --- | --- | --- |
| Đơn giản rõ ràng | 5 | 5 | S-01..S-05 |
| Cân bằng lại task | 5 | 5 | S-06..S-10 |
| Mơ hồ có chủ đích | 4 | 4 | S-11..S-14 |
| Có ảnh đính kèm | 3 | 3 | S-15..S-17 |
| Đa connector | 3 | 3 | S-18..S-20 |

Workspace: A 8 · B 6 · C 6. Nên hỏi lại: CÓ 8 (S-06, 07, 10, 11, 12, 13, 14 + S-17 ở
mức "được phép") — thực tế CÓ 7, KHÔNG 13. Độ phức tạp: đơn 7 · vừa 10 · phức 3.
Câu chủ đạo tiếng Anh: S-03, S-08, S-13, S-16 (ảnh), S-19 (5/20) + S-05, S-12 trộn
mạnh.
