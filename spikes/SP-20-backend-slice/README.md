# SP-20 — Backend Vertical Slice: Auth, OAuth Broker, Ranh giới Dữ liệu

Spike kiểm chứng lát cắt dọc mỏng nhưng chạy thật của backend Desktop Assistant theo ADR-005, ADR-006, PRD §14.3, §12.2.

---

## 1. Công Nghệ Sử Dụng
- **Framework**: Node.js v24 + Fastify 5.x + TypeScript
- **Database**: PostgreSQL 18 (qua PGlite WASM engine nhúng sẵn, hoặc PostgreSQL server ngoài qua `DATABASE_URL`)
- **Bảo mật**: JWT (HS256/RS256), SHA-256 session token hashing, Fastify Rate Limit
- **Kiểm thử tải**: `autocannon` v8.0.0

---

## 2. Cách Chạy Lại Từ Đầu

### Bước 1: Cài đặt dependencies
```powershell
cd spikes/SP-20-backend-slice
npm install
```

### Bước 2: Chạy toàn bộ kịch bản kiểm chứng tự động (Q1–Q8, Q10, Q11)
```powershell
npm test
# hoặc: npx tsx src/scripts/run-full-verification.ts
```
Lệnh này sẽ tự động:
- Khởi động Fastify server và khởi tạo PostgreSQL database schema.
- Thử nghiệm xác thực Google Sign-In và bộ lọc Allowlist Closed Beta (Q1).
- Kiểm tra cơ chế JWT Auth Guard từ chối token không hợp lệ/hết hạn/sai chữ ký (Q2).
- Đo lường số dòng thay đổi khi bổ sung OAuth provider thứ 2 (Q3).
- Dump DDL schema Postgres và dump toàn bộ dữ liệu bảng để chứng minh ranh giới dữ liệu (Q4).
- Phân tích và đếm số bước tương tác của luồng Connect Notion chuẩn (Q5).
- Thử nghiệm refresh connector token qua broker với client_secret (Q6).
- Chạy secret scanner quét mã nguồn và logs (Q7).
- Thử nghiệm Health endpoint và bắn burst dồn dập kích hoạt rate limit 429 (Q8).
- Thử nghiệm xoá tài khoản hoàn toàn khỏi backend (Q10).
- Kiểm chứng khả năng chịu đựng và hoạt động tiếp tục của client khi backend bị sập (Q11).

### Bước 3: Chạy Load Test (Q9 — Tiêu chí phát hành #9)
```powershell
npm run test:load
# hoặc: npx tsx src/scripts/run-load-test.ts
```
Thử nghiệm mức tải đồng thời **200 connections** (2× quy mô closed beta giả định 100 users) trên cả endpoint public, broker, và auth DB upsert.

### Bước 4: Chạy Secret Scan độc lập (Q7)
```powershell
npm run test:scan
```

### Bước 5: Kiểm tra Diff Report độc lập (Q3)
```powershell
npm run test:diff
```

---

## 3. Cấu Trúc Thư Mục
```
spikes/SP-20-backend-slice/
├── package.json
├── tsconfig.json
├── README.md
├── REPORT.md
├── src/
│   ├── app.ts                  # Fastify application logic
│   ├── config.ts               # Configuration and secrets loader
│   ├── server.ts               # Server startup, auth hook, rate-limit
│   ├── db/
│   │   ├── index.ts            # PostgreSQL connection & query helpers
│   │   ├── schema.sql          # PRD §12.2 DDL schema
│   │   └── dumper.ts           # Schema & table contents dumper
│   ├── providers/
│   │   ├── types.ts            # OAuthProviderConfig interface
│   │   └── registry.ts         # Notion and Google provider declarations
│   ├── routes/
│   │   ├── auth.ts             # /v1/auth/google, refresh, logout
│   │   ├── oauth.ts            # /v1/oauth/:provider/authorize-url, exchange, refresh
│   │   ├── account.ts          # DELETE /v1/account
│   │   ├── app.ts              # /v1/app/version
│   │   └── health.ts           # /v1/health
│   ├── services/
│   │   ├── auth.service.ts     # Google ID token, allowlist, JWT issuance
│   │   └── broker.service.ts   # Generic OAuth broker exchange & refresh
│   └── scripts/
│       ├── run-full-verification.ts  # E2E test runner
│       ├── run-load-test.ts          # Autocannon load test
│       ├── run-diff-check.ts         # Q3 diff generator
│       └── run-secret-scan.ts        # Q7 secret scanner
└── evidence/
    ├── schema-dump.sql                # (Đầu ra 1) Dump DDL Postgres
    ├── table-contents-after-run.txt   # (Đầu ra 1) Dump dữ liệu sau khi chạy
    ├── openapi-v0.yaml                # (Đầu ra 2) OpenAPI 3.0 cho 8 endpoints của §14.3.2
    ├── load-test-report.md            # (Đầu ra 3) Báo cáo load test 200 concurrent users
    ├── broker-diff-report.md          # (Đầu ra 4) Báo cáo số dòng code khi thêm provider thứ 2
    ├── q1-auth-allowlist.log
    ├── q2-jwt-rejection.log
    ├── q5-notion-connect-flow.md
    ├── q6-broker-refresh.log
    ├── q7-secret-scan.log
    ├── q8-rate-limit.log
    ├── q10-account-deletion-diff.txt
    └── q11-backend-crash-resilience.log
```
