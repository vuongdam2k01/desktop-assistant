# Desktop Assistant — Bản đồ tính năng để implement

Ngày: 2026-09-13 · Nguồn: toàn bộ `docs/` (constitution 2.0.0, roadmap, risks, 12 capability specs,
25 changes req-001..req-025, PRD v2.1 + changelog v2.2, idea brief) và 21 spike REPORT dưới `spikes/`.

Tài liệu này là bản phân rã **để chuẩn bị implement**, không phải spec. `docs/spec/` giữ nguyên là nguồn
đúng; mọi kế hoạch chi tiết từng tính năng sẽ nằm ở `plans/`.

---

## 1. Dự án đang xây cái gì

**Desktop Assistant** là ứng dụng desktop (Windows 10+, macOS 13+) trợ lý công việc chạy bằng hệ agent AI,
điểm chạm chính là **một pet 2D hoạt hình luôn nổi trên màn hình**. Người dùng bấm pet, gõ lệnh (kèm ảnh
chụp) vào ô thoại; pet-agent tạo job; worker-agent thực thi nhiều bước trên các nền tảng đã kết nối
(Notion đọc+ghi, Gmail chỉ đọc, Drive chỉ đọc) ở hậu trường; pet báo lại bằng card nén.

Ba lớp kiến trúc:

| Lớp | Thành phần | Stack đã khoá |
| --- | --- | --- |
| Desktop shell | Cửa sổ pet (trong suốt, always-on-top, click-through theo pixel) + cửa sổ app quản trị | Electron; Rive (pet); React + TS + Tailwind (app); native module Rust/napi-rs (Windows) và AppKit (macOS) |
| Agent runtime + trust chain | Pet-agent, worker-agent, Job Manager, tool wrapping (ledger → gate → execute → ledger), Rule IR evaluator, risk judge, undo agent, resource coordinator | pi agents SDK (pin cứng), SQLite better-sqlite3 (Node-API prebuilt) |
| Backend peer service | Google Sign-In → JWT, allowlist beta, OAuth broker tổng quát, kho replication mã hoá, device registry, update manifest | Node.js + Fastify + TS + PostgreSQL |

Bốn bất biến hiến pháp chi phối mọi tính năng:
1. **Hard gate ngoài vòng LLM** — hook phê duyệt chạy ở tầng ứng dụng, model không thể chạm.
2. **Ledger trước khi hành động, append-only** — không ghi được ledger thì không thực thi.
3. **Irreversibility phải khai báo** — undo = replay compensating action, không phải diff-revert.
4. **Dữ liệu thuộc tài khoản** — sign-in là chìa khoá duy nhất; local SQLite là bản làm việc; server giữ khoá.

**Phạm vi MVP** = phương diện 1 (tương tác bất chợt) + 3 connector + trọn bộ trust chain + backend + sync +
đóng gói/ký/auto-update trên cả hai OS. **Ngoài MVP**: scheduler ngôn ngữ tự nhiên (Phase 2), ghi âm & tổng
hợp họp + util buttons (Phase 3), connector khác, ghi trên Gmail/Drive, pet 3D.

**Trạng thái hiện tại**: repo chỉ có `docs/`, `spikes/`, `plugins/`, `plans/` — **chưa có dòng mã sản phẩm
nào**. 21/21 spike đã chạy, tất cả GO (có điều kiện). Riêng replication (req-022) chưa có spike.

---

## 2. Nguyên tắc phân rã

- Mỗi tính năng = một ranh giới module có contract riêng trong `docs/spec`, tự kiểm chứng được, và có
  bằng chứng spike hoặc được gắn UNVERIFIED rõ.
- Thứ tự theo `docs/spec/roadmap.md`: **kho lưu trữ và contract trust-chain trước, connector, rồi agent
  runtime, shell cuối** — vì shell tiêu thụ contract, không xuất bản contract.
- Backend (F10) build **song song** từ sớm vì Notion connect bắt buộc đi qua OAuth broker (Principle VIII:
  không dùng lối tắt dev).
- Sync (F22) là đường găng theo roadmap nhưng chưa có bằng chứng; đề xuất **thiết kế sync-ready từ F1**
  (device_id, device sequence, store descriptor) và implement protocol sau khi có quyết định/spike.

Tổng: **F0 + 24 tính năng implement được + 1 tính năng chờ spec (req-025)**.

---

## 3. Danh sách tính năng

### F0 — Dựng source base (monorepo)

- **Mục đích**: khung mã để mọi tính năng sau có chỗ đứng; chưa có hành vi sản phẩm.
- **Nguồn**: ADR-009 (PRD §14.2), platform spec (native loaded from disk, no-compile sqlite binding, harness
  pin), agent spec "harness pinned to one package identity".
- **Phạm vi**:
  - pnpm workspaces + Turborepo; TypeScript strict; vitest; eslint/prettier; CI skeleton (Windows + macOS +
    Linux runner; Windows runner có Rust toolchain + VS C++ tools).
  - `apps/desktop` (Electron main + preload + 2 renderer: pet, app), `apps/backend` (Fastify), `packages/contracts`
    (types sinh từ `docs/spec/**/contracts/*.schema.json`, `*.openapi.yaml`, `*.sql`), `packages/*` cho từng module
    F1..F24, `native/win32-window` (napi-rs), `native/macos-window` (Swift/ObjC).
  - Build check: fail nếu resolve nhầm distribution của harness hoặc lệch version pin; fail nếu native
    component không được extract ra file khi đóng gói.
  - App rỗng chạy được: cửa sổ pet trong suốt + cửa sổ app + tray; backend `GET /v1/health`.
- **Ngoài phạm vi**: mọi logic nghiệp vụ.
- **Mã tái dùng**: `spikes/SP-0-gui-harness/src/` (screenshot/launch scripts cho e2e), cấu hình Electron ở
  `spikes/SP-3-electron-rive`, cấu hình electron-builder ở `spikes/SP-16-signing-update`.
- **Quyết định cần chốt**: tên package/scope npm; vị trí generated contracts.

