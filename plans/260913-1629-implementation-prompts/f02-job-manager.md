# F2 — Job Manager & vòng đời job

Đọc trước: README.md §1, §3, §4. Worktree `feat/f02-job-manager`. Phụ thuộc: F1 merged.
Sở hữu: `packages/job-manager`; điểm nối: composition root Electron main (một dòng).

## Mục tiêu
Module sở hữu vòng đời job từ created đến done/failed/cancelled, song song có giới hạn, cancel tại ranh giới
tool call, retry theo error code khai báo, timeout, khôi phục sau crash hai pha, pre-flight authorisation,
liên kết `undo_of`. Job Manager là **nơi duy nhất** agents giao tiếp qua job record (Constitution I).

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` I (Decentralized Agents), III.
- `docs/spec/capabilities/job/spec.md` — toàn bộ 10 requirement: 11 trạng thái (`created, queued, running,
  waiting_approval, waiting_input, suspended, recovering, waiting_user_confirmation, done, failed, cancelled`);
  parallel không chia sẻ context, cap 4/connector account + 1 slot reserved cho lệnh người dùng, waiting không giữ
  slot; cancel tại boundary; failed explains + offers undo; retry ≤3 theo connector/coordinator error code, không
  code → permanent; time limit 10 phút không tính chờ; no job lost across crash (intent không result → không
  resume tới khi xác định); simple job median ≤ 30 s; establish authorisation before start; resume không lặp.
- `docs/spec/capabilities/ledger/spec.md` (unresolved intents, reconciliation declaration),
  `docs/spec/capabilities/platform/spec.md` ("classified before the first window appears").
- Changes: `req-013-sqlite-ledger` (`design.md` Recovery Manager 2 pha, Reconciler, `contracts/tool-reconciliation.schema.json`),
  `req-006-agent-loop` (`specs/job/spec.md`, latency), `req-015-concurrency-coordinator` (`specs/job/spec.md`
  admission, error code resource-held, `clarifications.md` Q-3, Q-4), `req-021-ask-user-offline` (`specs/job/spec.md`
  suspended 30 phút, resume từ checkpoint), `req-019-connector-framework` (`specs/job/spec.md` pre-flight refresh),
  `req-010-undo-agent` (`undo_of`), `req-022-account-sync` (job chỉ chạy trên device tạo; device khác xem).
- Spike: `spikes/SP-12-sqlite-ledger/REPORT.md` Q4; `spikes/SP-15-concurrency/REPORT.md` Q4 (3/5/8 job đồng thời);
  `spikes/SP-19-connector-framework/REPORT.md` Q10 và §4 (refresh 300 ms); `spikes/SP-21-ask-user-offline/REPORT.md`
  Q3, Q6; `spikes/SP-4-agent-loop/REPORT.md` Q4 (16,9 s).
- `docs/spec/risks.md`: RISK-045, 049, 050, 059.

## Phạm vi (in)
- State machine với timestamp mỗi chuyển; terminal là cuối (event sau ghi vào job, không mở lại); mode phê
  duyệt lưu tại thời điểm tạo (đọc bởi F4); `created_on_device`.
- Scheduler: hàng đợi `queued`, admission per connector account (cap và reserved slot cấu hình, default từ SP-15),
  giải phóng slot khi waiting.
- Cancel: cờ kiểm tra tại boundary; in-flight call hoàn tất và ghi; ledger ghi điểm dừng; đề nghị undo.
- Failure report: lý do, danh sách đã làm (từ ledger), đề nghị undo (gọi F16 khi có).
- Retry policy: phân loại transient/permanent **chỉ** từ error code adapter (F7) / coordinator (F8); backoff tăng;
  mỗi retry là ledger record.
- Timeout job (execution time, loại trừ waiting).
- Recovery: pha 1 phân loại từ `listUnresolvedIntents` trước cửa sổ đầu (F1), đánh dấu không resumable; pha 2
  reconcile per job khi có mạng theo declaration trong intent record: read back khớp before → failed; khớp intended
  → append result "established by reconciliation" → done; không read back được → `waiting_user_confirmation`;
  không mạng → `recovering`.
- Pre-flight: hỏi connector status (F7) cho mọi connector job có thể dùng; renew nếu dưới margin; không renew được
  → không start, báo connector cần reconnect.
- Resume từ suspended/waiting: trả lời → running, không lặp bước (đi qua F5 transcript).
- Event bus cho UI (job list realtime) qua IPC contract định nghĩa trong package.

## Ngoài phạm vi
Agent loop (F12), gate (F4), wrapping (F5), lock (F8), undo plan (F16), UI (F21), replication (F22).

## Tiêu chí hoàn thành
1. Mỗi scenario trong `capabilities/job/spec.md` có test pass.
2. Test tích hợp với F1: kill process ở 5 điểm → job phân loại đúng; job không bao giờ biến mất.
3. Test admission: 4 job cùng account → job thứ 5 queued; lệnh người dùng vào reserved slot; account khác không
   chung budget; waiting giải phóng slot.
4. Cancel giữa write in-flight: call hoàn tất, không call mới; ledger ghi điểm dừng.
5. Retry chỉ theo error code; lỗi không code không retry; resource-held retry rồi fail nêu tên job giữ.
6. Report kèm câu hỏi mở (defaults cap/reserved, margin renew chưa đo).
