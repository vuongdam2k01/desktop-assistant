# SPIKE SP-19: Connector Framework — Manifest Sinh Tool, Hook và Ledger Đồng Nhất

> **Mục tiêu:** Kiểm chứng mệnh đề trung tâm của PRD §10.10:  
> *"Connector là dữ liệu + adapter, không phải code đặc thù rải trong lõi. Thêm nền tảng thứ N = viết một manifest + một adapter, không sửa Job Manager, hooks, ledger hay UI."*

---

## 1. Cấu trúc thư mục

```
spikes/SP-19-connector-framework/
├── REPORT.md                         # Báo cáo thực chứng nghiệm thu bắt buộc
├── README.md                         # Hướng dẫn chạy lại và tái hiện
├── package.json                      # Cấu hình dependency (@earendil-works/pi-agent-core, typebox, etc.)
├── tsconfig.json                     # Cấu hình TypeScript NodeNext
├── evidence/
│   ├── manifest-schema.json          # Schema JSON Draft-07 đặc tả Connector Manifest
│   ├── manifest-types.ts             # TypeScript types cho manifest v0 (sẵn sàng cho M1)
│   ├── notion.manifest.json          # Manifest Notion (Read/Write, snapshot, compensation, irreversible)
│   ├── gmail.manifest.json           # Manifest Gmail (Read-only, scope profiles BYO vs Central)
│   ├── core-diff-report.md           # Báo cáo đo lường diff lõi khi thêm connector thứ 2 (0 dòng)
│   ├── run-all-summary.log           # Log tổng kết 11/11 test suites đạt
│   └── q1..q11-*.log                 # Log chi tiết từng câu hỏi
└── src/
    ├── types/manifest-types.ts       # Định nghĩa type hệ thống
    ├── generator/
    │   ├── tool-generator.ts         # Bộ sinh AgentTool động từ manifest + adapter
    │   └── mcp-compat.ts             # Bộ chuyển đổi & đánh giá tương thích chuẩn MCP
    ├── adapters/
    │   ├── adapter-interface.ts      # Interface ConnectorAdapter chuẩn hóa
    │   ├── notion-adapter.ts         # Adapter Notion gọi Notion API thật
    │   └── gmail-adapter.ts          # Adapter Gmail gọi Google REST API v1 thật
    ├── core/
    │   ├── connector-registry.ts     # Registry quản lý trạng thái kết nối
    │   ├── job-manager.ts            # Quản lý job, lọc tool theo connected status (FR-CF-06)
    │   ├── ledger.ts                 # Uniform Ledger đa connector (FR-CF-07, FR-CF-10)
    │   ├── wrapped-tool.ts           # Wrap layer cứng: Hard Gate + Pre-write snapshot + Sanitization
    │   └── evaluator/                # Pure Rule IR Hard Gate evaluator (từ SP-8, FR-AP-05)
    ├── tests/                        # 11 kịch bản kiểm chứng độc lập (test-q1 -> test-q11)
    └── runner/run-all.ts             # Runner chạy tuần tự toàn bộ 11 bài test
```

---

## 2. Yêu cầu môi trường

- **Node.js**: `v24.x` hoặc `v22.x` (đã kiểm chứng `v24.21.0`).
- **NPM**: `v11.x` hoặc mới hơn.
- **Biến môi trường**: Cần file `spikes/.env.local` chứa credentials:
  - `LLM_BASE_URL` & `LLM_API_KEY`
  - `NOTION_TOKEN_A`
- **Secrets Google**: Cần các file trong `spikes/secrets/`:
  - `google-tokens.json` (OAuth access & refresh tokens)
  - `google-oauth-client.json` (OAuth client credentials)

---

## 3. Cách chạy lại toàn bộ từ đầu

1. **Cài đặt dependencies:**
   ```bash
   cd spikes/SP-19-connector-framework
   npm install
   ```

2. **Chạy kiểm tra kiểu tĩnh (TypeScript typecheck):**
   ```bash
   npx tsc --noEmit
   ```

3. **Chạy toàn bộ 11 bài test tự động:**
   ```bash
   npm run test:all
   ```

4. **Chạy riêng lẻ từng câu hỏi:**
   ```bash
   npm run test:q1   # Schema validation
   npm run test:q2   # Dynamic tool generation & harness pi
   npm run test:q3   # Core diff measurement (0 dòng lõi)
   npm run test:q4   # Uniform Hook & Ledger (Notion write snapshot vs Gmail read)
   npm run test:q5   # Irreversible flag automatic approval gate (FR-AP-05)
   npm run test:q6   # Disconnected connector filtering (FR-CF-06)
   npm run test:q7   # Multi-connector job execution (FR-CF-10)
   npm run test:q8   # Release channel scope profiles (FR-CF-04)
   npm run test:q9   # Connector status detection (FR-CF-05)
   npm run test:q10  # Disconnect revoke & in-flight clean fail (FR-CF-08, FR-AG-07)
   npm run test:q11  # Model Context Protocol (MCP) compatibility (FR-CF-09)
   ```
