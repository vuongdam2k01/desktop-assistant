# Báo cáo kiểm thử — scripts & hooks của plugin `specdocs`

Ngày: 2026-09-12 · Node v24.21.0 · Linux

## Phạm vi

File đã tạo (không sửa file nào khác trong repo):

- `plugins/specdocs/scripts/lib.mjs` — tiện ích chung: parser YAML tối giản, tách section
  markdown, front-matter, bảng markdown, tìm gốc dự án, nạp khối `specdocs:`.
- `plugins/specdocs/scripts/spec-check.mjs` — `rtm | surfaces | xcut | evidence | consumers | order | all`.
- `plugins/specdocs/scripts/extract-sections.mjs` — tách section, JSON mặc định, `--text` cho người đọc.
- `plugins/specdocs/hooks/hooks.json` — SessionStart · PostToolUse(Write|Edit) · Stop, timeout 10 s.
- `plugins/specdocs/hooks/state-inject.cjs`, `validate-on-write.cjs`, `session-end.cjs`.

Đã áp dụng đổi hướng: dữ liệu dự án ở `docs/spec/` (capabilities/, changes/ với `.change.yaml`,
roadmap.md, risks.md, rtm.md); gốc dự án = thư mục gần nhất có `docs/spec/config.yaml`; hook gọi
CLI riêng của plugin qua `path.join(__dirname, '..', 'bin', 'specdocs.mjs')`.
Không còn chuỗi "openspec" trong bất kỳ file nào (`grep -in openspec hooks/* scripts/*` → trống).

## Fixture

`…/scratchpad/specdocs-fixture/` — dự án giả có: 2 năng lực (`pet-runtime`, `connector`) với
spec/model/design/evolution/contracts; 5 change đang mở (`add-voice`, `use-voice`, `cycle-a`,
`cycle-b`, `no-meta` thiếu metadata) + 1 change đã archive có checklist chưa tick; tài liệu
thượng nguồn `docs/requirements.md`; bằng chứng `spikes/SP-1/REPORT.md`; `guides/`;
`docs/spec/roadmap.md` cố ý mâu thuẫn thứ tự; `docs/spec/risks.md` có dòng `- BỎ …`.
Fixture được dựng để mỗi lệnh con chạm cả nhánh sạch lẫn nhánh vi phạm.

## Lệnh đã chạy và kết quả

| Lệnh | Kết quả |
| --- | --- |
| `node --check` cho cả 6 file `.mjs`/`.cjs`; `JSON.parse(hooks.json)` | pass |
| `claude plugin validate plugins/specdocs` | ✔ Validation passed |
| `spec-check.mjs rtm` | exit 1 · 3 ID, 3 covered · bắt `RTM_NO_SCENARIO` · ghi `docs/spec/rtm.md` |
| `spec-check.mjs rtm --change use-voice` | exit 1 · lọc đúng delta · bắt `RTM_MISSING_MUST` (FR-02) |
| `spec-check.mjs surfaces` | exit 1 · `SURF_CONTRACT_MISSING`, `SURF_RESERVED_NO_NOTE`, `SURF_EVOLUTION_SILENT`, `SURF_NO_GUIDE`; điểm open có contract + version + evolution + guide thì im lặng |
| `spec-check.mjs xcut` | exit 1 · cú pháp `mục \| alias` chạy đúng; bắt mục không được phủ |
| `spec-check.mjs evidence` | exit 1 · nhận `§2. Kết quả đo` và `#4-khuyen-nghi`, tôn trọng `- BỎ …#3-…` trong risks.md, bắt `EVID_UNCITED` cho mục 5; mục 1 chỉ là info |
| `spec-check.mjs consumers` | exit 1 · `CONS_DECLARED_MISSING_CAP` (high), `CONS_UNDECLARED` (medium) |
| `spec-check.mjs consumers pet-pack` | exit 0 · in đúng một contract |
| `spec-check.mjs order` | exit 1 · topo `add-voice → use-voice`; cạnh từ `depends_on` **và** từ contract `voice-spi`; `ORDER_CYCLE` (critical) cho cặp cycle-a/b; `ORDER_UNKNOWN_DEP`; `ORDER_ROADMAP_CONFLICT`; `ORDER_NO_META` (info) |
| `spec-check.mjs all` và `all --json` | exit 1 · 14 finding (1 critical, 3 high, 7 medium, 1 low, 2 info); JSON có `command, root, ok, findings[], summary, data` |
| Chạy 2 lần `all --json` rồi `diff` | giống hệt (tiền định) |
| Chạy từ thư mục con `docs/spec/capabilities/pet-runtime` | tìm đúng gốc |
| `spec-check.mjs bogus` · thiếu gốc · `--help` | exit 64 · exit 64 · exit 0 |
| `extract-sections.mjs <file>` / `<dir> --text` / `--min-level 1 --max-level 2` | đúng `path, heading, level, slug, line, text`; slug bỏ dấu tiếng Việt (`2. Kết quả đo → 2-ket-qua-do`) |
| `extract-sections.mjs` không tham số · `--min-level 9` · đường dẫn không tồn tại | exit 64 cả ba |

