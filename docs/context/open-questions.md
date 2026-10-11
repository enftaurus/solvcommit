# Open Questions

> Unresolved design decisions, technical investigations, and answers as they resolve.
> Last updated: Phase 0 (Pre-implementation)

See [`docs/PRD.md#open-decisions-and-risks`](file:///home/rajababu/intern/leetsync/docs/PRD.md#open-decisions-and-risks) for context and priority levels.

| ID | Question | Priority | Status | Resolution / Answer |
| :--- | :--- | :--- | :--- | :--- |
| **OQ-01** | Which in-session LeetCode requests return an accepted submission with its code reliably, and is reading a user's own submissions acceptable under LeetCode's terms? | Critical | Resolved | Verified by Phase 0 spike: `POST /graphql/` with `submissionDetails($submissionId: Int!)` returns `code`, `lang { name verboseName }`, and `question { questionId titleSlug title }`. Browser passes session cookies via `credentials: 'include'`; `x-csrftoken` header from `csrftoken` cookie is mandatory for POSTs. 64-bit IDs supported. Terms: client-side fetch for user's own submitted code complies with private personal portfolio generation. See [`spike/README.md`](file:///home/rajababu/intern/leetsync/spike/README.md). |
| **OQ-02** | GitHub OAuth App vs. GitHub App? | High | Decided | **GitHub App**, limited to selected repository, with Contents (read/write) and Metadata (read) permissions. |
| **OQ-03** | How are GitHub tokens encrypted at rest and how are keys rotated? | High | Decided | No token encryption at rest in MVP. Installation tokens expire after 1 hour, minted on demand and cached in memory. User sign-in token used once to identify user and discarded. Store only `installation_id`. App private key kept in env var. Drop `encrypted_token` from schema. |
| **OQ-04** | What happens when an existing repository already contains files or a custom README? | High | Decided | Support existing repos. Never touch existing README. Check target path by git blob SHA: match = already published, mismatch = visible conflict. |
| **OQ-05** | What is the final retention period for IP addresses, audit records, deleted accounts, and Kafka messages? | High | Decided | Kafka retention: 7 days for `submissions` (no DLQ topic). Store only `first_ip` and `last_ip` per session (no history). Hard-delete user rows on account deletion. Security events logged via structured logs (no `audit_events` table). |
| **OQ-06** | What is the expected initial user count, submission volume, default repository visibility, and production deployment environment? | Medium | Decided | Single small VM running Docker Compose with HTTPS reverse proxy. 1 Kafka partition, 1 publisher instance. New repositories default to private. |
