# Bộ prompt implement Desktop Assistant — bản đồ tuần tự / song song theo worktree

Ngày: 2026-09-13. Nguồn phân rã: `plans/reports/feature-map-260913-1606-implementation-features.md`.
Mỗi tính năng có một file prompt riêng trong thư mục này (`f00-…` đến `f25-…`). Cách dùng: mở một phiên
Claude Code **trong worktree của tính năng**, dán nguyên nội dung file prompt. Mọi prompt đều tham chiếu
mục "Ràng buộc chung" dưới đây, nên phiên mới phải đọc file này trước.

---

## 1. Ràng buộc chung cho mọi tính năng

1. Đọc `CLAUDE.md`, `.claude/rules/*.md`, `docs/spec/constitution.md` trước khi làm bất cứ gì.
2. **Không sửa `docs/spec/`.** Spec mâu thuẫn hoặc thiếu → ghi vào "Unresolved questions" của report,
   không tự sửa. Specdocs chỉ dành cho đặc tả; không đưa trạng thái code vào đó.
3. Quy trình: đọc tài liệu → trình plan trong `plans/` theo naming convention hook cung cấp → **chờ duyệt**
   → implement → verify (test hẹp rồi rộng) → review → report tại `plans/reports/`.
4. Chỉ được sửa file trong **phạm vi sở hữu** của tính năng (bảng §3) cộng các điểm nối được liệt kê trong
   prompt. File dùng chung (root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, CI workflow,
   `packages/contracts`, composition root của Electron main và Fastify) chỉ được **thêm dòng**, không tái
   cấu trúc; rebase lên `dev` trước khi PR.
5. KISS, DRY; không thêm gì ngoài phạm vi; không mock/fake data để "trông như có tính năng"; không đặt mã
   tính năng (F0x, req-xxx) vào comment, tên file, tên test, commit message.
6. Ngưỡng số và khả năng nền tảng phải trích `spikes/SP-*/REPORT.md` hoặc ghi UNVERIFIED.
7. Mọi tool tới platform đi qua wrapping factory (F5) và resource coordinator (F8); không tạo đường tắt.
8. Không commit secrets/.env; conventional commits, không tham chiếu AI, chỉ commit khi được yêu cầu.
9. Dev server/Electron chạy nền phải track PID và port cố định, tắt khi xong (`.claude/rules/process-management.md`).
10. Mã và README kỹ thuật bằng tiếng Anh; trao đổi với người dùng bằng tiếng Việt.
11. Mỗi prompt kết thúc bằng tiêu chí hoàn thành; chỉ báo DONE khi tất cả đạt và có bằng chứng chạy thật.

---

## 2. Thứ tự và sóng song song

Ký hiệu: `→` phụ thuộc cứng (phải merge vào `dev` trước). Trong một sóng, các tính năng chạy song song
trên worktree riêng vì không chung file sở hữu.

| Sóng | Tính năng chạy song song | Điều kiện vào sóng |
| --- | --- | --- |
| W0 | F0 | — |
| W1 | F1 ledger · F3 credential store · F10 backend · F17 pet rendering · F18 native window | F0 merged |
| W2 | F2 job manager · F4 approval gate · F6 provider & routing | F1 (cho F2, F4), F3 (cho F6) |
| W3 | F5 harness & wrapping · F14 rule elicitation · F15 risk judge | F2, F4, F6 |
| W4 | F7 connector framework · F13 pet-agent | F5, F3, F10 (F7); F5, F6, F2 (F13) |
| W5 | F8 resource coordinator · F21-A app shell/connectors/jobs | F7 (F8); F2, F7 (F21-A) |
| W6 | F9 Notion connector · F21-B approval/settings UI | F7, F8 (F9); F4, F6, F14, F21-A (F21-B) |
| W7 | F12 worker loop & ask_user · F19 ô thoại | F9, F5, F6 (F12); F13, F17, F18, F2, F4 (F19) |
| W8 | F16 undo · F11 Google BYO · F20 pet liveness | F9, F8, F6 (F16); F7, F8, F3, F21-A (F11); F17, F18, F19 (F20) |
| W9 | F22 account sync (spike trước) · F24 packaging/signing/update · F21-C onboarding/account | F1, F3, F10 (F22); F18, F21 (F24); F10, F19, F22 (F21-C) |
| W10 | F23 pet pack framework | F13, F17, F22 |
| — | F25 pi agent system | chờ `specdocs:continue req-025` hoàn tất |

