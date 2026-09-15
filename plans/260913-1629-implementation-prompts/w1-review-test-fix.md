# W1-RV — Review, test và fix sau khi hợp nhất sóng 1

Đọc trước: `plans/260913-1629-implementation-prompts/README.md` §1 (ràng buộc chung), §3 (quyền sở hữu file).
Làm trực tiếp trên `dev`, không cần worktree. Trạng thái đầu vào: năm tính năng W1 đã merge, mọi cổng tĩnh
đang xanh. Nhiệm vụ của bạn **không phải** chạy lại cho xanh lần nữa, mà là tìm những gì cổng tĩnh không bắt được.

Prompt này tự nó là quy trình. Đừng bọc nó trong một skill điều phối ở ngoài — workflow riêng của skill đó sẽ
lấn át phần đặc thù ở đây. Các skill được gọi **bên trong** phiên, tại đúng những mục chỉ định bên dưới; mỗi
lần gọi phải đọc trọn `SKILL.md` của skill đó trước khi hành động, và nếu skill không có trong catalogue của
runtime thì làm bằng năng lực gốc chứ không bịa ra lời gọi.

## Bối cảnh

Năm tính năng của sóng 1 được năm phiên độc lập viết song song trên năm worktree, mỗi phiên tự verify xanh
trong cô lập, rồi được hợp nhất tuần tự vào `dev`:

| Tính năng | Nhánh | Vùng sở hữu |
| --- | --- | --- |
| Action ledger & local store | `feat/f01-ledger-local-store` | `packages/ledger-store` |
| Credential store mã hoá | `feat/f03-credential-store` | `packages/credential-store`, `apps/desktop/main/credential-store` |
| Backend slice | `feat/f10-backend-slice` | `apps/backend` |
| Pet rendering (Rive) | `feat/f17-pet-rendering` | `apps/desktop/renderer-pet`, `apps/desktop/main/pet-window` |
| Native window integration | `feat/f18-native-window-integration` | `native/*`, `apps/desktop/main/window-integration` |

Dải commit cần review: `pre-w1-integration..dev` (tag `pre-w1-integration` = `888f0b2`). Trong dải này có năm
merge commit, một commit sửa lỗi tích hợp, và một report. Báo cáo hợp nhất đầy đủ nằm ở
`plans/reports/integration-260914-0622-w1-merge.md` — đọc trước khi bắt đầu.

Điểm mấu chốt cần hiểu: **mỗi tính năng đã được chính tác giả của nó verify xanh, nên lỗi còn lại gần như
chắc chắn nằm ở đường nối giữa chúng, chỗ không ai sở hữu.** Lần hợp nhất vừa rồi đã lộ ra đúng một lỗi loại
đó và nó không hề bị bất kỳ cổng tĩnh nào bắt: module native window pre-warm một card window ẩn trước khi pet
window được tạo, khiến `electronApp.firstWindow()` trong e2e của pet trả về nhầm cửa sổ và cả 14 test fail.
Giả định "pet là cửa sổ đầu tiên" chỉ đúng khi tính năng đó đứng một mình. Hãy coi đây là **mẫu lỗi cần đi
săn**, không phải sự cố đơn lẻ đã đóng lại.

## Mục tiêu

Chứng minh cây đã hợp nhất đúng như tổng của năm tính năng, tìm và sửa những sai lệch còn lại ở đường nối,
rồi báo cáo trung thực phần nào chưa chứng minh được trên máy này.

## Tài liệu bắt buộc đọc

1. `docs/spec/constitution.md`, đặc biệt nguyên tắc III (ledger trước khi hành động, append-only, fail-closed),
   VII (dữ liệu thuộc tài khoản, bản SQLite cục bộ là bản làm việc), và bất biến "External Content Is Data".
2. `plans/reports/integration-260914-0622-w1-merge.md` — bốn quyết định hợp nhất không phải gộp cơ học, và
   danh sách file đã giải quyết xung đột bằng tay.
3. Report của từng tính năng trong `plans/reports/`: `f01-…`, `f03-…`, `f10-…`, `f17-…`, `f18-…`. Mỗi report
   liệt kê tiêu chí hoàn thành mà tác giả tuyên bố đã đạt — nhiệm vụ của bạn là kiểm chứng lại chúng **trên
   cây đã merge**, không tin lời tuyên bố.
4. Đặc tả sống của các domain liên quan trong `docs/spec/capabilities/`: `ledger`, `platform`, `pet`, `uix`,
   `backend`, `app`.

## Phạm vi review

### 1. Kiểm chứng lại từng quyết định hợp nhất thủ công

Skill: `ak:code-review`, chỉ đích danh từng file dưới đây. **Không** dùng chế độ `codebase` hay
`codebase parallel` — chúng sẽ đi soi lại ruột năm tính năng vốn đã được tác giả verify xanh, đúng phần việc
mục này cố ý bỏ qua. Cũng lưu ý skill đó nhận PR, một commit hash, hoặc `--pending`, chứ **không** nhận dải
commit, nên đừng đưa `pre-w1-integration..dev` cho nó; việc đối chiếu ba phía bên dưới làm bằng `git diff` trực tiếp.

