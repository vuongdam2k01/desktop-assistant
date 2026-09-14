# SP-8 — Rule IR + Evaluator + Kháng Prompt Injection (Kiến trúc Hard Gate)

Thư mục: `spikes/SP-8-rule-ir-hardgate/`  
Hệ điều hành: Linux (x86_64) · Node.js `v24.21.0`

---

## 1. Mục tiêu và Kết quả Then chốt

Spike này hiện thực hóa **Release Criteria #1** của dự án Desktop Assistant:
- Thiết kế **Rule IR v0** đóng, tiền định (deterministic), diễn đạt đầy đủ 20 mẫu quy tắc từ SP-2 và Hardline Blocklist (FR-AP-10).
- Xây dựng **Pure Hard Gate Evaluator** bằng TypeScript thuần, không dùng LLM tại thời điểm đánh giá, độ trễ cực thấp (p99 = 0.48ms << 1ms).
- Kiểm nghiệm thực tế với **Agent THẬT** xây dựng từ Pi SDK (`@earendil-works/pi-agent-core` + BytePlus Ark `deepseek-v4-pro-ga-260813`) trên toàn bộ **20 ca đối kháng đóng băng** (`spikes/fixtures/sp8-adversarial.md` gồm 12 ca Injection + 8 ca Evasion).
- **Kết quả đạt được: 0 TRƯỜNG HỢP LỌT (20/20 đạt 100%).**

---

## 2. Cấu trúc Thư mục

```
spikes/SP-8-rule-ir-hardgate/
├── README.md                          # Tài liệu hướng dẫn tái lập (file này)
├── REPORT.md                          # Báo cáo kết quả đầy đủ theo khung mục 0..6
├── package.json                       # Cấu hình dependency và npm scripts
├── tsconfig.json                      # Cấu hình TypeScript
├── src/
│   ├── ir/
│   │   ├── types.ts                   # Định nghĩa TypeScript type cho Rule IR v0
│   │   ├── schema.json                # JSON Schema (Draft-07) đóng cho Rule IR
│   │   ├── hardline-rules.ts          # Bộ quy tắc Hardline Blocklist (FR-AP-10, DENY)
│   │   └── user-rules-catalog.ts      # Toàn bộ quy tắc R-01..R-20 và mẫu rủi ro tĩnh
│   ├── evaluator/
│   │   ├── evaluator.ts               # HardGateEvaluator thuần (Pure function, synchronous)
│   │   ├── context.ts                 # Định nghĩa ToolCallContext, SessionContext, EvaluationResult
│   │   └── predicates.ts              # Thư viện đánh giá 7 trục vị từ và chuẩn hóa thuộc tính
│   ├── agent/
│   │   ├── client.ts                  # Cấu hình Pi SDK kết nối BytePlus Ark OpenAI-compatible endpoint
│   │   ├── mock-store.ts              # Store giả lập Notion, Gmail, và Ledger append-only
│   │   ├── mock-tools.ts              # Khai báo các leaf tools (Notion, Gmail, Ask User)
│   │   └── wrapped-tools.ts           # Hàm bọc 2 tầng: Ghi Ledger Intent -> Evaluator -> Execute / Block
│   ├── tests/
│   │   ├── unit-evaluator.test.ts     # Bộ 22 test kiểm thử đơn vị evaluator và vị từ
│   │   ├── run-unit-tests.ts          # Runner chạy test đơn vị
│   │   └── benchmark-latency.ts       # Kịch bản đo độ trễ 10,000 lần đánh giá
│   └── runner/
│       ├── scenarios.ts               # Định nghĩa chi tiết 20 ca đối kháng A-01..A-20
│       ├── run-corpus.ts              # Runner chạy 20 ca đối kháng với Agent thật
│       └── run-all.ts                 # Chạy toàn bộ test, benchmark và corpus
└── evidence/
    ├── q1-ir-spec.md                  # Đặc tả kỹ thuật chi tiết Rule IR v0
    ├── q2-bypass-analysis.md          # Phân tích cặn kẽ 11 đường vòng và cơ chế chặn
    ├── q3-hardline-rules.json         # File JSON danh mục quy tắc Hardline Blocklist
    ├── q4-injection-transcripts.md    # Transcript và log ledger chi tiết 12 ca Prompt Injection
    ├── q5-evasion-transcripts.md      # Transcript và log ledger chi tiết 8 ca Evasion Tactics
    ├── q6-latency-benchmark.log       # Kết quả đo đạc độ trễ p50, p90, p95, p99
    └── adversarial-summary.json       # Tổng hợp kết quả đối soát 20/20 ca đối kháng
```

---

## 3. Cách Tái lập từ Đầu (Step-by-step Reproduction)

### Bước 0: Yêu cầu Môi trường
- Node.js `v24.21.0` trở lên.
- File `spikes/.env.local` chứa các biến môi trường:
  ```bash
  LLM_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
  LLM_API_KEY="your-api-key"
  LLM_MODEL_STRONG="deepseek-v4-pro-ga-260813"
  ```

### Bước 1: Cài đặt Dependencies
```bash
cd spikes/SP-8-rule-ir-hardgate
npm install
```

### Bước 2: Chạy Kiểm thử Đơn vị (Unit Tests)
Kiểm tra 22 kịch bản logic: Hardline blocklist (DENY), 3 mode (off/smart/on), toàn bộ vị từ R-01..R-20, ngưỡng tích luỹ job, và các đòn lách:
```bash
npm run test:unit
```
*Kết quả kỳ vọng: 22/22 tests passed (100%).*

### Bước 3: Đo đạc Độ trễ (Latency Benchmark)
Đo độ trễ của evaluator trên 10,000 lượt đánh giá ngẫu nhiên:
```bash
npm run test:benchmark
```
*Kết quả kỳ vọng: p99 < 0.50 ms << 1.0 ms.*

### Bước 4: Chạy Thực nghiệm 20 Ca Corpus với Agent THẬT
Chạy tuần tự 20 ca đối kháng A-01..A-20 từ `spikes/fixtures/sp8-adversarial.md` với Agent Pi SDK và model `deepseek-v4-pro`:
```bash
npm run test:corpus
```
*Kết quả kỳ vọng: 0 LỌT (20/20 ĐẠT).*

### Chạy toàn bộ quy trình:
```bash
npm run test:all
```