### F1 — Action Ledger & Local Store

- **Nguồn**: `capabilities/ledger`, `req-013-sqlite-ledger`, phần ledger của `req-015`, `req-023` (durability).
  Contracts: `ledger-store.sql`, `ledger-record.schema.json`, `tool-reconciliation.schema.json`.
- **Phạm vi**:
  - Một file SQLite: jobs, action records (2 bản ghi/tool call: intent + result cùng correlation id),
    decisions, approval requests. Trigger cấm UPDATE/DELETE (APPEND_ONLY_VIOLATION) — hiệu lực với mọi
    process mở file.
  - Intent record cố định: before-snapshot (hoặc lý do không có), khai báo "effect can be read back" copy
    từ manifest tại thời điểm ghi.
  - Liệt kê intent chưa có result (đầu vào của recovery). Retention "announce-then-remove", atomic.
  - Schema migration không backfill/không rewrite record cũ; interrupted migration → toàn cũ hoặc toàn mới.
  - macOS: `PRAGMA fullfsync` + `synchronous=FULL` **chỉ** cho ledger + job store (241 writes/s đo được).
  - Sync-ready: cột `device_id`, `device_seq` monotonic; snapshot lưu nguyên, không nén.
  - Read channel cho renderer: read-only view + append stream; renderer không có quyền ghi.
- **Phụ thuộc**: F0.
- **Bằng chứng**: SP-12 (Windows/Linux/macOS, 5 điểm kill không mất job; 12.4 MB/1.800 job). Tái dùng bộ
  crash-injection ở `spikes/SP-12-sqlite-ledger/` làm regression.
- **Điểm mở**: Q-6 req-013 thời lượng classification pass trên store 90 ngày; checkpoint WAL khi xoá.

### F2 — Job Manager & vòng đời job

- **Nguồn**: `capabilities/job`, `req-006`, `req-013` (recovery), `req-015` (admission), `req-021` (suspended).
- **Phạm vi**:
  - 11 trạng thái: created, queued, running, waiting_approval, waiting_input, suspended, recovering,
    waiting_user_confirmation, done, failed, cancelled; mọi chuyển trạng thái có timestamp; terminal là cuối.
  - Song song không chia sẻ context; cap 4 job/connector account, 1 slot dành cho lệnh người dùng; waiting
    không giữ slot.
  - Cancel tại ranh giới tool call; failed kèm lý do + danh sách đã làm + đề nghị undo.
  - Retry ≤3 lần backoff, phân loại transient/permanent **theo error code adapter/coordinator khai báo**;
    không có code → permanent.
  - Timeout 10 phút không tính thời gian chờ người dùng.
  - Recovery 2 pha: phân loại từ store **trước khi hiện cửa sổ đầu tiên** (offline được); reconcile từng
    job khi có mạng (read back / hỏi người dùng / recovering).
  - Pre-flight: kiểm tra & renew authorisation mọi connector job có thể dùng trước tool call đầu.
  - `undo_of` liên kết hai chiều.
- **Phụ thuộc**: F1.
- **Bằng chứng**: SP-12 Q4, SP-15 Q4, SP-19 Q10, SP-21 Q3/Q6, SP-4 (median 16.9 s).

### F3 — Secure credential store

- **Nguồn**: `capabilities/platform` (credentials), `req-012-secure-storage`. Contracts: `secure-storage.sql`,
  `credential-class-descriptor.schema.json`.
- **Phạm vi**:
  - File credential store riêng (không nằm trong ledger): key → ciphertext + metadata. Mã hoá qua
    facility secure-storage của OS (Electron safeStorage; DPAPI/Keychain). **Không** dùng Credential
    Manager/Keychain item trực tiếp (giới hạn 2,5 KB, lộ trong danh sách của user).
  - Key namespaced `<domain>:<category>:<identity>[:<field>]`, enumerate theo prefix; key sai quy tắc bị
    từ chối.
  - Class registry: mỗi loại credential đăng ký descriptor (route phục hồi khi unreadable).
  - Unreadable → báo lỗi, mark, không trả giá trị thay thế; thay bằng bản từ account khi replicate.
  - Erasure atomic, resumable, chạy trước khi xoá store file; sign-out/uninstall/xoá account đều gọi.
  - Giá trị đã giải mã không rời main process: renderer chỉ biết "có/không, cập nhật lúc nào".
- **Phụ thuộc**: F0 (F22 để phục hồi từ account).
- **Bằng chứng**: SP-11 (Windows + macOS). Rủi ro RISK-042/077/078 (đổi tên app hoặc signing identity làm
  mất khoá Keychain → tên app và identity phải khoá vĩnh viễn).

### F4 — Approval gate: Rule IR, evaluator, hardline blocklist, mode & quyết định

- **Nguồn**: `capabilities/approval` (phần tĩnh), `req-009-rule-ir-hardgate`, `req-019` (irreversible default).
  Contracts: `rule-representation@1.0.0` (schema + SQL), `gate-evaluation` (asyncapi).
- **Phạm vi**:
  - Evaluator thuần, deterministic, không gọi model, không đọc text model sinh; p99 < 1 ms.
  - 8 predicate kinds; normalise tên field + extract nested; ràng buộc từng field + pattern (chống tách call);
    target theo connector/type/immutable id/ancestor chain.
  - Hardline blocklist mọi mode, không bao giờ đưa ra approve.
  - Mode `on`/`smart` (tầng tĩnh: irreversible, delete/archive, bulk >5, permission, not-created-by-user, rule
    người dùng)/`off` (rule refuse của người dùng vẫn hiệu lực; blocklist vẫn hiệu lực).
  - Irreversible hoặc snapshot không đọc được → cần approval trong smart/on.
  - 4 mức quyết định; job-scoped grant gắn tuple (job, rule, tool, scope); allowlist không vượt rule refuse/hold.
  - Strictest verdict wins; count từ ledger của account; fail-closed khi catalogue lỗi (chặn mọi write).
  - Held call → transcript durable + `waiting_approval` trước khi hiện request; hết 30 phút → pause an toàn,
    resume phải đánh giá lại; re-check before-state khi approve muộn (target đổi → từ chối).
  - Mode change chỉ áp cho job tạo sau; refusal đính kèm vào mọi câu hỏi sau đó trong job.
