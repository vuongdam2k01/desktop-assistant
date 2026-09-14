# SPIKE SP-21 — Hợp đồng ask_user và hàng chờ lệnh khi backend gián đoạn

Spike kiểm chứng:
1. **Phần 1 — Hợp đồng ask_user (FR-INT-07, Phụ lục A.5):** Ràng buộc tham số có cấu trúc, giới hạn tối đa 1 ask mở/job, pause/resume không lặp bước (US-4.2/AC2), cơ chế gõ tự do phủ định (Ca E9), ghi ledger decision (A.5 mục 4), timeout waiting_input (A.5 mục 6), và phân giới tuyệt đối giữa ASK và APPROVAL chống lách hook (A.5 mục 7).
2. **Phần 2 — Hàng chờ ngoại tuyến (Ca E8, Tiêu chí phát hành #10, R-9):** Cơ chế lưu trữ hàng chờ cục bộ khi backend gián đoạn, phát sinh và thu hồi SYSTEM card (Phụ lục A.2), tự động gửi lại đúng thứ tự FIFO chống trùng (idempotency), duy trì liên tục các job đang chạy (R-9 / ADR-007), và khả năng phục hồi nguyên vẹn qua các lần khởi động lại ứng dụng (restart app).

---

## Cấu trúc thư mục

```
spikes/SP-21-ask-user-offline/
├── REPORT.md                         # Báo cáo chính thức trả lời chi tiết Q1-Q12
├── README.md                         # Tài liệu hướng dẫn thiết lập và chạy lại
├── package.json                      # Cấu hình dependency và npm scripts
├── tsconfig.json                     # Cấu hình TypeScript ES2022 / NodeNext
├── src/
│   ├── client.ts                     # Cấu hình BytePlus Ark LLM Provider qua pi-ai
│   ├── ledger.ts                     # SQLite Ledger (bản ghi decision, append-only triggers, queue)
│   ├── ask-user-manager.ts           # Quản lý vòng đời ASK, pending gate, timeout, resume
│   ├── ask-user-tool.ts              # Định nghĩa tool ask_user chuẩn TypeBox (A.5)
│   ├── harness.ts                    # TestHarness tích hợp Hard Gate wrap và domain tools
│   ├── backend-stub.ts               # HTTP Server stub mô phỏng backend (intake + health)
│   ├── offline-queue.ts              # LocalComposerService + SYSTEM Card lifecycle
│   ├── test-q1-schema.ts             # Test Q1: Schema tham số ask_user
│   ├── test-q2-max-one-ask.ts        # Test Q2: Ràng buộc tối đa 1 ask mở / job
│   ├── test-q3-pause-resume.ts       # Test Q3: Pause/Resume không lặp bước (US-4.2/AC2)
│   ├── test-q4-options-freetext.ts   # Test Q4: Option id vs Free text (Ca E9)
│   ├── test-q5-ledger-decision.ts    # Test Q5: Bản ghi ledger decision & append-only
│   ├── test-q6-timeout.ts            # Test Q6: Timeout waiting_input & resume sau timeout
│   ├── test-q7-evasion-hook.ts       # Test Q7: Phân giới ASK vs APPROVAL (chống lách hook)
│   ├── test-q8-offline-queue.ts      # Test Q8: Lưu hàng chờ cục bộ khi backend sập
│   ├── test-q9-system-card.ts        # Test Q9: Cấu trúc & hiển thị SYSTEM card
│   ├── test-q10-auto-resend.ts       # Test Q10: Tự gửi lại FIFO & chống gửi trùng
│   ├── test-q11-job-during-outage.ts # Test Q11: Job đang chạy không bị ảnh hưởng khi backend sập
│   ├── test-q12-persistence-storage.ts# Test Q12: Sống sót qua restart & so sánh kiến trúc lưu trữ
│   └── run-all.ts                    # Suite tổng hợp chạy toàn bộ 12 bài test
└── evidence/                         # Log thô và cơ sở dữ liệu SQLite thực nghiệm
    ├── q1-ask-user-schema.log
    ├── q2-max-one-ask.log
    ├── q3-pause-resume.log
    ├── q4-options-freetext.log
    ├── q5-ledger-decision.log
    ├── q6-timeout.log
    ├── q7-evasion-hook.log
    ├── q8-offline-queue.log
    ├── q9-system-card.log
    ├── q10-auto-resend.log
    ├── q11-job-during-outage.log
    └── q12-persistence-storage.log
```

---

## Hướng dẫn chạy lại từ đầu

### 1. Yêu cầu môi trường
- Node.js `v24.x` (đã kiểm chứng trên `v24.21.0`).
- Credential LLM cấu hình tại `spikes/.env.local` (tối thiểu `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_STRONG`).

### 2. Cài đặt thư viện
```bash
cd spikes/SP-21-ask-user-offline
npm install
```

### 3. Chạy từng bài test
```bash
npm run test:q1    # Kiểm chứng schema tham số ask_user
npm run test:q2    # Kiểm chứng tối đa 1 ask mở / job
npm run test:q3    # Kiểm chứng pause/resume đúng điểm dừng
npm run test:q4    # Kiểm chứng option id và free text (Ca E9)
npm run test:q5    # Kiểm chứng bản ghi ledger loại decision
npm run test:q6    # Kiểm chứng timeout waiting_input
npm run test:q7    # Kiểm chứng chống lách hook qua ask_user
npm run test:q8    # Kiểm chứng đưa lệnh vào hàng chờ khi backend sập
npm run test:q9    # Kiểm chứng phát sinh SYSTEM card
npm run test:q10   # Kiểm chứng gửi lại đúng thứ tự FIFO và idempotency
npm run test:q11   # Kiểm chứng job đang chạy không bị ngắt khi backend sập
npm run test:q12   # Kiểm chứng sống sót qua restart app và vị trí lưu trữ
```

### 4. Chạy toàn bộ suite (Toàn bộ 12 câu hỏi)
```bash
npm run test:all
```
Mọi file log bằng chứng sẽ được ghi tự động vào thư mục `evidence/`.
