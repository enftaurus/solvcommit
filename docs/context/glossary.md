# Glossary

> Core domain concepts and technical terminology for LeetSync.
> Last updated: Phase 0 (Pre-implementation)

See [`docs/PRD.md`](file:///home/rajababu/intern/leetsync/docs/PRD.md) for overarching context.

- **Submission**: A single, accepted solution solved by a user on LeetCode, containing submission ID, problem slug, problem title, programming language, timestamp, and source code.
- **Device**: A specific installation of the LeetSync Chrome Extension on a user's browser, paired to their LeetSync account with its own credentials.
- **Session**: An authenticated interaction context, either a cookie-based web dashboard session or a token-based extension device session.
- **Token Family**: A linked lineage of rotating refresh tokens assigned to a specific device. Used for breach detection (presenting an expired token in the family revokes the entire family).
- **Publisher**: The Go background worker (`cmd/publisher`) that consumes submissions from Kafka, serializes repository commits, and writes files to GitHub.
- **DLQ (Dead Letter Queue)**: The Kafka topic `submissions.dlq` where messages that exceeded retry attempts or encountered unrecoverable errors are routed.
- **Backfill**: An extension-driven sync routine where the extension provides recent accepted LeetCode submission IDs, queries the backend for missing records, and pushes only unrecorded solutions.
- **Resend**: A recovery flow initiated when a submission expired from Kafka or failed, prompting the Chrome extension to refetch the solution from LeetCode within the browser and repost it.