- **Phụ thuộc**: F1, F2 (F5 để wrap vào tool).
- **Bằng chứng**: SP-8 (20 case adversarial, 0 lọt, p99 0.48 ms). Tái dùng Rule IR v0 + evaluator ở
  `spikes/SP-8-rule-ir-hardgate/`.
- **Điểm mở**: **Q-OQ-2** (irreversible mặc định cần duyệt) spec đã chọn "có", PO chưa ratify; strictness
  mode off, ledger-derived counts, strictest-wins là UNVERIFIED (chưa re-run corpus).

### F5 — Agent harness & tool wrapping factory

- **Nguồn**: `capabilities/agent` (wrapping, session, pin), `req-007-pi-sdk-harness`. Contracts:
  `tool-wrapping`, `agent-session`, `provider-profile`.
- **Phạm vi**:
  - Nhúng pi agents SDK đúng package identity + version đã đo; build fail nếu lệch.
  - **Một** wrapping factory duy nhất: ledger intent → gate → execute → ledger result; implementation giữ
    private trong closure; session không nhận tool ngoài factory; không đăng ký coding tool mặc định; tool
    nội bộ (create_job, ask_user…) cũng qua factory với origin "internal".
  - Không dựa vào middleware/interception của harness cho bảo đảm này.
  - Mỗi session cô lập (transcript, tool set, suspension); pause/resume dựa trên transcript durable (in-memory
    chỉ là tối ưu); resume không lặp lại tool đã xong; refuse resume sau cancel.
  - Transcript lưu vào store account-owned (không phải session file của harness).
  - Tool result shape `{ content: [{type:"text",text}], details }`.
  - Refusal trả về agent như kết quả, không phải exception; ledger write fail → job fail.
- **Phụ thuộc**: F1, F2, F4.
- **Bằng chứng**: SP-6 (3 session song song không rò; 11 đường bypass đóng), SP-8 Q2.
- **Điểm mở**: số đo trong plain runtime, cần đo lại trong Electron (verification task).

### F6 — Model provider profiles & role routing

- **Nguồn**: `capabilities/agent` (routing, failure, usage), `req-017-provider-matrix`. Contracts: `role-routing`,
  `provider-failure`, `usage-accounting` (+ unit-price).
- **Phạm vi**:
  - Provider profile: credential API key hoặc custom endpoint; **không có** interactive sign-in; credential
    trong F3, **không replicate**; routing table và unit price **có** replicate.
  - 6 role đóng: pet text, pet image, worker, rule elicitation, undo, risk judge; mỗi request resolve qua
    bảng (role + input shape); role thiếu assignment → không gửi, báo settings.
  - Capability check tại thời điểm assign (image input, tool calling); suitability statement cho model chưa
    đo; cấm model cheap đã đo cho rule elicitation trong profile ship sẵn.
  - Defaults khi lưu profile đầu tiên; assignment đổi giữa job → job đang chạy giữ assignment cũ.
  - Phân loại 6 cause lỗi provider + remedy; response rỗng không lỗi = failure.
  - Usage record mỗi request (role, model, tokens, thời gian, cost nếu có giá của người dùng).
- **Phụ thuộc**: F3, F5.
- **Bằng chứng**: SP-17, SP-6 Q5, SP-10, SP-2.

### F7 — Connector framework (manifest + adapter + tool generator)

- **Nguồn**: `capabilities/connector` (framework), `req-019`, `req-003` (manifest 1.1), `req-015` (manifest 1.2).
  Contracts: `connector-manifest@1.2.0`, `connector-adapter@1.0.0`.
- **Phạm vi**:
  - Manifest: identity, auth config, scope profiles theo kênh phát hành, tool list với schema; mỗi write tool
    khai `is_reversible` + snapshot method + compensation formula hoặc irreversible; reconciliation
    declaration; snapshot exclusions; resource declaration (F8); BYO route availability; unrecallable effects.
  - Validate whole-or-nothing; schema major cao hơn → từ chối; profile cấp scope không tool nào dùng → từ chối.
  - Adapter đúng 4 operation: execute, snapshot, status, revoke. Lỗi chỉ trả về theo bộ error code khai báo.
  - Tool generator: sinh tool đã wrap (F5) từ manifest của connector **đang connected**; không branch theo
    tên connector.
  - Connect flow chuẩn: catalogue → Connect → browser → loopback redirect → broker exchange (F10) → connected;
    state hỏi platform (accepted/expired/insufficient/withdrawn + renewable); disconnect gọi revoke nếu có,
    xoá credential theo prefix, báo rõ "withdrawn at platform" hay "removed from product only".
  - Tool interface tương thích MCP; safety declarations nằm ở annotation.
- **Phụ thuộc**: F3, F5, F10 (broker).
- **Bằng chứng**: SP-19 (connector thứ hai: 0 dòng đổi ở core), SP-20 Q5.

### F8 — Resource coordinator (khoá đối tượng, hàng đợi công bằng, admission)

- **Nguồn**: `capabilities/connector` (coordinator), `capabilities/ledger` (exclusive span), `req-015`.
  Contracts: `resource-coordinator`, `coordination-declaration`.
- **Phạm vi**:
  - Một coordinator/process; **mọi** platform call đi qua nó; không có route nào khác tới adapter.
  - Key `<connector>:<type>:<id>` từ argument path khai báo + normalise; không qualify theo authorisation.
  - Lease exclusive, reentrant trong job; lấy toàn bộ set một lần theo thứ tự canonical; timeout 15 s → error
    code resource-held (job manager retry).
  - Exclusive span từ đọc before-state đến result record durable; approval chờ người → release, re-acquire và
    so lại before-state trước execute.
  - Dispatcher: round-robin per-job queue + token bucket per authorisation theo rate connector khai báo; 429 có
    Retry-After → toàn bộ queue của authorisation chờ.
  - Admission cap per connector account (F2).
