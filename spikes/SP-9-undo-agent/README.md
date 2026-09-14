# SPIKE SP-9: Undo-Agent Suy Luận Chuỗi Bù Trừ Từ Ledger

## 1. Mục tiêu
Kiểm chứng năng lực của **Undo-Agent** trong việc đọc SQLite Ledger append-only (QĐ-2, SP-12) và suy luận chuỗi thao tác bù trừ (compensating actions) theo thứ tự đảo (FR-UD-01..06, WF-4, US-3.2) trên các workspace Notion thật.

## 2. Yêu cầu & Thiết lập môi trường
- Node.js >= 20 (kiểm chứng trên Node.js v24.21.0 Linux)
- Token Notion tại `spikes/.env.local`: `NOTION_TOKEN_A`, `NOTION_TOKEN_B`, `NOTION_TOKEN_C`
- Credential LLM tại `spikes/.env.local`: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_STRONG` (DeepSeek-V4 Pro)
- Danh mục database Notion tại `spikes/fixtures/notion.json`

## 3. Cách chạy lại từ đầu
```bash
cd spikes/SP-9-undo-agent
npm install
npm test
```

Lệnh trên sẽ:
1. Dựng lại schema SQLite Ledger (`sp9-ledger.db`) hỗ trợ append-only triggers.
2. Reset các workspace Notion A, B, C về Seed chuẩn (`spikes/fixtures/sp4-work-scenarios.md`).
3. Chạy 10 job THẬT qua REST API trên Notion, lưu snapshot trước/sau và metadata vào ledger.
4. Kích hoạt Undo-Agent với model DeepSeek-V4 Pro để suy luận chuỗi bù trừ.
5. Thực hiện Conflict Detection, Preview phân loại 3 nhóm, xử lý phụ thuộc nội bộ, Undo của Undo, và kiểm chứng vô hiệu hóa nút Undo cho job 100% irreversible.
6. Xuất toàn bộ bằng chứng JSON vào thư mục `evidence/`.

## 4. Cấu trúc thư mục
```
spikes/SP-9-undo-agent/
├── REPORT.md                         # Báo cáo kết luận và trả lời chi tiết Q1..Q6
├── README.md                         # Hướng dẫn chạy lại
├── package.json                      # Cấu hình tsx, pi-ai, better-sqlite3
├── tsconfig.json
├── evidence/                         # Bằng chứng dữ liệu thật
│   ├── q1-llm-reasoning.json         # Kế hoạch bù trừ LLM sinh cho 10 job
│   ├── q2-preview-classification.json# Kết quả phân loại 3 nhóm Preview
│   ├── q3-conflict-detection.json    # Chi tiết đo lường False-Positive và False-Negative
│   ├── q4-internal-dependency.json   # Kế hoạch và kết quả ca Tạo A -> Sửa A
│   ├── q5-undo-of-undo.json          # Bằng chứng Undo của Undo (3 job ledger riêng)
│   ├── q6-irreversible-disable.json  # Bằng chứng vô hiệu hóa nút Undo (FR-UD-06)
│   ├── sp9-ledger.db                 # File SQLite database chứa ledger thật
│   └── summary-results.json          # Bảng tổng hợp số đo cốt lõi
└── src/
    ├── client.ts                     # LLM client DeepSeek-V4 Pro
    ├── db.ts                         # SQLite Ledger repository (SP-12)
    ├── notion-client.ts              # Notion REST API + Sanitizer (SP-1)
    ├── notion-state.ts               # Reset seed và snapshot workspace
    ├── types.ts                      # Kiểu dữ liệu ActionRecord, Preview, UndoPlan
    ├── worker-jobs.ts                # 10 job worker thật chạy trên Notion
    ├── undo-agent.ts                 # Core Undo-Agent: LLM reasoner, conflict detector, preview, executor
    └── runner.ts                     # Script điều phối toàn bộ bài kiểm tra
```
