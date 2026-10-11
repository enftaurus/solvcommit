# AGENTS.md

> LeetSync agent index and operational guide.
> Last updated: Phase 0 (Pre-implementation)

LeetSync is a Chrome extension (Manifest V3) and Go backend that publishes every accepted LeetCode submission to a user's GitHub repository.

## Non-Negotiables
1. **Zero LeetCode credentials on backend**: The backend never calls LeetCode. The extension captures submissions inside the user's session and pushes them.
2. **Code only in Kafka**: Source code lives exclusively in Kafka messages (retention-bound). PostgreSQL stores metadata only. Code/credentials never appear in logs, metrics, or errors.
3. **Idempotent publishing**: Unique key on `(user_id, leetcode_submission_id)` and repo path check before writing. Never overwrite, delete, or force-push.
4. **Accepted submissions only**: Only submissions with an accepted status are queued or published.
5. **Secure sessions**: Refresh tokens are stored as hashes and rotate on use with reuse detection. IP addresses are for display and alerts only; sessions are never bound to an IP.

## Context Files
- [`docs/PRD.md`](file:///home/rajababu/intern/leetsync/docs/PRD.md): Complete PRD v2 (source of truth).
- [`docs/context/decisions.md`](file:///home/rajababu/intern/leetsync/docs/context/decisions.md): Decision log (D-01 to D-17 + open decisions).
- [`docs/context/architecture.md`](file:///home/rajababu/intern/leetsync/docs/context/architecture.md): System components, data flow, storage boundaries.
- [`docs/context/data-model.md`](file:///home/rajababu/intern/leetsync/docs/context/data-model.md): PostgreSQL schema, invariants, submission states.
- [`docs/context/api.md`](file:///home/rajababu/intern/leetsync/docs/context/api.md): Endpoints, caller roles, authentication contracts.
- [`docs/context/kafka.md`](file:///home/rajababu/intern/leetsync/docs/context/kafka.md): Topics, schemas, retention, delivery rules.
- [`docs/context/sessions.md`](file:///home/rajababu/intern/leetsync/docs/context/sessions.md): Device pairing, token rotation, IP policies.
- [`docs/context/glossary.md`](file:///home/rajababu/intern/leetsync/docs/context/glossary.md): Terminology and definitions.
- [`docs/context/open-questions.md`](file:///home/rajababu/intern/leetsync/docs/context/open-questions.md): Open questions and resolution status.
- [`docs/context/progress.md`](file:///home/rajababu/intern/leetsync/docs/context/progress.md): Current phase, progress, and Ponytail shortcuts.
- [`docs/context/graph.md`](file:///home/rajababu/intern/leetsync/docs/context/graph.md) / [`graph/knowledge-graph.json`](file:///home/rajababu/intern/leetsync/graph/knowledge-graph.json): Knowledge graph.

## Local Development
- `./dev.sh`: Starts Docker Compose (PostgreSQL, Kafka) and native Go services (`api`, `publisher`).
- `./dev.sh reset`: The only destructive command; resets database volumes and topics.

## Current Phase
- **Phase 4**: GitHub Publishing (Complete). Next: **Phase 5** (Dashboard).