### Hook (stdin JSON mẫu, chạy từ trong fixture)

| Kịch bản | Kết quả |
| --- | --- |
| `state-inject` với CLI thật `bin/specdocs.mjs list --json` | 14 dòng (≤ 25): hiến pháp v1.2.0, 5 change + tiến độ tasks 2/4, 2 câu hỏi mở, mục roadmap kế tiếp, handoff, dòng nhắc quy trình |
| `state-inject` với CLI giả lập trong scratchpad | đọc đúng `{changes:[{name}]}` → 3 change |
| `state-inject` khi không có CLI | tự chuyển sang liệt kê thư mục `docs/spec/changes/*` |
| `validate-on-write` · file của change hợp lệ | im lặng, exit 0 |
| `validate-on-write` · file của change có lỗi | in `hookSpecificOutput.additionalContext` với `[ERROR] path — message` |
| `validate-on-write` · lặp lại ngay | im lặng (debounce 3 s, dấu vết ở `os.tmpdir()/specdocs-validate-<hash>.json`); sau 3,1 s in lại |
| `validate-on-write` · file ngoài `changes/` hoặc trong `changes/archive/` | im lặng |
| `validate-on-write` · hình dạng lỗi `{error, status:[…]}` của CLI | vẫn tóm tắt được |
| `session-end` · có sửa `docs/spec`, chưa có handoff 30 phút qua | nhắc W8 |
| `session-end` · sau khi tạo `plans/handoffs/…md` | không nhắc W8 nữa |
| `session-end` · change đã archive vừa sửa còn mục `- [ ]` | cảnh báo checklist |
| `session-end` · không đụng `docs/spec` | không nhắc W8 |
| Cả 3 hook chạy từ `/tmp` (không có `docs/spec`) | không in gì, exit 0 |
| Cả 3 hook với stdin rỗng và stdin rác | không in gì, exit 0 |

## Ghi chú thiết kế

- Mã thoát: finding mức `info` không làm hỏng build; chỉ `critical/high/medium/low` mới cho exit 1.
  File thiếu → finding `info`, không ném lỗi.
- `--change` áp cho `rtm` (lọc delta) và `order` (báo khi tên không thuộc change đang mở); các lệnh
  khác bỏ qua, đã ghi trong `--help`.
- `order` tính tập contract đã biết = contract hiện có ∪ contract do change tạo ra, nên bắt được
  cả phụ thuộc vào contract chưa hợp nhất (`voice-spi`).
- Hook `.cjs` không nạp `scripts/lib.mjs` (ESM) nên mỗi hook tự chứa vài hàm trợ giúp ngắn —
  đánh đổi có chủ đích để giữ đúng danh sách file được phép tạo.
- Chưa ghi gì vào `docs/spec/` thật của repo; mọi lần chạy đều trong fixture hoặc có `--root` trỏ
  vào fixture.

## Câu hỏi còn mở

1. `spec-check.mjs rtm` ghi đè `docs/spec/rtm.md` mỗi lần chạy, kể cả khi có `--change` (lúc đó ma
   trận chỉ phản ánh một change). Có nên chặn ghi khi có `--change`, hay ghi ra tên khác?
2. Hình dạng JSON của `validate --json` hiện được đọc theo kiểu chịu lỗi (dò `issues/errors/status`
   ở nhiều cấp). Nếu CLI chốt hợp đồng JSON, nên siết lại cho chặt.
