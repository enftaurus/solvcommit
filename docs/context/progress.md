# Progress & Phase Tracking

> Current project status, completed milestones, upcoming phases, and Ponytail shortcuts.
> Last updated: Phase 0 (Pre-implementation)

See [`docs/PRD.md#phases-mvp-and-acceptance`](file:///home/rajababu/intern/leetsync/docs/PRD.md#phases-mvp-and-acceptance) for phase exit criteria.

## Current Status
- **Current Phase**: Phase 5 (Dashboard)
- **Status**: Phase 4 GitHub Publishing completed and verified. GitHub App client with ephemeral token caching, repository selection with non-destructive README handling, publisher worker with per-repo commit serialization, ambiguous write recovery, and path conflict protection all pass automated tests.
- **Blocked**: None.

## Phase Checklist
- [x] **Setup & Context**: Steps 1 to 3 documentation, decision seeding, knowledge graph.
- [x] **Phase 0: Capture Spike**: Extension content script capturing accepted submission code in user session and committing to a test repo.
- [x] **Phase 1: Scaffold & Infrastructure**: Go module, Docker Compose (PostgreSQL, Kafka), migrations, `dev.sh`.
- [x] **Phase 2: Identity & Sessions**: GitHub App, device pairing, rotating refresh tokens with reuse detection, IP recording.
- [x] **Phase 3: Ingestion Pipeline**: Ingestion endpoint, schema validation, Kafka producer (`acks=all`), offline extension queue, backfill.
- [x] **Phase 4: GitHub Publishing**: Safe file layout (`submission-<id>.<ext>`), serialized repo commits, idempotent retry.
- [ ] **Phase 5: Dashboard**: React + Vite UI, repository selection, device sessions, sync history, retry/resend controls.
- [ ] **Phase 6: Reliability & Release Readiness**: Concurrency stress tests, failure recovery, security audit, deployment documentation.

## Ponytail Shortcuts
1. `ponytail: dropped submissions.dlq topic` - Failed status recorded directly in PostgreSQL row; recovery is extension resend (D-20).
2. `ponytail: ephemeral in-memory installation tokens` - No token encryption at rest or rotation tables in DB; mint 1-hour tokens on demand from App private key (D-19).
3. `ponytail: dropped audit_events table` - Security events logged via structured application logs (D-22).
4. `ponytail: dropped /metrics endpoint & Prometheus` - Telemetry via structured JSON logging only (D-21).
5. `ponytail: dropped GeoIP lookup & location alerts` - Store and display raw `first_ip` and `last_ip` strings only (D-13, D-22).
6. `ponytail: show extension devices only` - Omit website sessions from the sessions management list (D-13).
7. `ponytail: deferred repo creation` - User creates repo on GitHub and installs app; backend verifies write access (D-23).
8. `ponytail: stdlib log/slog handler` - Structured logging using Go standard library (`log/slog`) without extra dependencies.
9. `ponytail: stdlib net/http.ServeMux` - Routing implemented with standard library patterns without external router framework.
10. `ponytail: stdlib .env parser` - Simple line scanner for `.env` fallback without third-party libraries.
11. `ponytail: minimal migration runner` - Transactional SQL migration executor using `pgxpool` without external migration binaries.
12. `ponytail: stdlib HMAC access tokens` - Standard library HMAC-SHA256 bearer tokens instead of heavyweight external JWT dependencies.
13. `ponytail: single-column token reuse check` - Tracking `previous_token_hash` directly on the device row to detect reuse without a separate audit table.
14. `ponytail: native node:test runner for extension` - Using Node's built-in test runner without external npm packages for offline queue unit testing.
15. `ponytail: stdlib RS256 JWT minting` - Using Go standard library crypto/rsa and crypto/sha256 to mint GitHub App JWTs without external JWT dependencies.
16. `ponytail: sync.Map per-repo serialization` - In-memory mutex map for serializing commits per repository without distributed locking.
