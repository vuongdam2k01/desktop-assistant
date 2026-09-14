# So Sánh Chi Tiết: @earendil-works/* vs @oh-my-pi/*

## 1. Nguồn Gốc và Đội Ngũ Phát Triển

| Tiêu chí | `@earendil-works/*` | `@oh-my-pi/*` |
| :--- | :--- | :--- |
| **Tác giả gốc** | Mario Zechner (`badlogic`), người sáng lập libGDX và Pi | Can Bölük (`can1357`), Stencil Labs |
| **Đội ngũ maintainers** | Mario Zechner, Armin Ronacher (`mitsuhiko` - tác giả Flask/Sentry), R. Wachtler | Can Bölük (`can1357`), Stencil Labs |
| **Website & Repository** | [pi.dev](https://pi.dev) · `github.com/earendil-works/pi` | [omp.sh](https://omp.sh) · `github.com/can1357/oh-my-pi` |
| **Vị thế** | **Upstream chính thức** của dự án `pi.dev` được ghi trong PRD | **Downstream fork** độc lập |
| **Triết lý thiết kế** | Minimalist, extensible harness, tối ưu cho việc nhúng và tùy biến | Batteries-included, tích hợp sâu LSP/DAP cho terminal IDE |

---

## 2. Nền Tảng Runtime & Đóng Gói (Packaging)

| Tiêu chí | `@earendil-works/pi-agent-core` | `@oh-my-pi/pi-agent-core` |
| :--- | :--- | :--- |
| **Runtime Target** | Node.js (`engines: { node: ">=22.19.0" }`) | Bun (`engines: { bun: ">=1.3.14" }`) |
| **Hình thức phân phối trên npm** | Đã biên dịch sẵn ra JavaScript (`dist/index.js`) kèm TypeScript types (`dist/index.d.ts`) | **Chỉ phân phối source code TypeScript thô** (`src/index.ts`), không có file `.js` trong tarball |
| **Tương thích Node.js v24 (Native)** | ✅ Chạy trực tiếp qua `node` hoặc `tsx` không cần loader đặc biệt | ❌ Không thể import trực tiếp trong Node.js chuẩn nếu không có TS transpiler/Bun |
| **Phiên bản hiện tại (09/2026)** | `0.85.1` (chuỗi 0.74.x → 0.85.x) | `18.1.17` (nhảy số version theo chuỗi riêng của fork) |

---

## 3. Kiến Trúc & Khả Năng Cô Lập (Concurrency & Concurrency Isolation)

| Tiêu chí | `@earendil-works/pi-agent-core` | `@oh-my-pi/pi-agent-core` |
| :--- | :--- | :--- |
| **Cơ chế Pause/Resume** | Hỗ trợ qua `Agent.continue()`, `agentLoopContinue()`, và per-tool execution checkpoint | Dùng **Process-global singleton** `agentPauseGate` (`AgentPauseGate`). Khi pause sẽ đóng băng toàn bộ agent trong process |
| **Chạy đa agent song song (FR-AG-04)** | ✅ **Cô lập hoàn hảo**. Mỗi instance `Agent` sở hữu state, messages, listeners và queue riêng | ⚠️ **Rủi ro ảnh hưởng chéo**. Cơ chế pause gate chia sẻ toàn process, can thiệp vào hành vi của các agent song song |
| **Tool Execution Hooking** | Cung cấp `beforeToolCall`, `afterToolCall`, `shouldStopAfterTurn` ở cả level Agent và low-level agentLoop | Tương tự, nhưng phụ thuộc vào các hook hướng TUI / IDE |

---

## 4. Kết Luận Quyết Định Cho Desktop Assistant

**KHẲNG ĐỊNH:**
- `@earendil-works/pi-agent-core@0.85.1` và `@earendil-works/pi-ai@0.85.1` là dòng package **CHÍNH THỨC, HỢP LỆ VÀ PHÙ HỢP DUY NHẤT** để Desktop Assistant nhúng vào sản phẩm.
- Nhánh `@oh-my-pi/*` là bản fork hướng Bun và terminal IDE, không phù hợp cho hạ tầng Node.js / Electron và vi phạm nguyên tắc cô lập tiến trình của FR-AG-04.