Đường găng M1: F0 → F1 → F2 → F5 → F7 → F8 → F9 → F12. Mốc kiểm chứng M1: 20 scenario SP-4 pass,
wrap phủ 100 % tool, "no hidden operation" pass.

Nếu chỉ làm **tuần tự một phiên**, đi theo số thứ tự: F0, F1, F2, F3, F4, F5, F6, F10, F7, F8, F9, F12, F14,
F15, F16, F17, F18, F13, F19, F20, F21-A, F21-B, F11, F21-C, F22, F23, F24.

---

## 3. Quyền sở hữu file theo tính năng

| Tính năng | Thư mục sở hữu | Điểm nối được phép chạm (chỉ thêm) |
| --- | --- | --- |
| F0 | toàn repo mã (lần đầu) | — |
| F1 | `packages/ledger-store` | migration registry |
| F2 | `packages/job-manager` | composition root main |
| F3 | `packages/credential-store` | composition root main |
| F4 | `packages/approval-gate` | — |
| F5 | `packages/agent-harness` | tooling build check harness pin |
| F6 | `packages/model-routing` | `renderer-app` settings (chỉ qua IPC contract) |
| F7 | `packages/connector-framework` | composition root main |
| F8 | `packages/resource-coordinator` | `connector-framework` (hook dispatch) |
| F9 | `connectors/notion` | connector registry |
| F10 | `apps/backend` | — |
| F11 | `connectors/google` | connector registry; `renderer-app` connectors area (component BYO) |
| F12 | `packages/worker-agent` | prompt/skills assets |
| F13 | `packages/pet-agent` | persona spec assets |
| F14 | `packages/rule-elicitation` | `renderer-app` approval area |
| F15 | `packages/risk-judge` | `approval-gate` (hook tầng 2) |
| F16 | `packages/undo-pipeline` | `renderer-app` job detail (preview) |
| F17 | `apps/desktop/renderer-pet`, `apps/desktop/main/pet-window` | — |
| F18 | `native/win32-window`, `native/macos-window`, `apps/desktop/main/window-integration` | CI native jobs |
| F19 | `packages/card-queue`, `apps/desktop/renderer-pet/bubble`, `apps/desktop/main/bubble` | i18n resources |
| F20 | `packages/pet-liveness`, native privacy filter trong `native/*` | `renderer-pet` |
| F21 | `apps/desktop/renderer-app`, `apps/desktop/main/app-window` | IPC contracts |
| F22 | `packages/sync-client`, `apps/backend/src/replication` | `ledger-store`, `credential-store` (descriptor) |
| F23 | `packages/pet-pack` | `renderer-app` settings pet, `renderer-pet` loader |
| F24 | `tooling/release`, `apps/desktop/main/updater`, electron-builder config, CI release | `renderer-app` (update card) |

Điểm nóng xung đột: composition root của Electron main (`apps/desktop/main/index.ts`) và của Fastify
(`apps/backend/src/app.ts`). F0 phải thiết kế chúng dạng "một dòng đăng ký mỗi module" để mọi tính năng
chỉ thêm một dòng.

---

## 4. Quy ước worktree

```bash
# tạo worktree cho một tính năng (branch từ dev đã cập nhật)
git -C /home/<user>/projects/desktop-assistant fetch origin
git -C /home/<user>/projects/desktop-assistant worktree add \
  /home/<user>/projects/desktop-assistant-wt/f01-ledger-local-store \
  -b feat/f01-ledger-local-store origin/dev

# trong worktree: cài deps, chạy phiên Claude Code, dán prompt f01-ledger-local-store.md
cd /home/<user>/projects/desktop-assistant-wt/f01-ledger-local-store && pnpm install

# khi xong: rebase lên dev, PR vào dev, merge, xoá worktree
git rebase origin/dev && gh pr create --base dev
git -C /home/<user>/projects/desktop-assistant worktree remove ../desktop-assistant-wt/f01-ledger-local-store
```

