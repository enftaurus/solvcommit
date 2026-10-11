# Architecture

> System components, end-to-end data flow, and storage boundaries for LeetSync.
> Last updated: Phase 0 (Pre-implementation)

See [`docs/PRD.md#architecture`](file:///home/rajababu/intern/leetsync/docs/PRD.md#architecture) for the full specification.

## Components
1. **Chrome Extension (MV3)**: Detects accepted submissions, fetches source code and metadata within the user's active session, buffers failed requests offline, and runs periodic backfill.
2. **Go API (`cmd/api`)**: Authenticates users (GitHub OAuth), manages device pairing and refresh token rotation, validates incoming submissions, produces messages to Kafka with `acks=all`, and serves dashboard queries.
3. **Kafka (`submissions`)**: Durable, retention-bound buffer carrying source code payloads (7-day retention). Partitioned by `user_id` to guarantee per-user ordering. (DLQ topic dropped per D-20).
4. **Go Publisher (`cmd/publisher`)**: Consumes from Kafka, verifies repository path existence on GitHub, performs serialized commits per repo, records outcome in PostgreSQL, and commits Kafka offsets.
5. **PostgreSQL**: Relational store for users, accounts, device sessions, repository configurations, and submission metadata (no code, no `audit_events` table).
6. **Web Dashboard (`web/`)**: React + TypeScript + Vite frontend for onboarding, repo selection, device management, and sync monitoring.

## Data Flow
```
LeetCode (in browser) 
       │ (accepted event)
Chrome Extension ──[POST /sync/submissions]──► Go API
                                                  │ (acks=all)
                                                  ▼
                                            Kafka: submissions (carries code)
                                                  │
                                                  ▼
PostgreSQL (metadata only) ◄──[updates]── Go Publisher ──► GitHub API (commits code)
```

## Storage Boundaries
- **Source Code**: Lives **exclusively** in Kafka messages (retention: 7 days) and final GitHub repository commits. Code is **never** written to PostgreSQL, disk logs, or metrics.
- **Metadata**: Stored in PostgreSQL (submission ID BIGINT, problem slug, language, status, content hash, commit SHA, path).
- **Credentials**:
  - LeetCode credentials: Zero custody; never leave the user's browser.
  - GitHub App tokens: Ephemeral installation tokens minted on demand from the App's private key and cached in memory for up to 1 hour; no token encryption at rest needed in MVP (D-19).
  - Device refresh tokens: Stored only as cryptographic hashes (`SHA-256`); raw tokens rotate on each use. Previous hash tracked to detect reuse.