- **Phụ thuộc**: F1, F2, F5, F7.
- **Bằng chứng**: SP-15 (dirty snapshot xoá công việc job khác nếu không lock; 4.251 ms → 252 ms với fair queue).
- **Điểm mở**: weight per job class, floor background (Q-5), cap=4 (Q-4) là khuyến nghị chưa đo.

### F9 — Notion connector (đọc + ghi + compensation matrix)

- **Nguồn**: `capabilities/connector` (Notion), `req-003-notion-compensation`. Contract:
  `notion-property-compensation`.
- **Phạm vi**:
  - Manifest + adapter: query database, retrieve page/properties, retrieve schema; create page (task), update
    properties, archive/unarchive, comment (irreversible), move/reorder qua numeric order property (không có →
    báo unsupported trước khi ghi; nhiều ứng viên → hỏi).
  - Snapshot trước mọi write; loại 6 computed values; select/status lưu id + label, khôi phục theo id; status
    không về empty (báo default); option mới tồn lại sau undo; assign person → khai notification không thu hồi.
  - Trash (200 + archived) là recoverable; 404 là absent-or-unreachable, không khẳng định "đã xoá".
  - Rate 2.5 rps per authorisation, tôn trọng Retry-After; không có page-in-workspace tool (UNVERIFIED).
  - Workspace + default database chọn tường minh.
- **Phụ thuộc**: F7, F8, F10 (OAuth client trung tâm qua broker).
- **Bằng chứng**: SP-1 (3 workspace thật), SP-9.
- **Điểm mở**: Notion public integration cần security review trước khi publish (track vận hành); RISK-039
  irreversible set khác giữa internal token và OAuth token → xác nhận lại với OAuth token thật.

### F10 — Backend slice (auth, allowlist, OAuth broker, health, version)

- **Nguồn**: `capabilities/backend` (trừ replication), `req-020-backend-slice`. Contracts: `client-session-api`
  (openapi + sql), `authorisation-broker-api`, `authorisation-provider-descriptor`, `public-service-endpoints`.
- **Phạm vi**:
  - Google ID token verify → access + refresh JWT; refresh token chỉ lưu hash; nhiều device/account; sign-out
    revoke device đó; invite allowlist gate + admin tối thiểu; withdraw invite → session không renew.
  - Broker tổng quát theo provider descriptor (Notion, Google): authorize-url + state binding (single-use,
    session-scoped), exchange, refresh; PKCE khi provider cho; **không lưu token** provider; thêm provider =
    thêm config.
  - Rate limit trước session guard cho auth/broker; health kiểm tra DB; version check public; static update
    feed (latest.yml, installer, blockmap, HTTP Range).
  - Secret manager, không secret trong repo/log; thiếu secret → từ chối serve provider đó.
  - Store chỉ 4 bảng: account, device, session, invite_allowlist.
  - Account deletion: xoá 4 bảng + gọi revoke mọi provider, báo provider không có revoke endpoint.
  - Backup hằng ngày, restore rehearsal; load test 2× beta trên hạ tầng tương đương production.
- **Phụ thuộc**: F0 (độc lập với client; build song song).
- **Bằng chứng**: SP-20 (200 kết nối, 0% lỗi; provider thứ hai 19 dòng config).
- **Điểm mở**: **OQ-11** nhà cung cấp hạ tầng + region (giờ là quyết định compliance vì server giữ nội dung);
  OQ-8 quy mô beta.

### F11 — Google connectors qua BYO OAuth client (Gmail RO, Drive RO)

- **Nguồn**: `capabilities/connector` (Google), `capabilities/app` (BYO steps), `req-014-byo-oauth-google`.
  Contracts: `byo-authorisation-client`, `byo-setup-guide`, `drive-content-projection`.
- **Phạm vi**:
  - Gmail manifest+adapter: list/search, read message + metadata, labels; không write. Drive: find, metadata,
    read theo route per type (export Docs/Sheets → text; download file); ceiling 20 MB; type không route →
    unsupported.
  - BYO route: nạp credential file (validate desktop-kind trước khi mở browser), loopback port động, exchange
    **trên device** (không qua broker), lưu client + token trong F3 theo prefix connector, replicate theo account.
  - Setup guide descriptor render trong app: 6 bước console + 2 bước app, resumable, nói trước chi phí (số
    bước, warning screen, re-consent 7 ngày).
  - Scope comparison mỗi consent: cấp thiếu → "needs wider permission", tool thiếu scope không sinh.
  - Renewal refused → expired giữ client, reconnect một bấm không hỏi lại file; account không trong test users
    → giải thích theo bước guide.
  - Disclosure Limited Use khi connect Gmail.
- **Phụ thuộc**: F7, F8, F3, F21 (surface guide).
- **Bằng chứng**: SP-13 (loopback + dynamic port + đọc mail/file thật, file 30 MB).
- **Điểm mở**: BYO có ship từ release đầu không; minh hoạ guide; refusal chính xác sau 7 ngày (UNVERIFIED).

### F12 — Worker agent loop & ask_user

- **Nguồn**: `capabilities/agent` (loop, ask), `req-006-agent-loop`, `req-021` (ask runtime). Contracts:
  `worker-loop` (+ prompt-context), `ask-user`.
- **Phạm vi**:
  - System prompt worker: gather → plan → act → **self-verify bằng read sau mỗi mutation** → report; chỉ hỏi
    qua `ask_user`, không hỏi bằng prose; typed text thắng ảnh; temporal anchor (date, weekday, IANA tz).
  - Tool `ask_user`: 1 question, 0–4 options (label ≤ 30), allow_free_text mặc định true; harness từ chối
    ask thứ hai (`MAX_ONE_PENDING_ASK_EXCEEDED`); trả lời → decision record (source bubble/app) → resume đúng
    điểm; free text thắng options; câu trả lời không thể vượt gate; refusal trước đó đính kèm câu hỏi.
  - 30 phút không trả lời → `suspended`, giải phóng memory, resume từ app không lặp bước.
  - Skills/rules đóng gói ban đầu cho Notion (từ SP-4 prompt).
  - Bộ 20 scenario SP-4 làm regression (sàn 85 % final-state).
