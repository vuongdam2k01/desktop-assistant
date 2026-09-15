# F1 — Action Ledger & Local Store

Đọc trước: `plans/260913-1629-implementation-prompts/README.md` §1, §3, §4. Worktree `feat/f01-ledger-local-store`.
Phụ thuộc: F0 đã merge vào `dev`. Sở hữu: `packages/ledger-store`.

## Mục tiêu
Kho SQLite cục bộ là bản làm việc của thiết bị: ledger append-only hai bản ghi mỗi tool call, job store,
decisions, approval requests; immutability do store tự cưỡng chế; liệt kê intent chưa có kết quả cho
recovery; retention "announce-then-remove"; migration không rewrite lịch sử; durability vật lý trên macOS;
sẵn sàng cho replication (device id, device sequence).

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` III (Ledger Before Act, Append-Only — NON-NEGOTIABLE), IV, VII.
- `docs/spec/capabilities/ledger/spec.md` — toàn bộ; đặc biệt: record carries full account; append-only enforced
  by store; two records joined by correlation id; intent fixes what recovery may assume; unresolved intents
  listable; records leave whole and announced; shape change leaves records as written; before state captured
  under exclusive access (F8 sẽ giữ lock, F1 cung cấp API); durable against power loss; cost of durability
  confined to ledger + job store; device id + monotonic sequence; superseded version record.
- `docs/spec/capabilities/job/spec.md` — các trạng thái job cần cột lưu; `docs/spec/capabilities/platform/spec.md`
  — "Interrupted work is classified from the local store before the first window appears", "reached without
  compiling anything".
- `docs/spec/changes/req-013-sqlite-ledger/` — `proposal.md`, `design.md`, `model.md`, `clarifications.md` (Q-3
  copy declaration vào intent, Q-4 announce-then-remove, Q-5 hai pha recovery, Q-6), `contracts/ledger-store.sql`,
  `contracts/ledger-record.schema.json`, `contracts/tool-reconciliation.schema.json`.
- `docs/spec/changes/req-022-account-sync/` — `contracts/replication-protocol.sql`, `replicated-store-descriptor`
  (cột device_id, device_seq; conflict rule append-and-reconcile; ordering không theo wall-clock).
- `docs/spec/changes/req-023-macos-platform-baseline/specs/ledger/spec.md` — fullfsync.
- `docs/spec/changes/req-015-concurrency-coordinator/specs/ledger/spec.md` — exclusive span, re-check before-state.
- Spike: `spikes/SP-12-sqlite-ledger/REPORT.md` (schema, trigger, WAL, 5 điểm kill, 12,4 MB/1.800 job),
  `spikes/SP-12-sqlite-ledger/macos/REPORT.md` (fullfsync 28.000 → 241 writes/s), bộ crash-injection trong
  `spikes/SP-12-sqlite-ledger/` để tái dùng; `spikes/SP-15-concurrency/evidence/sp15-ledger.db` record 3–6.
- `docs/spec/risks.md`: RISK-044, 045, 046, 047, 065, 068, 069, 081.

## Phạm vi (in)
- Package `packages/ledger-store` mở **một** file SQLite (better-sqlite3 Node-API prebuilt): bảng jobs, action
  records (intent + result, `correlation_id`, `record_type` tool_call/decision/approval/error/info, tool + params,
  outcome, snapshot_before/after nguyên, reversibility flag, compensating action, `effect_readable` copy từ
  manifest, connector id, timestamps), decisions, approval_requests, removal announcements, `device_id`,
  `device_seq` monotonic (không restart sau reboot).
- Trigger SQL cấm UPDATE/DELETE (`APPEND_ONLY_VIOLATION`) hiệu lực cho mọi process mở file; DELETE chỉ qua thủ
  tục removal (retention/user) đi kèm bản ghi announce trước, atomic (toàn bộ hoặc không).
- API: `appendIntent`, `appendResult`, `appendDecision`, `listUnresolvedIntents` (sẵn trước mọi công việc khác
  khi khởi động, không cần mạng), `readJob`, read-only views + append stream cho renderer (renderer không có
  quyền ghi), `expire(range, reason)`, `deleteByUser(range)`.
- Shape/migration manager: chỉ thêm cột/bảng, không backfill, từ chối migration rewrite record cũ; interrupted →
  toàn cũ hoặc toàn mới.
- Store opener: WAL; `synchronous` phù hợp; trên macOS `PRAGMA fullfsync` + `checkpoint_fullfsync` +
  `synchronous=FULL` **chỉ** cho file ledger+job; API mở store phụ (cache, scratch) không bật.
- Retention mặc định 90 ngày, cấu hình được; xoá kéo theo image extract tham chiếu.
- Test: port bộ crash-injection SP-12 (kill tại 5 điểm) vào vitest cross-platform (RISK-048); test trigger từ
  process ngoài (sqlite3 CLI) bị từ chối; test migration interrupted; benchmark ghi durable trên macOS ghi số đo
  vào report.

## Ngoài phạm vi
Logic vòng đời job (F2), lock (F8), replication protocol (F22), UI ledger (F21), credential (F3).

## Tiêu chí hoàn thành
1. Mọi requirement ở `capabilities/ledger/spec.md` có test tương ứng mang tên scenario; pass trên Linux, Windows,
   macOS (CI).
2. Crash-injection 5 điểm: không mất job, phân biệt đúng trước/sau external call.
3. UPDATE/DELETE từ ngoài process bị từ chối; announce-then-remove atomic.
4. Store chạy trên máy không toolchain; native `.node` extract khi đóng gói (build check F0 vẫn xanh).
5. Số đo throughput macOS có/không fullfsync ghi trong report và trích SP-12/mac.
6. Report `plans/reports/` với câu hỏi chưa giải quyết (Q-6 thời lượng classification, checkpoint WAL).
