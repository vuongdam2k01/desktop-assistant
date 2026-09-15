# specdocs — 8 skill quy trình (explore · new · continue · update · sync-spec · archive · apply · verify-delta)

Ngày: 2026-09-12 · Phạm vi: `plugins/specdocs/skills/{explore,new,continue,update,sync-spec,archive,apply,verify-delta}/SKILL.md`

## Đã làm

Viết mới 8 `SKILL.md`, thân tiếng Việt, từ khoá cấu trúc giữ tiếng Anh, theo bố cục bắt buộc của
`plugins/specdocs/CONTRIBUTING.md`: một đoạn mục đích → **Ranh giới** → **Đầu vào** → **Các bước**
→ **Đầu ra** → **Guardrails** → bảng **Handoff**.

| Skill | Dòng | Vai trò | `disable-model-invocation` |
| --- | --- | --- | --- |
| `explore` | 132 | Tư thế nghĩ cùng; chỉ đọc; chỉ được ghi `docs/spec/explorations/<slug>.md` sau một xác nhận yes/no nêu đích danh file | — |
| `new` | 115 | Scaffold change bằng engine; chọn `lite`/`design` theo điều kiện của `references/workflow.md` và giải thích một dòng | — |
| `continue` | 139 | Soạn artifact kế tiếp theo `instructions`; ghi vào `resolvedOutputPath`, nở glob cho `specs/**` và `contracts/**`; `validate` sau khi ghi | — |
| `update` | 133 | Sửa artifact đã có và kéo về nhất quán theo **mọi hướng**; không tạo artifact mới | — |
| `sync-spec` | 131 | Vỏ mỏng quanh `sync` của engine: validate → cho thấy trước → xác nhận → merge → báo cáo | có |
| `archive` | 143 | 5 cổng tiền điều kiện rồi `archive --yes --json`; kiểm `validate --all --strict` sau | có |
| `apply` | 144 | Hiện thực task, một lượt một phase, chạy `kiểm:` rồi mới tick | — |
| `verify-delta` | 138 | Kiểm delta ba chiều (Completeness/Correctness/Coherence), chỉ đọc | — |

Nguồn phương pháp: 8 skill vendor MIT trong `plugins/specdocs/skills/openspec-*` (đọc để lấy quy
trình và guardrail, **không** copy). Đã bỏ toàn bộ phần store/`--store`/profile/tên sản phẩm cũ;
mọi đường dẫn chuyển sang `docs/spec/`, mọi lệnh chuyển sang engine của plugin.

### Quyết định đáng ghi

- **`apply` giữ bộ công cụ rộng** (`Bash` không giới hạn + `Read Glob Grep Write Edit`) vì nó là
  skill duy nhất được sửa code dự án — nêu rõ ngay đoạn mở đầu. Bảy skill còn lại dùng đúng
  `Bash(node ${CLAUDE_PLUGIN_ROOT}/bin/*) Read Glob Grep Write Edit`.
- **`sync-spec` vs `sync`**: mỗi file nói rõ ranh giới ở bảng *Ranh giới* và nhắc lại ở *Đầu ra*
  (`sync-spec` = engine merge delta `spec.md`; `/specdocs:sync` = merge agent-driven cho
  model/design/contracts/evolution/verification). `archive` có một cổng riêng kiểm việc này.
- **`archive` cổng 4** đối chiếu từng artifact ngoài spec của change với file đích dưới
  `capabilities/`; thiếu là dừng và bàn giao `/specdocs:sync` — vì `archive` của engine chỉ merge
  delta `spec.md`.
- Không tạo file phụ nào trong 8 thư mục; mỗi skill gọn dưới 150 dòng nên không cần tách reference.

## Kiểm chứng

### Engine chạy thật (thư mục nháp)

`init` → `new change demo --schema lite` → `status --change demo --json` → điền `proposal.md` +
`specs/demo-cap/spec.md` → `validate demo --json` (sạch) → `show demo --type change --json`
(`deltaCount: 1`) → `instructions apply|archive --change demo --json` → `sync demo --json`
(tạo `docs/spec/capabilities/demo-cap/spec.md`) → `validate --all --strict --json` → `archive demo
--yes --json` (`archivedAs: 2026-09-12-demo`) → `doctor --json` (`healthy: true`).

Mọi tên lệnh, cờ và tên trường JSON trích trong 8 skill đều đối chiếu với `cmds.help` và với kết
quả chạy thật ở trên: `new change`, `list [--specs] [--archived] [--json]`,
`show <id> --type spec|change [--no-scenarios]`, `status --change`, `instructions
<artifact>|apply|archive --change`, `validate [<change>] [--all] [--strict] [--specs]`,
`sync <change>`, `archive <change> [--yes]`, và `--root <dir>` dùng chung.

Ghi nhận hành vi engine đã phản ánh vào skill: `sync` ghi `synced_at` vào `.change.yaml` nên
`archive` sau đó **không** merge lại mà trả `warnings` báo đã sync — `sync-spec` và `archive` đều
nói rõ đây là hành vi đúng, không phải lỗi.

### Lint

| Skill | quick_validate | lint_cruft |
| --- | --- | --- |
| explore / new / continue / update / sync-spec / apply | valid | high=0 medium=0 |
| archive | valid | high=0 medium=1 |
| verify-delta | valid | high=0 medium=2 |

`verify-delta` ban đầu có 1 **HIGH** `pressure-density` (6 lần chữ `CRITICAL` trong thân bài, 3
lần trong cửa sổ 10 dòng). Đã sửa bằng cách dùng "mức chặn" trong các bước 2–4 và gom ba nhãn
`CRITICAL`/`WARNING`/`SUGGESTION` vào một bảng ở bước *Phân mức*. Sau sửa: high=0.

Hai `emphasis-no-reason` còn lại (và 1 ở `archive`) là **medium** và là hạn chế của linter với văn
bản tiếng Việt: nó chỉ nhận `because|so that|otherwise|since` để coi là "có lý do". Các skill anh
em đã có sẵn (`verify` 2 medium, `analyze` 4 medium) ở cùng mức, nên giữ nguyên cho nhất quán.

- `grep -ri` từ khoá sản phẩm cũ trên 8 thư mục: **rỗng**.
- `wc -l`: tất cả ≤ 300 (cao nhất 144).
- Không tạo/sửa file nào ngoài 8 `SKILL.md`.

## Còn mở

- `claude plugin validate plugins/specdocs` chưa chạy (không thuộc phạm vi được giao; CLI `claude`
  có thể không sẵn trong môi trường này).
- `plugins/specdocs/CONTRIBUTING.md` và `README.md` vẫn mô tả bố cục cũ (`openspec/config.yaml`,
  yêu cầu cài CLI ngoài, danh sách skill vendor). 8 skill mới viết theo `docs/spec/` và engine của
  plugin, nên hai tài liệu này lệch thực tế — cần một lượt cập nhật riêng.
- 8 skill vendor `plugins/specdocs/skills/openspec-*` chỉ dùng làm mẫu phương pháp và nên được xoá
  theo kế hoạch ban đầu; chưa xoá vì nằm ngoài danh sách file được phép sửa.