- Nhánh: `feat/f<NN>-<slug>`; worktree: `/home/<user>/projects/desktop-assistant-wt/f<NN>-<slug>`.
- Mỗi worktree dùng port dev riêng: backend `4000 + NN`, Electron devtools `9200 + NN`, Postgres docker
  project name `da-f<NN>` để không đụng nhau.
- Merge vào `dev` theo thứ tự sóng; một tính năng chỉ PR khi mọi phụ thuộc cứng của nó đã ở `dev`.
- Trước khi mở PR: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` xanh trong worktree.
- Plan và report của tính năng ghi trong worktree (thư mục `plans/`), theo PR về `dev`.

---

## 5. Cổng quyết định cần chốt trước sóng tương ứng

| Trước sóng | Quyết định | Chặn |
| --- | --- | --- |
| W2 | Q-OQ-2 irreversible mặc định cần duyệt ở smart/on (spec đề xuất "có") | F4 |
| W4 | Q-OQ-3 persona pet (tên, tính cách, giọng vi/en, mức nói nhiều) | F13, F19, F23 |
| W1 | Q-OQ-4 phong cách đồ hoạ; F17 dùng placeholder `.riv` nếu chưa chốt | F17, F23 |
| W4 | Dev/alpha Notion đi qua broker thật (Principle VIII); nộp Notion security review | F9 |
| W5 | Offline command queue (req-021) drain lên backend để làm gì — làm rõ bằng `specdocs:update` | F21 |
| W8 | BYO route ship từ bản đầu? (đề xuất: có) | F11 |
| W9 | req-022: 4 câu hỏi mở + có chạy spike sync trước; OQ-11 hạ tầng và region | F22 |
| W0 | Mua cloud signing cert (Windows) và Apple Developer Program — lead time nhiều tuần | F24 |
| W2 | Hoàn tất design req-025 để F6/F12 để role là registry key | F6, F12 |

---

## 6. Danh sách file prompt

| File | Tính năng |
| --- | --- |
| `f00-source-base.md` | Monorepo, app rỗng, build check, CI |
| `f01-ledger-local-store.md` | Ledger SQLite append-only |
| `f02-job-manager.md` | Vòng đời job, recovery |
| `f03-credential-store.md` | Kho credential mã hoá |
| `f04-approval-gate.md` | Rule IR, evaluator, blocklist |
| `f05-agent-harness.md` | pi SDK, wrapping factory |
| `f06-model-routing.md` | Provider profile, role routing |
| `f07-connector-framework.md` | Manifest, adapter, tool generator |
| `f08-resource-coordinator.md` | Lock, fair queue, admission |
| `f09-notion-connector.md` | Notion đọc/ghi, compensation |
| `f10-backend-slice.md` | Sign-In, allowlist, broker, health |
| `f11-google-byo-oauth.md` | Gmail, Drive, BYO client |
| `f12-worker-agent-loop.md` | Agentic loop, ask_user |
| `f13-pet-agent-persona.md` | Pet-agent, persona, ack |
| `f14-rule-elicitation.md` | Hội thoại đúc kết quy tắc |
| `f15-risk-judge.md` | Tầng 2 smart mode |
| `f16-undo-pipeline.md` | Undo bù trừ |
| `f17-pet-rendering.md` | Electron + Rive |
| `f18-native-window-integration.md` | Win32 + AppKit |
| `f19-speech-bubble-cards.md` | Composer, 7 card, queue |
| `f20-pet-liveness.md` | Di chuyển, privacy filter |
| `f21-app-window.md` | Cửa sổ app (3 lát) |
| `f22-account-sync.md` | Replication, device registry |
| `f23-pet-pack-framework.md` | Pet pack |
| `f24-packaging-signing-update.md` | Đóng gói, ký, auto-update |
| `f25-pi-agent-system-deferred.md` | Chờ spec req-025 |