- **Phụ thuộc**: F2, F5, F6, F7, F9.
- **Bằng chứng**: SP-4 (85 %, 95 % self-verify), SP-21 Q1/Q2/Q5/Q7.

### F13 — Pet-agent & persona

- **Nguồn**: `capabilities/agent` (pet-agent), `capabilities/pet` (text origin, ack), `req-024` (persona spec).
- **Phạm vi**:
  - Agent riêng trên harness với đúng 5 tool: create_job, get_job_status, cancel_job, notify_user, ask_user;
    không có tool connector.
  - Thiếu thông tin then chốt → **một** câu hỏi gộp, chưa tạo job.
  - Mọi text pet hiển thị do pet-agent sinh theo persona spec song ngữ; ngoại lệ duy nhất: ack line set
    (chỉ xác nhận đã nhận, không nêu gì về lệnh) hiển thị < 200 ms không cần mạng; provider lỗi → SYSTEM card,
    không bịa text.
  - Text theo ngôn ngữ hội thoại, không theo ngôn ngữ UI.
- **Phụ thuộc**: F2, F5, F6, F12.
- **Bằng chứng**: SP-17 Q2 (không model nào giữ cam kết 2 s → ack cục bộ).
- **Điểm mở**: **Q-OQ-3 persona** (tên, tính cách, giọng 2 ngôn ngữ, mức nói nhiều) — PO chưa chốt; chặn
  toàn bộ nội dung pet.

### F14 — Rule elicitation (hội thoại đúc kết quy tắc)

- **Nguồn**: `capabilities/approval` (elicitation), `req-004-rule-elicitation`. Contracts: `rule-elicitation`
  (+ turn schema).
- **Phạm vi**:
  - Đa lượt, trần 4 lượt, lượt 3 còn mơ hồ → diễn giải fail-closed an toàn nhất + bảng restatement.
  - Compile ra: Rule IR (F4) + system-prompt advisory fragment + restatement có cấu trúc; chỉ hiệu lực sau
    xác nhận; phần không compile được nói rõ, **không** hạ cấp thành nhắc nhở.
  - "delete/xoá" → cả archive_page và delete_block; container → ancestor_ids.
  - Sau compile chạy bộ sample must-block/must-allow, hiện kết quả.
  - Role pinned strong model; UI không cho gán cheap.
- **Phụ thuộc**: F4, F6, F21 (surface).
- **Bằng chứng**: SP-2 (20 rule, 100 % hội tụ, 4.35 lượt; cheap 25 % silent downgrade). Corpus
  `spikes/fixtures/` là regression gate.

### F15 — Risk judge (tầng 2 của smart mode)

- **Nguồn**: `capabilities/approval` (risk judge), `req-011-risk-judge`. Contracts: `risk-judge` (+ request).
- **Phạm vi**:
  - Chỉ chạy khi tầng tĩnh (F4) không khớp; verdict auto-approve/auto-reject/escalate; ghi decision
    "automatic" kèm lý do.
  - Timeout 10 s AbortSignal; mọi lỗi mạng/provider/JSON → ESCALATE_USER (`isFallback: true`).
  - Prompt: nội dung connector là dữ liệu không tin cậy; keyword giả metadata ledger/"approved" → escalate.
  - Tier 1 chặn object không do user tạo và bulk > 5 **trước** khi hỏi judge.
  - Default cheap model, user có thể chọn strong.
- **Phụ thuộc**: F4, F6.
- **Bằng chứng**: SP-10 (0 % false-allow/60 trial, P50 3.154 ms).

### F16 — Undo pipeline (compensating actions)

- **Nguồn**: `capabilities/undo`, `req-010-undo-agent`, `req-003`. Contracts: `undo-pipeline` (+ execute).
- **Phạm vi**:
  - 4 pha: inversion planner (đảo topological, child trước container) → conflict prober (diff property payload
    với snapshot_after của record **cuối** chạm object; không dùng timestamp; 404/unreachable → conflict; ≤5
    probe song song) → preview 3 nhóm reversible/irreversible/conflict kèm lý do + unrecallable effects →
    execute là job mới `undo_of`, ledger riêng, recursive undo được.
  - Trash → restore trước rồi bù; refuse 400 → narrow payload, không bịa giá trị; báo phần thành công/thủ công.
  - Undo disabled khi 0 reversible; partial undo với cảnh báo phụ thuộc (Should).
  - Role undo pin strong model (suy luận ngoài công thức tĩnh, mark "inferred").
- **Phụ thuộc**: F1, F2, F6, F7, F8, F9.
- **Bằng chứng**: SP-9 (0 false negative conflict), SP-1 Q7/Q8.

### F17 — Pet rendering (Electron + Rive)

- **Nguồn**: `capabilities/pet` (render), `req-005`, `req-024` (contract 2.0.0). Contract: `rive-state-machine@2.0.0`
  (+ set-state).
- **Phạm vi**:
  - Window config: transparent, frameless, `#00000000`, no shadow, no background throttling;
    `disableHardwareAcceleration` khi VM/RDP/headless.
  - Rive runtime nạp `.riv` từ Uint8Array trên disk, hot-swap không restart; artboard "Pet"; **hai lớp** state
    machine: locomotion (standing/walking/dragged/falling) × work status (idle/receiving/working/waiting_approval/
    has_result); blend 150–250 ms; trạng thái ưu tiên waiting_approval khi trùng.
  - ≥ 30 fps ở 70–100 % CPU (đo 60); soak 8 h không rò; idle giảm fps khi >60 s không tương tác (RISK-082).
  - Vị trí kéo thả nhớ qua phiên; multi-display: bounds không giao display nào → góc dưới phải primary;
    DPI khác nhau chuẩn hoá DIP.
  - Asset mặc định (placeholder) < 500 KB.
