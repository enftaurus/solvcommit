# Kafka Design

> Message schemas, topic configurations, delivery semantics, and retention rules.
> Last updated: Phase 0 (Pre-implementation)

See [`docs/PRD.md#kafka-design`](file:///home/rajababu/intern/leetsync/docs/PRD.md#kafka-design) for the complete specification.

## Topics
| Topic | Purpose | Message Key | Retention |
| :--- | :--- | :--- | :--- |
| `submissions` | Buffer accepted submissions to commit | `user_id` (enforces FIFO per user repository) | 7 days |

*(Note: The `csrf` topic and `submissions.dlq` topic are removed per D-03 and D-20. Failed submissions are tracked in PostgreSQL; recovery is via extension resend).*

## Message Payload Schema
Topic: `submissions` (JSON, versioned):
```json
{
  "schema_version": 1,
  "job_id": "uuid",
  "user_id": "uuid",
  "device_id": "uuid",
  "submission_id": "12345",
  "problem_slug": "two-sum",
  "problem_title": "Two Sum",
  "language": "python3",
  "code": "class Solution: ...",
  "content_sha256": "4a7d1ed414474e4033ac29ccb8653d9b...",
  "submitted_at": "2026-10-11T18:00:00Z",
  "received_at": "2026-10-11T18:00:10Z"
}
```

## Delivery & Persistence Rules
1. **At-least-once delivery**: Downstream operations are strictly idempotent via unique database constraint `(user_id, leetcode_submission_id)` and GitHub file path checks.
2. **Producer confirmation**: API produces messages with `acks=all` (wait for all in-sync replicas) before writing the `queued` record and acknowledging the extension.
3. **Consumer offset commit**: The publisher worker commits Kafka offsets **only after** the GitHub commit succeeds (or file existence is verified) and the PostgreSQL status is updated to `published`.
4. **Code lifespan**: Kafka is the **only** server-side storage location for source code. Once message retention expires, code is gone from the server; recovery requires extension resend.
5. **No payload bloat**: Ingestion enforces a strict `MAX_CODE_BYTES` limit to keep messages well under Kafka broker limits.