Chín file dưới đây được giải quyết xung đột bằng tay. Với mỗi file, so sánh ba phía — bản trên `dev` hiện tại,
bản của nhánh nguồn, và bản gốc `888f0b2` — để khẳng định **không phía nào bị mất hành vi**:

- `apps/desktop/main/index.ts` — thứ tự khởi tạo: ghi đè `DESKTOP_ASSISTANT_USER_DATA` đặt trước single
  instance lock. Xác nhận lock thật sự nằm trong thư mục profile bị ghi đè, và hai instance với hai profile
  khác nhau cùng chạy được.
- `apps/desktop/main/context.ts` — các trường dùng chung (`windowIntegration`, `petController`, `cardWindow`,
  `credentialStore`). Tìm trường nào được khai báo mà không ai gán, hoặc gán sau khi đã có người đọc.
- `apps/desktop/preload/index.ts` — cầu IPC gộp hai namespace `credentials` và `pet`. Xác nhận không namespace
  nào rò rỉ giá trị nhạy cảm và cả hai vẫn khớp kiểu với phía main.
- `apps/desktop/main/pet-window/register-pet-window-module.ts` — pet window giờ lấy thuộc tính cửa sổ từ
  facade `browserWindowOptions('pet')`. Đối chiếu từng thuộc tính mà bản F17 gốc đặt tay với thứ facade trả về
  trên **cả ba** nhánh nền tảng (win32, macOS, fallback). Thiếu một thuộc tính là một lỗi thật.
- `apps/desktop/scripts/package-unsigned.mjs` — script smoke gộp ba phép dò. Xác nhận cả ba marker đều được
  assert và không nhánh nền tảng nào bị bỏ sót.
- `.github/workflows/ci.yml` — các bước của hai tính năng được xếp nối nhau. Kiểm tra phụ thuộc giữa các bước
  (ví dụ bước nào cần `xvfb` đã cài, bước nào tự skip theo OS) và thứ tự có đúng không.
- `eslint.config.mjs`, `apps/desktop/package.json`, `pnpm-lock.yaml` — lockfile đã được tái sinh; chạy
  `pnpm install --frozen-lockfile` để chứng minh nó khớp với tập manifest đã merge.

### 2. Đi săn đúng mẫu lỗi đã lộ ra

Skill: `ak:scout`. Đây thuần tuý là việc tìm kiếm có định hướng trên toàn repo, và phải quét cả bốn nhóm dưới
đây rồi báo cáo từng nhóm, kể cả nhóm không tìm thấy gì.

Tìm mọi giả định mang tính **thứ tự hoặc vị trí** mà một tính năng đặt ra khi nó còn đứng một mình, nay có
tính năng khác chen vào giữa. Ít nhất hãy soi:

- thứ tự đăng ký module trong composition root của Electron main và của Fastify, và mọi module đọc một trường
  của context mà module khác ghi;
- mọi chỗ chọn đối tượng theo chỉ số hoặc theo "cái đầu tiên" thay vì theo danh tính (cửa sổ, cổng IPC, route,
  handler, bản ghi, tiến trình con);
- listener và handler IPC đăng ký trùng kênh giữa hai tính năng;
- tài nguyên dùng chung ở tầng hệ điều hành: thư mục userData, file khoá, tên database, cổng mạng, tên tray.

### 3. Bất biến hiến pháp trên cây đã merge

- Ledger: chứng minh bằng test rằng ghi ledger vẫn đi **trước** hiệu ứng ngoài và vẫn fail-closed khi việc
  ghi hỏng, đúng như nguyên tắc III, khi được gọi qua đường dây đã hợp nhất chứ không chỉ trong unit test của
  riêng package.
- Credential store: xác nhận renderer chỉ nhận được `{ present, lastUpdated }` và không có đường nào đưa giá
  trị giải mã qua IPC; kiểm tra lại cả đường đọc hỏng (`CREDENTIAL_UNREADABLE`) vẫn fail-closed sau merge.
- Backend: xác nhận biên dữ liệu vẫn đúng — backend không giữ token và không thấy nội dung công việc của
  người dùng.

### 4. Trùng lặp và rác ở đường nối

Năm phiên viết song song rất dễ sinh ra hai bản cùng làm một việc. Tìm helper, hằng số, kiểu dữ liệu, hoặc
tiện ích test bị nhân đôi giữa các package, và đề xuất gộp **chỉ khi** việc gộp không phá ranh giới sở hữu ở
README §3. Nếu việc gộp vượt ranh giới, ghi vào report thay vì tự làm.

## Cách chạy test

Chạy từ hẹp tới rộng, và ghi lại số đo thật chứ không chỉ ghi "pass":

```bash
pnpm contracts:check && pnpm lint && pnpm typecheck && pnpm test
pnpm build && pnpm build:check && pnpm package:unsigned
xvfb-run -a pnpm --filter @desktop-assistant/desktop test:credential-store:os
cd apps/desktop && CI=1 DESKTOP_ASSISTANT_SOFTWARE_RENDERING=1 xvfb-run -a pnpm run test:e2e
pnpm --filter @desktop-assistant/desktop test:e2e:window-integration   # tự skip trên Linux
pnpm native:build && pnpm native:test                                   # tự skip trên Linux
```

