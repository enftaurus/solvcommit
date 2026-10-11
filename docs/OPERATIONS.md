# LeetSync Operations & Deployment Guide

> Production deployment architecture, zero-downtime operations, disaster recovery, runbooks, and security verification.
> Last updated: Phase 6 (Reliability & Release Readiness)

---

## 1. System Architecture & Components

LeetSync consists of two native Go services, two containerized infrastructure dependencies, and cross-browser extensions:

```
┌────────────────────────────────────────────────────────┐
│               User Browser Session                      │
│   ┌─────────────────────┐    ┌─────────────────────┐   │
│   │  Chrome Extension   │    │  Firefox Extension  │   │
│   │    (Manifest V3)    │    │    (Manifest V3)    │   │
│   └──────────┬──────────┘    └──────────┬──────────┘   │
└──────────────┼──────────────────────────┼──────────────┘
               │  POST /api/v1/sync/submissions
               ▼                          ▼
┌────────────────────────────────────────────────────────┐
│           Reverse Proxy (Caddy / Nginx with TLS)       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                  LeetSync API Server                   │
│   - Port :8080 (Go native net/http)                    │
│   - Embedded SPA Web Dashboard (web/dist fallback)     │
│   - Endpoints: Auth, Devices, Repositories, Ingestion  │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
        acks=all                          │ Metadata only
               ▼                          ▼
┌──────────────────────────┐    ┌─────────────────────────┐
│       Apache Kafka       │    │       PostgreSQL        │
│   - Topic: submissions   │    │   - Metadata only       │
│   - Retention: 7 days    │    │   - Device sessions     │
│   - Carries source code  │    │   - Unique constraints  │
└──────────────┬───────────┘    └────────────▲────────────┘
               │                             │
               ▼                             │ Updates status
┌────────────────────────────────────────────┴───────────┐
│               LeetSync Publisher Worker                │
│   - In-memory per-repo mutex commit serialization      │
│   - Ephemeral RS256 GitHub App installation tokens     │
│   - Non-destructive README & path-conflict checks      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ GitHub Contents API
┌────────────────────────────────────────────────────────┐
│             User's GitHub Repository                   │
│   problems/<slug>/submission-<id>.<ext>                │
└────────────────────────────────────────────────────────┘
```

---

## 2. Environment Configuration Reference

Create `.env` based on `.env.example`:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `APP_ENV` | `development` | Runtime environment (`development`, `production`, `test`). |
| `HTTP_ADDR` | `:8080` | Bind address and port for the API server. |
| `DATABASE_URL` | `postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable` | PostgreSQL connection string (`pgxpool`). |
| `KAFKA_BROKERS` | `localhost:9092` | Comma-separated list of Kafka broker bootstrap addresses. |
| `KAFKA_TOPIC` | `submissions` | Kafka topic for accepted submissions. |
| `SESSION_SECRET` | *(random 32+ bytes)* | Secret used to sign session cookies and extension bearer access tokens. |
| `MAX_CODE_BYTES` | `524288` (512 KB) | Maximum allowed solution source code size per submission. |
| `GITHUB_APP_ID` | `""` | GitHub App ID (from GitHub Developer Settings). |
| `GITHUB_APP_PRIVATE_KEY_PATH` | `""` | Path to GitHub App `.pem` private key file. |
| `GITHUB_APP_CLIENT_ID` | `""` | GitHub App OAuth Client ID for web dashboard login. |
| `GITHUB_APP_CLIENT_SECRET` | `""` | GitHub App OAuth Client Secret. |

---

## 3. Production Deployment Guide (Single VM)

### 3.1 Host Prerequisites
- Linux OS (Ubuntu 22.04 LTS or Debian 12 recommended).
- Docker 24+ & Docker Compose v2.
- Go 1.22+ runtime (or built Go binaries).
- Node.js 18+ (for building web dashboard assets).

### 3.2 Deployment Steps
1. **Clone repository and set permissions**:
   ```bash
   git clone https://github.com/enftaurus/solvcommit.git /opt/leetsync
   cd /opt/leetsync
   ```
2. **Configure production environment**:
   ```bash
   cp .env.example .env
   # Edit .env: set production database password, session secret, and GitHub App credentials
   ```
3. **Start infrastructure containers**:
   ```bash
   ./dev.sh infra
   ```
4. **Build assets and Go binaries**:
   ```bash
   ./dev.sh build
   ```
5. **Configure systemd service units**:
   
   `/etc/systemd/system/leetsync-api.service`:
   ```ini
   [Unit]
   Description=LeetSync API Server
   After=network.target

   [Service]
   Type=simple
   User=leetsync
   WorkingDirectory=/opt/leetsync
   EnvironmentFile=/opt/leetsync/.env
   ExecStart=/opt/leetsync/bin/api
   Restart=always
   RestartSec=5
   LimitNOFILE=65536

   [Install]
   WantedBy=multi-user.target
   ```

   `/etc/systemd/system/leetsync-publisher.service`:
   ```ini
   [Unit]
   Description=LeetSync Publisher Worker
   After=network.target

   [Service]
   Type=simple
   User=leetsync
   WorkingDirectory=/opt/leetsync
   EnvironmentFile=/opt/leetsync/.env
   ExecStart=/opt/leetsync/bin/publisher
   Restart=always
   RestartSec=5
   LimitNOFILE=65536

   [Install]
   WantedBy=multi-user.target
   ```
