# Desktop Assistant Backend — Operations Runbook

## 1. Production Placement Baseline

- **Region**: AWS `ap-southeast-1` (Singapore)
- **Ingress**: AWS Application Load Balancer (ALB) with TLS 1.3 termination and ACM certificate.
- **Compute**: AWS ECS Fargate running `@desktop-assistant/backend` container tasks.
- **Data Store**: AWS RDS PostgreSQL 18 Multi-AZ (isolated VPC subnets).
- **Cache / Distributed Coordination**: AWS ElastiCache for Redis 8 (cluster mode disabled, Multi-AZ).
- **Secrets Management**: AWS Secrets Manager injected as environment variables into ECS task execution.
- **Availability Objective**: Monthly 99.5% target is an operational baseline, but explicitly labeled **UNVERIFIED** until empirical deployment measurements in staging/production exist.

---

## 2. Daily Database Backup Scheduler

Database backups use PostgreSQL custom format (`pg_dump -Fc`) with libpq authentication passed strictly via child process environment, mode `0600`, atomic rename, and SHA-256 metadata generation.

### Scheduled Command
Run daily at 02:00 UTC via ECS Scheduled Task (AWS EventBridge rule):

```bash
DATABASE_URL="$DATABASE_URL" BACKEND_BACKUP_DIR="$BACKEND_BACKUP_DIR" \
  pnpm --filter @desktop-assistant/backend backup:create
```

### Where Backups Are Written
`BACKEND_BACKUP_DIR` must name a directory outside the checkout; without it the command
writes to `~/.desktop-assistant/backups`. A path inside the repository is refused, because a
dump of the account, device, session and invitation tables left in the working tree can be
committed, and the repository's secret scan does not look inside a dump file.

### Retention Policy
- Backup artifacts (`.dump` and `.json`) older than 30 days are automatically pruned only after a new successful backup finishes.
- Pruning logic runs in `pruneOldBackups(backupDir, 30)` within `src/cli/backup-database.ts`.

---

## 3. Monthly Restore Rehearsal

A restore rehearsal validates disaster recovery capability without impacting the live production database. It restores the latest backup dump into a randomly named isolated database (`rehearsal_<timestamp>_<random>`), verifies the exact 4-table schema boundary, verifies constraints and refresh-hash non-reusability, verifies the absence of sensitive credential sentinels, and drops the rehearsal database in `finally`.

### Execution Command
Run monthly on the 1st of each month:

```bash
RESTORE_ADMIN_DATABASE_URL="$ADMIN_DATABASE_URL" pnpm --filter @desktop-assistant/backend backup:restore-rehearsal
```

### Acceptance Criteria
1. Rehearsal database created and dropped cleanly.
2. Schema boundary contains exactly: `account`, `device`, `invitation`, `session`.
3. Unique constraint on `session.refresh_token_hash` rejects duplicate insertion.
4. No columns named `password`, `secret`, `access_token`, `command`, `job`, `ledger`, or `transcript`.

---

## 4. Secret Management & ECS Injection

All secrets are stored in AWS Secrets Manager and mapped to ECS task environment variables at container launch:

| Environment Variable | Secret Manager Key | Purpose |
|----------------------|--------------------|---------|
| `DATABASE_URL` | `da/backend/database_url` | RDS PostgreSQL connection string |
| `REDIS_URL` | `da/backend/redis_url` | ElastiCache Redis connection string |
| `GOOGLE_SIGN_IN_CLIENT_ID` | `da/backend/google_sign_in_client_id` | Google OAuth client ID for token verification |
| `JWT_KEY_RING` | `da/backend/jwt_key_ring` | Key ring JSON `{ currentKid, keys }` |
| `NOTION_CLIENT_ID` | `da/backend/notion_client_id` | Notion integration client ID |
| `NOTION_CLIENT_SECRET` | `da/backend/notion_client_secret` | Notion integration client secret |
| `GOOGLE_OAUTH_CLIENT_ID` | `da/backend/google_oauth_client_id` | Google OAuth connector client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `da/backend/google_oauth_client_secret` | Google OAuth connector client secret |

---

## 5. Two-Phase Key & Secret Rotation Protocols

### 5.1. Session JWT Signing Key Rotation
JWT verification uses an HS256 key ring. Secret value shape:
```json
{
  "currentKid": "k2",
  "keys": {
    "k1": "<32-byte-hex-or-base64-key-1>",
    "k2": "<32-byte-hex-or-base64-key-2>"
  }
}
```

**Two-Phase Procedure:**
1. **Phase 1 (Add & Switch)**: Generate a new 256-bit key `k2`. Update the secret in Secrets Manager retaining `k1` and adding `k2`, setting `"currentKid": "k2"`. Redeploy backend tasks. New sessions are signed with `k2`, but existing refresh tokens signed with `k1` continue to verify.
2. **Waiting Period**: Wait at least 30 days (the maximum refresh token lifetime).
3. **Phase 2 (Prune)**: Remove `k1` from the `keys` object in Secrets Manager. Redeploy backend tasks.

### 5.2. Provider Client Secret Rotation
1. Update client secret on the provider developer console (e.g. Google Cloud Console or Notion Developer Portal).
2. Update the corresponding secret reference (`GOOGLE_OAUTH_CLIENT_SECRET` or `NOTION_CLIENT_SECRET`) in Secrets Manager.
3. Restart backend service tasks. The client application requires no release or restart because the broker resolves secrets dynamically at request time.

---

## 6. Health Monitoring & Status Polling

External monitoring (Better Uptime, Pingdom, or CloudWatch Synthetics) polls:

- **Endpoint**: `GET /v1/health`
- **Interval**: Every 30 seconds
- **Expected Status**: HTTP 200 with JSON payload `{"status":"healthy","storeReachable":true,"uptimeSeconds":...}`
- **Degraded/Unhealthy Trigger**: HTTP 503 or `{"status":"unhealthy","storeReachable":false}` triggers P1 alert to on-call engineer.

---

## 7. Rollback & Alert Conditions

| Alert | Condition | Action |
|-------|-----------|--------|
| Store Unreachable | `/v1/health` returns `storeReachable: false` for > 1 minute | Check RDS instance connectivity, failover status, and pool exhaustion. |
| Rate Limit Surge | 429 response rate > 5% of total traffic | Investigate potential scraping or distributed client retry loop. |
| Provider Refusal Surge | 424 response rate > 10% of broker traffic | Verify provider developer console status and client secret validity. |
| Service Degradation | 5xx error rate > 1% over 5 minutes | Roll back ECS task definition to previous task revision. |