Mốc tham chiếu của cây hiện tại: 8 package typecheck sạch, 27 file test xanh, e2e pet 14/14, bản đóng gói in
ra `SQLITE_NATIVE_READY` và `CREDENTIAL_STORE_PACKAGE_READY`, smoke credential store in
`CREDENTIAL_STORE_LINUX_FAIL_CLOSED_OK`. Nếu con số của bạn thấp hơn, đó là regression phải truy nguyên.

Thêm test mới cho **mỗi lỗi tích hợp bạn tìm được**, đặt ở package sở hữu hành vi đó, và test phải fail trước
khi sửa. Skill cho phần thiết kế test mới: `ak:test create` — dùng chế độ `create`, vì việc ở đây là dựng suite
mới cho một hành vi chưa được phủ, không phải chạy lại suite sẵn có.

### Quy trình bắt buộc cho mỗi lỗi tìm được

Chứng minh nguyên nhân trước, sửa sau. Skill: `ak:debug` để truy nguyên gốc rễ, rồi `ak:fix` để khắc phục.
**Không dùng `ak:fix --auto`** trong phiên này: chế độ tự động sẽ bỏ qua hai ràng buộc bắt buộc ở đây, là test
phải fail trước khi sửa, và cấm đảo ngược một quyết định đã được kiểm chứng bằng nguồn hoặc bằng phép đo.
Trình tự cho mỗi lỗi là: `ak:debug` chứng minh nguyên nhân → `ak:test create` viết test fail → `ak:fix` sửa →
chạy lại test.

## Giới hạn nền tảng — không được vượt

Máy này là Linux. Native window integration và số đo fps của pet **không thể** chứng minh tại đây: e2e window
integration và `native:build`/`native:test` tự skip với exit 0. Không được coi exit 0 đó là bằng chứng đạt.
Mọi khẳng định về Windows hoặc macOS phải dựa trên một lần chạy CI thật trên `dev` sau merge, hoặc phải được
ghi rõ là **UNVERIFIED** kèm lý do. Ngưỡng số và khả năng nền tảng phải trích `spikes/SP-*/REPORT.md`.

## Phạm vi được sửa

Được sửa mã sản phẩm và test trong `apps/`, `packages/`, `native/`, `connectors/`, `tooling/`, và
`.github/workflows/`. **Không sửa `docs/spec/`** — mâu thuẫn hoặc thiếu sót của đặc tả thì ghi vào mục câu hỏi
mở của report. Giữ nguyên quyết định đã được kiểm chứng bằng nguồn hoặc bằng phép đo; chỉ đảo ngược khi có
bằng chứng mới, và khi đảo ngược thì nêu rõ bằng chứng đó.

Commit theo conventional commits, không tham chiếu AI, không đặt mã tính năng (F0x, req-xxx) vào comment, tên
file, tên test hay commit message. Chỉ commit khi được yêu cầu.

## Ngoài phạm vi

Không thêm tính năng của sóng 2 (job manager, approval gate, model routing). Không tái cấu trúc composition
root hay các file dùng chung ngoài mức cần thiết để sửa một lỗi cụ thể đã chứng minh. Không đụng vào
`docs/spec/`. Không chạy phép đo soak 8 giờ trong phiên — nếu cần thì kích hoạt workflow nền và đọc kết quả ở
phiên sau.

## Tiêu chí hoàn thành

1. Chín file giải quyết xung đột thủ công đều được đối chiếu ba phía và kết luận rõ ràng là không mất hành vi,
   hoặc phần mất đã được khôi phục kèm test.
2. Đã rà hết bốn nhóm giả định thứ tự/vị trí ở mục 2 và báo cáo từng nhóm, kể cả nhóm không tìm thấy gì.
3. Mỗi lỗi tích hợp tìm được đều có một test fail-trước-khi-sửa, và test đó xanh sau khi sửa.
4. Ba bất biến hiến pháp ở mục 3 được chứng minh trên cây đã merge, không phải bằng cách trích lại report cũ.
5. Toàn bộ lệnh ở mục "Cách chạy test" xanh, với số đo ghi lại, và không thấp hơn mốc tham chiếu.
6. `pnpm install --frozen-lockfile` thành công, chứng minh lockfile tái sinh khớp manifest.
7. Report tại `plans/reports/` theo naming convention của hook, nêu rõ: đã sửa gì, tìm thấy gì mà không sửa và
   vì sao, phần nào UNVERIFIED do giới hạn Linux, và các câu hỏi mở ở cuối.

## Bước sau phiên này

Khi mọi tiêu chí trên đã đạt và `dev` được push, mở PR rồi chạy `ak:review-pr <số PR>` để có một lượt review
độc lập. Chế độ PR đọc được trọn vẹn diff của cả dải merge — thứ mà chế độ commit đơn của `ak:code-review`
không làm được — nên đó mới là chỗ dùng đúng sức của nó. Đừng chạy bước này thay cho §1: nó bổ sung, không thay thế.