6. **Enable and start services**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now leetsync-api leetsync-publisher
   ```

---

## 4. Zero-Downtime Operations & Maintenance

### 4.1 Service Shutdowns and Restarts
- Both `api` and `publisher` trap `SIGINT` and `SIGTERM`.
- **Publisher**: When receiving `SIGTERM`, it finishes current in-flight Git commits before exiting, ensuring commits are never interrupted midway.
- **Kafka Retention Buffer**: During worker maintenance, newly ingested submissions queue safely in Kafka (`submissions` topic retention: 7 days). When the publisher starts again, it resumes processing the backlog seamlessly.

### 4.2 Database Migrations
Migrations are strictly additive and versioned under `migrations/`:
```bash
./scripts/migrate.sh
```
All migrations run inside atomic SQL transactions with a `schema_migrations` tracking table.

---

## 5. Security & Privacy Audit Verification

| Architectural Invariant | Verification Procedure | Status |
| :--- | :--- | :--- |
| **Zero LeetCode Credentials** | Check database columns and logs: backend never prompts for, receives, or stores LeetCode passwords or cookies. | Verified |
| **Code Only in Kafka** | Tested by `TestSecurityAndCodeAbsenceInvariant`. No column in PostgreSQL contains solution source code. | Verified |
| **Hashed Refresh Tokens** | Refresh tokens stored exclusively as SHA-256 hex hashes in `devices.refresh_token_hash`. | Verified |
| **Token Reuse Breach Protection** | Tested by `TestTokenRotationReuseBreachDetection`. Presenting an already-used refresh token revokes the entire token family. | Verified |
| **Serialized Git Commits** | Tested by `TestConcurrencyAndPerRepoSerialization`. Per-repo in-memory mutex prevents Git tree collisions. | Verified |
| **Non-Destructive Writes** | Tested by `TestPublishingPipelineIntegration`. Existing READMEs are never modified; blob SHAs prevent overwrites. | Verified |
| **Account Hard-Deletion** | Tested by `TestAccountHardDeletion`. `DELETE /api/v1/me` cascades and completely purges all user rows. | Verified |

---

## 6. Disaster Recovery & Troubleshooting Runbooks

### Runbook 1: Kafka Broker Outage
- **Symptoms**: Extension receives HTTP 503 from `/api/v1/sync/submissions`; API logs `temporary ingestion failure`.
- **Mitigation**:
  1. The browser extension automatically holds un-submitted solutions in its local offline IndexedDB queue.
  2. Exponential backoff (1s, 2s, 4s... up to 60s) prevents server flooding.
  3. Once Kafka recovers, the extension drains the queue and backfills any missing IDs via `POST /api/v1/sync/backfill`.

### Runbook 2: GitHub API Rate Limits
- **Symptoms**: Publisher logs `GitHub rate limit exceeded (HTTP 429)`.
- **Mitigation**:
  1. GitHub App installation tokens possess a 5,000 requests/hour quota per installation.
  2. The publisher worker pauses processing for that repository and backs off, leaving messages in Kafka.
  3. No submissions are lost; processing resumes automatically when the quota resets.

### Runbook 3: Conflicting Target Path (`ERR_PATH_CONFLICT`)
- **Symptoms**: Submission status transitions to `failed` with error code `ERR_PATH_CONFLICT`.
- **Cause**: A file already exists at `problems/<slug>/submission-<id>.<ext>` on GitHub with different content.
- **Resolution**:
  1. LeetSync strictly refuses to overwrite existing files to preserve data integrity.
  2. User can view the failed submission on the web dashboard.
  3. If desired, user can delete or rename the conflicting file in their repository and click **Retry** on the dashboard.

---

## 7. Operational Acceptance Criteria Matrix

| PRD Acceptance Criterion | Verification Test / Implementation | Status |
| :--- | :--- | :--- |
| User sign-in with GitHub & pair extension | `internal/api/routes_test.go:TestGitHubOAuthFlow`, `TestDevicePairAndRefresh` | **PASS** |
| Revoked device rejected on next call | `internal/api/routes_test.go:TestDeviceRevocation` | **PASS** |
| Reused refresh token revokes family | `tests/reliability_acceptance_test.go:TestTokenRotationReuseBreachDetection` | **PASS** |
| Sessions page displays raw IP & last seen | `internal/devices/service.go`, `web/src/components/SessionsManager.tsx` | **PASS** |
| Accepted submission queued, published, displayed | `tests/publishing_integration_test.go:TestPublishingPipelineIntegration` | **PASS** |
| Rejected/unverified submissions never queued | `internal/submissions/service_test.go:TestValidateIngestion_StatusNotAccepted` | **PASS** |
| Duplicate send creates no duplicate commit | `tests/publishing_integration_test.go`, database unique constraint | **PASS** |
| Submissions sent while Kafka down retry cleanly | `extension/queue.test.js:OfflineQueue - Transient failure applies exponential backoff` | **PASS** |
| Backfill sends only missing submissions | `extension/queue.test.js`, `internal/api/routes_test.go:TestSyncBackfill` | **PASS** |
| Multiple accepted submissions keep history | `internal/publisher/publisher.go` (`submission-<id>.<ext>` naming) | **PASS** |
| Conflicting existing file produces conflict, not overwrite | `tests/publishing_integration_test.go` (`ErrPathConflict`) | **PASS** |
| Expired message marked expired, recoverable | `internal/submissions/service.go:RetrySubmission` | **PASS** |
| Pause & resume sync pipeline | `internal/api/routes_test.go:TestSyncDashboardEndpoints`, dashboard UI | **PASS** |
| Source code absent from DB & logs | `tests/reliability_acceptance_test.go:TestSecurityAndCodeAbsenceInvariant` | **PASS** |
| Stopping & restarting keeps PostgreSQL data | Verified via `./dev.sh` and named Docker volume `postgres_data` | **PASS** |
| Tests run without real production credentials | Verified: mocked GitHub HTTP server and ephemeral RSA test keys | **PASS** |