- **Phụ thuộc**: F0.
- **Bằng chứng**: SP-3 (Win + mac), SP-18 Q19/Q20.
- **Điểm mở**: **Q-OQ-4** phong cách đồ hoạ/nhân vật cố định; RISK-027 designer cần Rive subscription trả phí.

### F18 — Native window integration (Win32 napi-rs + macOS AppKit)

- **Nguồn**: `capabilities/pet`, `capabilities/platform`, `req-008-pet-window-os`, `req-023` (macOS). Contracts:
  `native-window-manager`, `window-integration-module@1.0.0` (có `capabilities()` để caller không branch OS).
- **Phạm vi**:
  - **Windows** (Rust/napi-rs): `WS_EX_NOACTIVATE | WS_EX_TOPMOST`, `SetWindowPos(SWP_NOACTIVATE)`, subclass
    `WM_NCHITTEST` → HTTRANSPARENT theo alpha; card window pre-warm lúc khởi động (tránh hitch 30–50 ms).
  - **macOS** (Swift/ObjC, module riêng, không chung code): NSPanel non-activating, `hitTest:` trả nil trên pixel
    trong suốt, collection behaviour mọi Space + over fullscreen, khôi phục activation cho app trước đó khi
    đóng bubble, đổi activation policy Accessory ↔ Regular theo cửa sổ app, `sharingType=none` để loại pet
    khỏi screen share.
  - Cấm tuyệt đối: suspend process khác, synthetic input vào cửa sổ khác, di chuyển pointer (req-002).
  - CI: Windows runner có Rust + VS C++; native `.node` extract ra file khi đóng gói.
- **Phụ thuộc**: F0, F17.
- **Bằng chứng**: SP-7 (Win 10/10 với native; plain Electron 6/10 fail), SP-7/mac, SP-18/mac Q29/Q30.

### F19 — Ô thoại: composer, hệ card, hàng đợi

- **Nguồn**: `capabilities/uix`, `capabilities/pet` (click/ack), `req-017` (ack, capability gate, provider card),
  `req-021` (ASK card, SYSTEM disruption), `req-008` (placement).
- **Phạm vi**:
  - State machine HIDDEN → COMPOSER / CARD / BADGE; click pet mở card ưu tiên nhất hoặc composer; CARD luôn có
    lối về composer; Esc/click ngoài đóng, card blocking về badge, trả focus cửa sổ trước.
  - Auto-expand **không cướp focus** (dựa F18); chỉ nhận keyboard khi user click.
  - 7 card: ACK, PROGRESS, ASK, APPROVAL, RESULT, ERROR, SYSTEM với anatomy chuẩn; APPROVAL render **trực tiếp
    từ payload hook**, không qua LLM; 4 mức quyết định, allowlist cần xác nhận phụ.
  - Queue: ASK=APPROVAL (FIFO) > ERROR > RESULT > ACK/PROGRESS; một job một suất non-blocking; bung một lần
    cho một đợt; tự ẩn ACK 5 s, RESULT 30 s (10–120); blocking collapse badge sau 60 s.
  - Composer: Enter/Shift+Enter/Esc, paste/drag ảnh ≤3, ≤10 MB, ≥14 px; capability gate khi pet-image role
    trống; gửi lệnh khi job khác đang chạy; ACK card trước khi job tồn tại.
  - DND từ menu chuột phải và app; OS notification chỉ khi pet ẩn; app focus → card hiện trong app.
  - SYSTEM card: connector hỏng, provider lỗi, backend disruption — update thay vì xếp thêm, tự rút khi sửa.
  - Rebuild queue sau restart từ job state + ledger; hai surface một quyết định (khoá ở Job Manager).
  - Placement flip ngang/kẹp dọc trong work area theo vị trí pet (kể cả đang di chuyển).
  - i18n vi/en cho mọi string UI.
- **Phụ thuộc**: F2, F4, F12, F13, F17, F18.
- **Bằng chứng**: SP-7 Q5, SP-17 Q5, SP-21 Q9/Q10, SP-18 Q21.

### F20 — Pet liveness (di chuyển, tránh caret, privacy filter)

- **Nguồn**: `capabilities/pet` (locomotion), `capabilities/platform` (privacy filter), `capabilities/app`
  (zero-title), `req-018-pet-liveness`. Contract: `privacy-filter`.
- **Phạm vi**:
  - Kiến trúc A (cặp cửa sổ nhỏ), không overlay fullscreen. LocomotionController 60 fps bằng đặt vị trí
    không activate; decay 0.92/frame; snap mép < 40 px; dragged theo cursor < 10 ms.
  - Caret buffer 150 px: detect caret trong 10 ms, né ra không rơi keystroke.
  - Native privacy filter: đọc cửa sổ foreground trong native, phân loại (EDITOR/BROWSER/TERMINAL/DOCUMENT/
    OTHER), **xoá raw title trước khi qua FFI**; chỉ `{category, bounds}` tới JS; không title nào vào SQLite,
    ledger, replication, prompt.
  - macOS: chỉ Level 0 geometry + app name và Level 1 Accessibility cho caret; **không** Screen Recording;
    permission bị từ chối → feature rút lui + SYSTEM card một lần.
- **Phụ thuộc**: F17, F18, F19. Ưu tiên Should (PRD S-S1).
- **Bằng chứng**: SP-18 (Win + mac), SP-22.

### F21 — Cửa sổ app: connectors, jobs, approval, settings, onboarding

- **Nguồn**: `capabilities/app`, `req-014` (BYO surface), `req-017` (usage/cost), `req-021` (offline queue
  manager), `req-022` (account/devices), `req-023` (Dock, onboarding no-permission).
