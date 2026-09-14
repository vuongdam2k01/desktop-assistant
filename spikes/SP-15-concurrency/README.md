# SPIKE SP-15 — Đồng thời giữa các job & hàng đợi rate limit dùng chung

## 1. Mục đích
Thực nghiệm và giải quyết khoảng trống kiến trúc trong PRD MVP (§14.1, FR-AG-04, FR-NT-06, FR-CF-10, FR-UD-02):
- Khảo sát hành vi ghi đồng thời lên Notion API (Workspace B - schema phức tạp nhất).
- Chứng minh tính đúng đắn của SQLite Ledger và tác động của Stale/Dirty Snapshot đối với tính năng Hoàn tác (Undo).
- Thiết kế và đo lường hàng đợi rate limit dùng chung (Fair Queueing vs FIFO) triệt tiêu Head-of-Line blocking.
- Xác định ngưỡng tải đồng thời tối ưu trước khi rate limit 3 req/s của Notion thành nút cổ chai.
- Đề xuất thiết kế Scheduler/Queue và bản vá kiến trúc cho sơ đồ khối PRD §14.1.

## 2. Cách chạy lại từ đầu

### Yêu cầu tiên quyết
1. Node.js >= 20.x và `npm` (đã kiểm chứng trên Node v24.21.0).
2. File `spikes/.env.local` chứa credential `NOTION_TOKEN_B`.
3. File `spikes/fixtures/notion.json` chứa ID database/pages Workspace B.

### Các bước chạy
```bash
# Di chuyển vào thư mục spike
cd spikes/SP-15-concurrency

# Cài đặt hoặc liên kết phụ thuộc (đã có symlink sẵn vào SP-9-undo-agent/node_modules)
npm install --save-dev tsx typescript @types/node @types/better-sqlite3
npm install better-sqlite3 dotenv

# Chạy toàn bộ test suite tự động (chạy 5 bài thực nghiệm trên Notion thật)
npm test
# hoặc:
npx tsx src/runner.ts
```

## 3. Cấu trúc thư mục
```
spikes/SP-15-concurrency/
├── REPORT.md                    # Báo cáo kết quả đầy đủ theo khung roadmap §3.4
├── README.md                    # Hướng dẫn chạy lại
├── package.json                 # Cấu hình dự án ESM
├── tsconfig.json                # TypeScript compiler options
├── src/
│   ├── types.ts                 # Type definitions (Job, ActionRecord, Lock, Queue)
│   ├── notion-client.ts         # Notion API client hỗ trợ Workspace B & sanitization
│   ├── ledger.ts                # SQLite Ledger append-only + WAL mode (SP-12)
│   ├── lock-manager.ts          # ObjectLockManager (Mutex per entity URN)
│   ├── rate-queue.ts            # FifoRateQueue & FairRateQueue (DRR per job)
│   ├── test-q1-writes.ts        # Thực nghiệm Q1: Ghi đồng thời lên page Notion
│   ├── test-q2-dirty-snapshot.ts# Thực nghiệm Q2: Dirty snapshot & kiểm chứng Undo
│   ├── test-q3-queue-benchmark.ts # Thực nghiệm Q3: Benchmark FIFO vs Fair Queue
│   ├── test-q4-concurrency-limits.ts # Thực nghiệm Q4: Scaling 1–10 job song song
│   ├── test-q5-conflict-detection.ts # Thực nghiệm Q5: Conflict detection (FR-UD-02)
│   └── runner.ts                # Master orchestrator thực thi toàn bộ suite
└── evidence/
    ├── q1-concurrent-writes.json
    ├── q2-dirty-snapshot.json
    ├── q3-fair-queue-benchmark.json
    ├── q4-concurrency-scaling.json
    ├── q5-conflict-detection.json
    ├── sp15-ledger.db           # SQLite database chứa các bản ghi ledger thực tế
    └── sp15-summary.json        # Tổng hợp các chỉ số kiểm chứng
```
