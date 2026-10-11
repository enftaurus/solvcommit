# Data Model

> PostgreSQL schema, structural invariants, and submission state machine.
> Last updated: Phase 0 (Pre-implementation)

See [`docs/PRD.md#data-model`](file:///home/rajababu/intern/leetsync/docs/PRD.md#data-model) for full schema definitions.

## Tables (PostgreSQL - Metadata Only)
- **`users`**: LeetSync accounts (`id` UUID, `status`, `created_at`, `updated_at`).
- **`github_connections`**: GitHub App connection (`user_id` FK, `github_user_id`, `installation_id` BIGINT, `status`, `created_at`, `updated_at`). *Note: Installation tokens are minted on demand and cached in memory (D-19).*
- **`repositories`**: Target repository (`user_id` FK, `github_repo_id`, `owner`, `name`, `default_branch`, `status`).
- **`devices`**: Paired extension installs (`user_id` FK, `device_name`, `user_agent`, `first_ip`, `last_ip`, `token_family_id`, `refresh_token_hash`, `created_at`, `last_seen_at`, `revoked_at`, `revoked_reason`). *Note: Raw IPs only, no history or GeoIP.*
- **`submissions`**: Metadata for accepted solutions (`user_id` FK, `leetcode_submission_id` BIGINT, `problem_slug`, `problem_title`, `language`, `status`, `content_sha256`, `github_path`, `commit_sha`, `attempt_count`, `next_attempt_at`, `last_error_code`, `received_at`, `published_at`).

*(Note: `audit_events` table dropped in favor of structured application logging per D-22).*

## Invariants
1. `submissions` is unique on `(user_id, leetcode_submission_id)`.
2. A GitHub identity maps to exactly one LeetSync user.
3. Foreign keys enforce referential integrity across all child entities.
4. Status transitions strictly follow the defined state machine.
5. Attempt counters are strictly non-negative.
6. Indexes cover `status`, `next_attempt_at`, `user_id`, and `leetcode_submission_id`.

## Submission States & Allowed Transitions

```
 (new) ──► queued ──► processing ──► published
              │             │
              │             ├──► retrying ──► processing
              │             │         │
              ▼             ▼         ▼
           expired ◄────── failed ◄───┘
              │             │
              └──► queued ◄─┘ (manual retry / resend)
```

| From | To | Condition |
| :--- | :--- | :--- |
| *(new)* | `queued` | Backend validated submission and Kafka acknowledged produce (`acks=all`). |
| `queued` | `processing` | Publisher worker dequeued message for execution. |
| `processing` | `published` | GitHub commit verified or identical file already present at destination path. |
| `processing` | `retrying` | Transient error (network 5xx, rate limit); next attempt scheduled. |
| `retrying` | `processing` | Next attempt delay has elapsed. |
| `processing`, `retrying` | `failed` | Permanent failure (bad auth, no repo write permissions) or retries exhausted; sent to DLQ. |
| `queued`, `retrying` | `expired` | Message expired past Kafka retention window before publish completed. |
| `failed`, `expired` | `queued` | User triggered manual retry; extension re-fetches and resends code. |