- **Phạm vi** (có thể chia 3 lát):
  - **Lát A — shell + connectors + jobs**: React/TS/Tailwind, i18n; tray, đóng = về tray, thoát/restart có xác
    nhận khi job chạy; connectors area (catalogue, state, connect/reconnect/disconnect, BYO steps resumable);
    job list realtime (device, filter, pin waiting_approval, empty state); job detail (request + ảnh, result,
    ledger đọc được + raw expand, undo/cancel theo state, usage per role + cost hoặc "no price"); conversation
    history; macOS Dock chỉ khi app window mở.
  - **Lát B — approval + settings**: mode switch có xác nhận + banner off; rules (elicitation F14, list,
    allowlist CRUD); hàng chờ approval/ask; settings pet/notifications/DND/launch-at-login; provider profiles +
    routing table (F6); ledger retention & delete có cảnh báo.
  - **Lát C — onboarding + account**: WF-1 (sign-in → connect ≥1 → chọn mode → gặp pet → 1 job mẫu; mỗi bước
    tự retry; macOS không permission prompt); data policy disclosure; account: sync state, device list +
    revoke (kể cả máy đang dùng), sign-out báo phần chưa replicate, xoá account.
  - Offline command queue manager (xem, sửa, huỷ lệnh QUEUED_OFFLINE) — **xem câu hỏi mở §5**.
- **Phụ thuộc**: F2, F4, F6, F7, F14, F16, F19; lát C cần F10, F22.
- **Bằng chứng**: SP-13 Q7, SP-17 Q6, SP-16 Q5, SP-7/mac Q7, SP-22.

### F22 — Account sync (replication, device registry, enrolment)

- **Nguồn**: `capabilities/sync`, `capabilities/backend` (replication, key custody), `capabilities/ledger`
  (cross-replica), `req-022-account-sync`. Contracts: `replication-protocol` (openapi + sql),
  `replicated-store-descriptor`, `device-registry`.
- **Phạm vi**:
  - Store descriptor: identity, version, conflict rule (append-and-reconcile cho ledger/transcript; LWW +
    preserve superseded cho mutable), ordering basis (device seq, không wall-clock), retention. Store không
    khai rule → từ chối.
  - Protocol: handshake, pull/push cursor-resumable, device stream; replicated set = jobs, ledger + snapshot,
    rules, provider/app config (không credential provider), connector authorisation (kể cả BYO client),
    transcripts; không replicate window position, pet placement, update cache.
  - Enrolment từ sign-in alone, resumable; job chỉ chạy trên device tạo; approval từ device khác → resume tại
    device giữ suspension.
  - Lease bounded cho authorisation replicate; revoke server-side; sign-out/revoke → erase local (báo phần chưa
    replicate).
  - Backend: kho mã hoá at rest service-managed key, key custody tách khỏi request handler, audit mỗi access
    (không audit được → không access); account deletion huỷ dữ liệu + khoá.
  - Superseded version của mutable record append vào ledger.
- **Phụ thuộc**: F1, F3, F10, F21 lát C.
- **Bằng chứng**: **KHÔNG CÓ** (RISK-070). Roadmap đánh dấu blocked.
- **Điểm mở**: 4 câu hỏi req-022 (conflict mutable, ordering basis, revocation latency, transcript full);
  Q-5 có cần spike sync trước; lease period (SP-22 phải cấp); RISK-067 region/compliance.

### F23 — Pet pack framework

- **Nguồn**: `req-024-pet-pack-framework` (chưa sync vào capabilities). Contracts: `pet-pack-manifest`,
  `rive-state-machine@2.0.0`, `pet-pack-store` (descriptor + sql).
- **Phạm vi**:
  - Pack = manifest (identity, version, author, preview, capabilities, contract target) + `.riv` ≤ 5 MB +
    persona spec có cấu trúc (name, languages, talkativeness, ack lines, mô tả tự do bounded).
  - Hai nguồn: built-in templates (read-only, theo release) và account packs (replicate theo F22).
  - Import validate Rive contract + persona schema, đóng gói atomic; resolver degrade per-capability về default.
  - Persona composer cấp cho pet-agent như advisory layer (không chạm gate/ledger).
- **Phụ thuộc**: F13, F17, F22.
- **Điểm mở**: Q-PACK-1/2 persona + style pack ship sẵn (trùng OQ-3/OQ-4).

### F24 — Đóng gói, ký số, auto-update

- **Nguồn**: `capabilities/platform` (packaging), `capabilities/backend` (feed), `capabilities/app` (quit),
  `req-016-signing-update`, `req-023` (macOS). Contracts: `update-feed` (openapi + schema).
- **Phạm vi**:
  - electron-builder: NSIS (Windows), zip + dmg per-arch (macOS, `x64ArchFiles: "*.node"`); native `.node`
    extract ra disk.
  - Windows: cloud signing Authenticode SHA-256 + RFC 3161 timestamp trong CI; `verifyUpdateCodeSignature: true`.
  - macOS: Apple Developer ID + hardened runtime + notarization bắt buộc; **identity không đổi giữa các bản**
    (đổi = mất Keychain + TCC); `app.setName` khoá vĩnh viễn.
  - Update coordinator: check định kỳ feed per OS/arch, download nền, `autoInstallOnAppQuit=false`, hoãn
    restart khi job `running`, SYSTEM card cho restart/postpone.
- **Phụ thuộc**: F0, F10, F18, F21.
- **Bằng chứng**: SP-16 (Win + mac), SP-11/mac Q3, SP-22.
- **Điểm mở**: mua chứng chỉ cloud signing (≥ 2 tuần lead time) và Apple Developer Program trước closed beta;
  RISK-051 reputation warning bản đầu.

### F25 — (Chờ spec) Pi agent system mở rộng — req-025

- **Trạng thái**: chỉ có proposal, clarifications, impact và stub specs; **không có design/model/contracts**.
  Chưa implement được.
- **Ý định**: role registry mở (BREAKING `role-routing@0.1.0`), skill package format, context engine + token
  budget, lifecycle hooks (observe/transform, không authorize), delegation bằng child job qua Job Manager,
  browser/desktop capability packs ship inactive, redaction boundary.
- **Điểm mở**: Q1 mở catalogue role; Q2 browser/desktop MVP hay Phase 3; Q3 third-party packs; Q4 approval
  của child job. Cần `specdocs:continue` req-025 xong rồi mới lên kế hoạch.
- **Hệ quả cho F6/F12**: khi thiết kế role routing và harness session, để chỗ cho role identifier là string
  registry-key thay vì union đóng cứng, tránh rework khi req-025 chốt.

---

## 4. Thứ tự đề xuất và nhóm milestone

| Đợt | Tính năng | Tương ứng PRD | Ghi chú |
| --- | --- | --- | --- |
| 0 | F0 | — | Monorepo, CI, app rỗng |
| 1 · Kho & trust-chain | F1 → F2 → F3 → F4 → F5 → F6 | M1 | Chưa có UI; điều khiển bằng test/dev harness |
| 1' · Backend (song song đợt 1) | F10 | M5 | Cần trước F9 (Notion OAuth) |
| 2 · Connector & thực thi | F7 → F8 → F9 → F12 | M1 | Kết thúc M1: 20 scenario SP-4 pass, wrap phủ 100 % tool, "no hidden op" pass |
| 3 · Lớp an toàn | F14 → F15 → F16 | M2 | Hard gate 0 lọt là release gate |
| 4 · Pet & trải nghiệm | F17 → F18 → F13 → F19 → F20 | M3 | F20 là Should, có thể lùi |
| 5 · App window & Google | F21 (A, B) → F11 → F21 (C) | M4 | F11 cần surface guide ở F21 |
| 6 · Account & phát hành | F22 → F23 → F24 | M5 / trước alpha | F22 cần quyết định + có thể spike trước; F24 cần chứng chỉ sớm |
| — | F25 | Phase sau | Chờ spec |

Đường găng: F1 → F2 → F5 → F7 → F12 (M1). Chứng chỉ ký số và Apple Developer Program nên **mua ngay** vì
lead time, dù F24 nằm cuối.

---

## 5. Quyết định cần chốt trước khi implement tính năng tương ứng

| # | Câu hỏi | Chặn | Đề xuất |
| --- | --- | --- | --- |
| 1 | Q-OQ-2: irreversible mặc định cần duyệt ở smart/on? | F4 | Chấp nhận "có" như req-019 đã đo |
| 2 | Q-OQ-3 persona pet (tên, tính cách, giọng vi/en) | F13, F19, F23 | Draft persona spec để anh duyệt |
| 3 | Q-OQ-4 phong cách đồ hoạ, một nhân vật cố định; ngân sách Rive editor | F17, F23 | Dùng placeholder `.riv` cho F17, chốt asset ở F23 |
| 4 | Offline command queue (req-021) gửi gì lên "backend intake"? Theo ADR-007 lệnh không cần backend; PRD E8 chỉ nói xếp hàng cục bộ. Spec app/uix hiện mô tả drain lên backend — mâu thuẫn kiến trúc | F21 | Làm rõ bằng `specdocs:update` req-021 trước; nhiều khả năng queue phục vụ replication, không phục vụ tạo job |
| 5 | Dev/alpha Notion dùng internal integration token (PRD §13.5) có vi phạm Principle VIII? | F9 | Xây F10 broker trước F9 và nộp Notion security review ngay |
| 6 | req-022: conflict mutable, ordering basis, revocation latency, transcript full; có spike sync trước không | F22 | Chạy spike sync nhỏ trước khi implement F22 |
| 7 | OQ-11 hạ tầng backend + region (giờ là compliance vì server giữ nội dung mã hoá) | F10, F22 | Cần anh quyết |
| 8 | req-014: BYO route ship từ bản đầu hay chỉ khi có client trung tâm | F11 | Ship từ bản đầu (đây là đường email duy nhất) |
| 9 | req-015 defaults: cap 4, reserved 1, weight/floor | F8 | Lấy khuyến nghị spike làm default, để config |
| 10 | Mua cloud signing cert + Apple Developer Program | F24 | Khởi động ngay |
| 11 | req-025 hoàn tất design để F6/F12 để chỗ đúng | F6, F12, F25 | Chạy `specdocs:continue` req-025 |

---

## 6. Mã spike tái dùng được khi bắt đầu từng tính năng

| Tính năng | Đường dẫn seed |
| --- | --- |
| F0 | `spikes/SP-0-gui-harness/src/`, `spikes/SP-3-electron-rive/`, `spikes/SP-16-signing-update/` |
| F1, F2 | `spikes/SP-12-sqlite-ledger/` (schema, trigger, crash-injection suite) |
| F3 | `spikes/SP-11-secure-storage/` (+ `macos/`) |
| F4 | `spikes/SP-8-rule-ir-hardgate/` (Rule IR v0 schema + evaluator + 20 case adversarial) |
| F5, F6 | `spikes/SP-6-pi-sdk/`, `spikes/SP-17-provider-matrix/` (system-cards.json) |
| F7, F8 | `spikes/SP-19-connector-framework/`, `spikes/SP-15-concurrency/` |
| F9, F16 | `spikes/SP-1-notion-compensation/evidence/compensation-matrix.md`, `spikes/SP-9-undo-agent/` |
| F10 | `spikes/SP-20-backend-slice/` |
| F11 | `spikes/SP-13-byo-oauth-google/` (+ `byo-setup-guide-draft.md`) |
| F12, F13 | `spikes/SP-4-agent-loop/` (20 scenario runner), `spikes/SP-21-ask-user-offline/` |
| F14 | `spikes/SP-2-rule-elicitation/`, corpus `spikes/fixtures/` |
| F15 | `spikes/SP-10-risk-judge/` |
| F17, F18, F20 | `spikes/SP-3-electron-rive/`, `spikes/SP-7-pet-window-os/` (+ `macos/`), `spikes/SP-18-pet-liveness/` |
| F24 | `spikes/SP-16-signing-update/` (+ `macos/`), `spikes/SP-22-macos-permissions/` |
