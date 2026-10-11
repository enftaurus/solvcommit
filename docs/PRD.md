LeetSync PRD v2
11 Oct 2026 · @adias
Overview
LeetSync turns every accepted LeetCode submission into a commit in the user's GitHub repository: a Chrome extension captures the code in the browser, and a Go backend queues it through Kafka and publishes it.
Problem
Solutions pile up on LeetCode but never become a GitHub portfolio unless the user copies each one by hand, creates folders and commits them. LeetSync does this automatically and keeps every accepted submission.
Goals
• Capture accepted submissions in the browser and publish them to GitHub without manual file management.
• Keep every distinct accepted submission instead of overwriting earlier ones.
• Support a repository LeetSync creates or an existing one the user selects.
• Prevent duplicates and recover from failures, with retries and visible sync status.
• Hold no LeetCode credentials on the backend.
• Let users see and revoke every signed-in extension device.
Non-goals for the first release
• Backend-side polling or scraping of LeetCode.
• Submitting solutions to LeetCode, solving problems with AI, or generating explanations and analyses.
• Syncing rejected submissions or editor drafts.
• Browsers other than Chrome.
• Leaderboards, social feeds or rankings.
• Replacing GitHub as the place the code lives.
Users and core journey
The primary user is a coding student who solves problems regularly and wants a GitHub portfolio for internships and placements; the secondary user is a developer who wants a searchable history of accepted solutions in several languages.
1. Install the Chrome extension; it opens the LeetSync onboarding site.
2. Sign in with GitHub.
3. Create a new repository or select an existing one.
4. Pair the extension with the account; this creates the first device session.
5. Solve problems on LeetCode as usual. The extension sees an accepted result and fetches the submission inside the user's own logged-in session.
6. The extension sends the submission to the backend over HTTPS with its device token.
7. The backend validates it and puts it on Kafka; a worker commits it to the repository.
8. The dashboard shows sync status, repository details, errors and the list of signed-in devices.
Confirmed decisions
The biggest change from v1 is that the backend never talks to LeetCode: the extension pushes submissions, and source code travels through Kafka instead of PostgreSQL.
Area
Decision
Change from v1
Backend
Go
None
LeetCode access
The extension fetches the submission inside the user's own session and sends it to the backend. The backend stores no LeetCode credentials and never calls LeetCode.
v1 had backend polling with stored authentication material
Discovery
Extension event on an accepted result, plus extension-side backfill
v1 used a 2-minute backend scheduler
Messaging
Kafka, one submissions topic plus a dead-letter topic. Messages carry the source code and expire by retention policy.
v1 had a csrf polling topic and kept code out of Kafka
Database
Self-hosted PostgreSQL in Docker. Stores metadata only (IDs, language, status, paths), never source code.
v1 allowed code in PostgreSQL
Eligibility
Accepted submissions only
None
Authentication
GitHub sign-in plus device sessions with rotating refresh tokens, mapped to IP and user agent
v1 had plain revocable device credentials
Repository setup
User chooses a new or an existing repository
None
File layout
One directory per problem; every distinct accepted submission preserved
None
Dashboard
Connections, device sessions, progress, errors, repository settings, pause/resume, account settings
Device sessions added
Failure recovery
Automatic retries, error tracking, manual retry; if a message has expired, retry means the extension resends
v1 retried from stored state
Local development
Empty scaffold with dev.sh
None
Infrastructure
Docker Compose for PostgreSQL and Kafka; no managed database
None
Functional requirements
Requirements are grouped by area; the IDs are stable so tests and tickets can reference them.
Authentication and accounts
• FR-AUTH-01 Users sign in through GitHub's authorization flow. The backend verifies the OAuth state, binds it to the initiating browser session, and never trusts a client-supplied GitHub identity.
• FR-AUTH-02 LeetSync requests only the GitHub permissions it needs and tells the user it can write to the repository they authorize. The authorization model (OAuth App or GitHub App) is chosen before token handling is coded.
• FR-AUTH-03 The website uses secure cookies, CSRF protection on state-changing requests, and session expiry.
• FR-AUTH-04 Users can disconnect GitHub, revoke any device, and request account deletion. The retention rules for logs and metadata are an open decision.
Chrome extension
• FR-EXT-01 On install the extension opens the onboarding page, and the icon can reopen it.
• FR-EXT-02 Pairing creates a device session with its own identity, separate from GitHub credentials.
• FR-EXT-03 The extension detects an accepted result on LeetCode and fetches the submission details using the user's own logged-in session. LeetCode cookies, CSRF tokens and any other LeetCode credential never leave the browser.
• FR-EXT-04 The extension requests the minimum permissions, explains each one, and reads no unrelated browsing data.
• FR-EXT-05 Failed sends are kept in extension storage and retried with backoff. The queue survives service-worker restarts.
• FR-EXT-06 The popup shows paired status, backend health, and when LeetCode was last seen.
Submission ingestion
• FR-ING-01 The extension sends the submission ID, problem slug and title, language, source code, status and submission time to the backend.
• FR-ING-02 The backend validates the schema, the payload size limit, an accepted status, a known language, and a per-device rate limit. Anything else is rejected and never queued.
• FR-ING-03 Identity is the pair of user and LeetCode submission ID. A duplicate send returns the existing status and does not enqueue again.
• FR-ING-04 The backend returns success only after Kafka acknowledges the message. If Kafka is unavailable it returns an error and the extension retries.
• FR-ING-05 Backfill: on startup and on a timer the extension lists recent accepted submissions and sends their IDs; the backend replies with the IDs it is missing, and the extension sends those.
• FR-ING-06 The backend does no polling of LeetCode. Extension signals and backfill use the same ingestion path.
GitHub repository
• FR-GH-01 Users can create a repository, with name and visibility chosen during onboarding.
• FR-GH-02 Users can connect an existing repository they can write to. The backend verifies permissions server-side before enabling sync.
• FR-GH-03 A new repository gets a basic README explaining that it holds synchronized LeetCode submissions. An existing README is never overwritten.
• FR-GH-04 Each submission becomes one source file in its problem's directory, with an extension matched from a tested language mapping. Unknown languages fail explicitly.
• FR-GH-05 Commit messages are deterministic and contain no source code or credentials, for example feat: sync accepted Two Sum submission (12345).
• FR-GH-06 LeetSync never deletes files, force-pushes, or overwrites unrelated content. Writes to one repository are serialized, and a concurrent-modification conflict is retried.
Submission history
• FR-HIST-01 Every distinct accepted submission ID is preserved, so two accepted solutions in the same language never overwrite each other.
• FR-HIST-02 Reprocessing a submission creates no second file and no second commit.
• FR-HIST-03 If a commit succeeded but the worker crashed before recording it, recovery checks the repository path first and records success instead of writing again.
• FR-HIST-04 If the destination path exists, the worker checks that it holds the same submission before treating it as done, and stops with a conflict otherwise.
Dashboard
• FR-DASH-01 Pausing stops new publishing work for the user. In-flight writes finish safely.
• FR-DASH-02 Manual retry reuses the original submission identity and deduplication.
• FR-DASH-03 The dashboard distinguishes queued, processing, retrying, published, failed and expired. A queued submission is never shown as published.
• FR-DASH-04 Refreshing the dashboard only reads state; it never triggers a GitHub write.
Failure recovery
• FR-ERR-01 Transient failures (network, GitHub 5xx, rate limits) retry with exponential backoff and jitter, within a configured limit.
• FR-ERR-02 Permanent failures (revoked authorization, no write access, unrecoverable validation) are not retried and are shown with an actionable reason.
• FR-ERR-03 Exhausted jobs move to a dead-letter topic and stay visible on the dashboard. Replaying one stays idempotent.
• FR-ERR-04 Logs and metrics cover failures, queue lag, retries and publish latency, without credentials or source code.
Architecture
The system is two Go processes, Kafka and PostgreSQL, with the extension and the web app as clients.
Source code travels along the top row and is never written to PostgreSQL; the web app only reads and controls state through the API.
Component
Responsibility
Chrome extension
Pairing, capturing accepted submissions in the user's own session, offline queue, backfill
Web app
Onboarding, repository selection, dashboard, sessions
Go API
GitHub authentication, devices and sessions, validation, Kafka production, sync controls
Kafka
Durable, retention-bound delivery of submissions and dead-letter messages
Publisher
Consumes submissions, writes files and commits to GitHub, updates submission status
PostgreSQL
Accounts, devices, repositories and submission metadata
GitHub
The destination repository
Kafka design
Kafka is the only place source code lives on the server, so its retention policy is also the code-retention policy.
Topics
Topic
Purpose
Message key
submissions
One message per accepted submission to publish
User ID, so one user's messages stay ordered and one repository is written serially
submissions.dlq
Messages that exhausted retries or hit a permanent failure
Same as above
The csrf topic from v1 is removed. A single topic is enough for the first release; add others only for a distinct workload.
Message payload
{
  "schema_version": 1,
  "job_id": "uuid",
  "user_id": "uuid",
  "device_id": "uuid",
  "submission_id": "12345",
  "problem_slug": "two-sum",
  "problem_title": "Two Sum",
  "language": "python3",
  "code": "...",
  "content_sha256": "hex",
  "submitted_at": "2026-10-11T18:00:00Z",
  "received_at": "2026-10-11T18:00:10Z"
}
Credentials of any kind never appear in a message. The API enforces a maximum code size so a message stays well under the broker's message limit.
Retention and outages
• Retention is set per topic. Proposed starting values are 7 days for submissions and 14 days for submissions.dlq, both configurable.
• If a message expires before it is published, the submission is marked expired and the dashboard offers a resend. Resend asks the extension to fetch the code again and send it, so retention only has to cover normal retry windows, not long outages.
• Broker disks are encrypted at rest and access is limited to the API and workers.
Delivery rules
• Delivery is at least once. Handlers are idempotent, using the unique submission key and the repository path check.
• The producer waits for acknowledgement from all in-sync replicas before the API reports success.
• A consumer commits its offset only after PostgreSQL state is updated and the GitHub result is confirmed.
• Kafka is never the source of truth for account state or submission status; PostgreSQL is.
• Message schemas are versioned.
Data model
PostgreSQL is the source of truth for accounts, devices, repositories and submission status, and it never stores source code.
Core tables
Table
Purpose
Important fields
users
LeetSync identities
id, status, created_at, updated_at
github_connections
GitHub identity and authorization
user_id, github_user_id, encrypted token, token_type, scopes, key_id, status
repositories
Selected destination
user_id, github_repo_id, owner, name, default_branch, status
devices
Paired extension installs
user_id, device_name, created_at, revoked_at (sessions: next section)
submissions
Metadata for each accepted submission
user_id, leetcode_submission_id, problem_slug, problem_title, language, status, content_sha256, github_path, commit_sha, attempt_count, next_attempt_at, last_error_code, received_at, published_at
audit_events
Security-sensitive actions
user_id, event_type, metadata, created_at
There is no table for LeetCode credentials, and no sync-checkpoint or outbox table: the extension holds the upstream queue, Kafka holds the work, and the submissions row records the outcome.
Invariants
1. submissions is unique on user and LeetCode submission ID.
2. A GitHub identity maps to one user.
3. Foreign keys tie devices, repositories and submissions to their user.
4. Status changes follow the allowed transitions below.
5. Attempt counters are non-negative.
6. Indexes cover status, next_attempt_at, user and submission IDs.
Credential storage
• GitHub tokens are encrypted at rest with keys stored outside the database and a key ID for rotation.
• Refresh tokens are stored only as hashes, never in plaintext.
• The frontend never receives raw GitHub tokens or refresh tokens.
Submission states
The consumer creates the row if it is missing, using the unique key, so a crash between the Kafka write and the first database write loses nothing. A submission is published only after GitHub confirms the write.
From
To
When
(new)
queued
Backend accepted it and Kafka acknowledged
queued
processing
A worker picked it up
processing
published
GitHub write confirmed or an identical file already exists
processing
retrying
Transient failure, with the next attempt scheduled
retrying
processing
The retry is due
processing, retrying
failed
Permanent failure or retries exhausted; message goes to the dead-letter topic
queued, retrying
expired
The Kafka message passed retention
failed, expired
queued
Manual retry; the code is replayed or resent by the extension
Devices and sessions
Every signed-in extension is a session the user can see, with where it last connected from, and can revoke at any time.
Session model
• Pairing issues a short-lived access token and a high-entropy refresh token, bound to one device.
• The backend stores only a hash of the refresh token.
• Every refresh rotates the token: the old one stops working and a new one is issued.
• Tokens belong to a token family. If an already-used refresh token is presented again, the whole family is revoked, because the token was probably copied.
• Revoking a device invalidates its family and rejects its next API call.
What is recorded per session
Field
Use
device_name, user_agent
Shown in the sessions list
first_ip, last_ip
Shown with an approximate location from IP lookup
created_at, last_seen_at
Shown in the list and used for stale-session cleanup
token_family_id, refresh_token_hash
Rotation and reuse detection
revoked_at, revoked_reason
Revocation history
Rules
• IP is for display and alerts only. A session is never bound to an IP or ended because the IP changed, since IPs change on mobile data, VPNs and Wi-Fi switches.
• A connection from a new location can raise an alert on the dashboard.
• The IP is read from forwarded headers only when the request comes from the project's own trusted proxy.
• IP addresses are personal data. How long they are kept is an open decision (see Open decisions and risks).
• The sessions list shows extension devices and website sessions together, each with a revoke action.
API specification
All routes are proposed contracts under the /api/v1 prefix. Each endpoint names its caller: the website user (session cookie) or the paired extension (device access token).
Authentication and sessions
Method
Endpoint
Caller
Purpose
GET
/auth/github/start
Website
Begin GitHub authorization
GET
/auth/github/callback
Website
Validate state and complete sign-in
POST
/auth/logout
Website
End the website session
GET
/me
Website
Current user and connection summary
DELETE
/me
Website
Start account deletion
POST
/devices/pair
Extension
Enroll a device and issue tokens
POST
/devices/refresh
Extension
Rotate the refresh token and issue a new access token
GET
/devices
Website
List sessions with IP, location and last seen
DELETE
/devices/{deviceId}
Website
Revoke a device
Repositories
Method
Endpoint
Purpose
GET
/github/repositories
List repositories the user can choose from
POST
/repositories
Create a repository or register an existing one
GET / PUT
/repositories/selected
Read or change the destination
POST
/repositories/verify
Check access and write permission server-side
The API never accepts a client-provided repository URL as proof of authorization.
Synchronization
Method
Endpoint
Caller
Purpose
POST
/sync/submissions
Extension
Submit one accepted submission with its code; returns after Kafka acknowledges
POST
/sync/backfill
Extension
Send recent submission IDs; returns the IDs the backend is missing
GET
/sync/resend-requests
Extension
Fetch IDs the backend wants sent again (expired or manual retry)
GET
/sync/status
Website
Overall sync status and counts
GET
/sync/submissions
Website
List submissions and their states
POST
/sync/submissions/{id}/retry
Website
Retry a failed or expired submission
POST
/sync/pause, /sync/resume
Website
Pause or resume publishing
The LeetCode connection endpoints from v1 are removed.
Operations
Method
Endpoint
Purpose
GET
/health/live
Process liveness
GET
/health/ready
Readiness, including PostgreSQL and Kafka
GET
/metrics
Metrics, restricted to trusted infrastructure
Health responses never reveal connection strings, tokens or detailed internal errors.
Processing, consistency and retries
The core principle is Capture → Validate → Queue → Publish → Verify → Record, and every stage must be recoverable without losing a submission or creating a duplicate file.
Ingestion
1. The extension posts the submission with its device token.
2. The API validates it and checks the unique key. A known submission that is not failed or expired returns its current status.
3. The API produces the message to Kafka and waits for the acknowledgement.
4. It records the queued row and returns success. If Kafka is down it returns an error, and the extension keeps the submission and retries.
Publishing
1. The worker consumes a message and creates the submissions row if it does not exist.
2. It derives the safe directory and file name, and a content fingerprint.
3. It checks whether the destination path already holds this submission.
4. If not, it writes the file and creates the commit, serialized per repository.
5. It confirms the result, updates the row to published with the path and commit SHA, then commits the Kafka offset.
Consistency across the three systems
PostgreSQL, Kafka and GitHub share no transaction, so the design aims for effectively-once publication of each distinct submission, not exactly-once execution.
• No outbox is needed, because PostgreSQL no longer holds the payload. The extension is the durable buffer before Kafka, and Kafka is the durable store after it.
• A crash between the Kafka write and the first database write is safe, because the consumer creates the row.
• A crash between the GitHub commit and the database update is safe, because the retry finds the file and records success.
• Redelivered messages are harmless, because the unique key and the path check make handlers idempotent.
Failure handling
Failure
Behavior
Network error or GitHub 5xx
Retry with exponential backoff and jitter within a bounded budget
HTTP 429 or rate limit
Honor Retry-After when present
Kafka unavailable at ingestion
API returns an error; the extension retries from its queue
Revoked GitHub authorization or no write access
Mark failed, stop retrying, show a reconnect action
Invalid payload
Reject at the API; never queued
Identical file already exists
Treat as published after verification
Different file at the same path
Stop and show a conflict; never overwrite
Worker crash
Kafka redelivers; state recovers from the row and the repository check
PostgreSQL unavailable
Pause work that needs it and fail the readiness check
Retries exhausted
Move to the dead-letter topic, mark failed, offer manual retry
Message expired by retention
Mark expired and ask the extension to resend
Retry counts, delays and the total time budget are configurable; the defaults are validated during implementation.
Frontend
The web app uses React, TypeScript and Vite with Tailwind CSS, and talks only to authenticated backend APIs; it never receives raw GitHub tokens or refresh tokens.
Page
Purpose
Landing
Explain the product, the workflow and the permissions it needs
Login and callback
GitHub sign-in and onboarding continuation
Onboarding
Choose a repository and pair the extension
Dashboard
Connection health, recent activity, counts and the latest errors
Repository settings
Select or create the destination repository
Submission history
Each submission with language, state, error and GitHub link; retry for failed or expired ones
Sessions
Extension devices and website sessions with IP, approximate location, last seen and revoke
Account settings
Pause or resume sync, disconnect GitHub, delete the account
The dashboard shows these counts from persisted state: queued, processing, retrying, published, failed and expired. Counts and statuses come from the backend, never from demo values. Source code is not shown on the dashboard, because the server does not keep it.
Project structure and local development
The repository is a Go monorepo with two backend processes, down from five in v1, because there is no scheduler, discovery worker or outbox publisher.
leetsync/
├── cmd/
│   ├── api/main.go
│   └── publisher/main.go
├── internal/
│   ├── auth/  config/  database/  devices/
│   ├── github/  queue/  repositories/
│   ├── submissions/  telemetry/
├── migrations/
├── web/            (React + TypeScript + Vite)
├── extension/      (Chrome Manifest V3)
├── deployments/docker/
├── scripts/        (migrate.sh, create-topics.sh)
├── tests/          (integration, e2e)
├── docker-compose.yml
├── dev.sh
├── Makefile
├── .env.example
└── README.md
The api process handles HTTP, ingestion and Kafka production. The publisher process consumes submissions, writes to GitHub and updates PostgreSQL.
Docker Compose
• PostgreSQL with a named volume, a health check using pg_isready, and versioned migrations. Restarting must not erase data.
• Kafka on a pinned image, with an address usable by locally running Go services and persistent storage.
• Topics submissions and submissions.dlq created idempotently at startup, with retention set per topic.
• The API and publisher run natively during development for fast rebuilds and easy debugging.
dev.sh
./dev.sh initializes and starts the environment in this order:
1. Check for Go, Docker and Docker Compose, and for Node and npm when the frontend is enabled.
2. Create .env from .env.example if it is missing, without overwriting existing values and without printing secrets.
3. Run docker compose up -d and wait for PostgreSQL and Kafka, with configurable timeouts.
4. Apply migrations and create the topics.
5. Build the Go binaries and start the API and publisher.
6. Exit with a clear message if startup fails.
7. On SIGINT or SIGTERM, stop child processes and containers cleanly, leaving PostgreSQL data intact.
Command
Action
./dev.sh
Start infrastructure and Go services
./dev.sh infra
Start PostgreSQL and Kafka only
./dev.sh migrate
Apply migrations
./dev.sh test
Run automated tests
./dev.sh logs
Show infrastructure logs
./dev.sh stop
Stop local services and containers
./dev.sh reset
Destroy local data; the only destructive command and it must be explicit
Environment
APP_ENV=development
HTTP_ADDR=:8080
DATABASE_URL=postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_SUBMISSIONS=submissions
KAFKA_TOPIC_DLQ=submissions.dlq
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8080/api/v1/auth/github/callback
ENCRYPTION_KEY=
SESSION_SECRET=
MAX_CODE_BYTES=
These names are illustrative. The services validate configuration at startup and fail fast when a required secret or dependency is missing. Development secrets are never committed.
Non-functional requirements and testing
The critical requirement is correct behavior across retries, restarts, duplicate sends and revoked access, not just a working happy path.
Reliability
• Job state survives restarts: the extension queue, Kafka and the submissions rows together cover every stage.
• Handlers and GitHub writes are idempotent.
• Temporary dependency failures never silently drop work.
• Publishing concurrency is limited per user and per repository, and respects GitHub rate limits.
Security
• HTTPS in every deployed environment.
• GitHub tokens encrypted at rest with separately stored keys, and credentials kept out of Kafka messages, logs, error reports and source control.
• Narrowly scoped GitHub authorization and strict OAuth state validation.
• Device tokens are short-lived; refresh tokens rotate and are stored as hashes.
• Authorization checks on every user-owned resource, restricted CORS, request size limits, rate limits and input validation.
• Source code lives only in Kafka for the retention window, on encrypted disks.
• Audit events for repository changes, device revocation, credential changes and account deletion.
Observability
Structured logs and metrics cover ingestion rate and rejections, queue lag, publish latency, retries and failures, GitHub rate limits and database errors. Logs carry stable job and submission IDs and no credentials or source code.
Maintainability
• Thin HTTP handlers; the GitHub client sits behind a Go interface.
• Versioned SQL migrations, typed configuration and pinned infrastructure images.
• Documentation for local setup, environment variables, tests and failure recovery.
Testing strategy
Automated tests use mocked external APIs by default. Tests against a real GitHub repository are opt-in, use a designated test account and never log credentials.
Layer
Required coverage
Go unit tests
Eligibility, file naming, language mapping, state transitions, retry classification
Database integration
Migrations, uniqueness constraints, transitions, concurrent updates
Kafka integration
Serialization, redelivery, consumer recovery, retention-expiry handling
GitHub client
Repository selection, file writes, conflicts, rate limits, ambiguous-write recovery
API
OAuth state, device authorization, refresh rotation and reuse detection, user isolation, invalid input
Extension
Onboarding, pairing, offline queue, backfill, permission boundaries
End to end
Accepted submission captured, queued, published and shown on the dashboard
Recovery
Worker crash, duplicate messages, Kafka and PostgreSQL restarts
Security
Token leakage, revoked device access, cross-user access, unsafe repository paths
Phases, MVP and acceptance
The riskiest assumption is that an extension can reliably capture accepted submissions with their code from inside a logged-in LeetCode session, so it is proved first, before any infrastructure is built.
Implementation phases
1. Phase 0: capture spike. A throwaway extension content script that detects an accepted result, fetches the submission code in the user's own session, and commits one file to a test repository. Exit: it works repeatedly on the user's own account, and the exact requests it relies on are written down.
2. Phase 1: scaffold and infrastructure. Go module, Docker Compose with PostgreSQL and Kafka, migrations, configuration, health checks and dev.sh. Exit: an empty checkout starts the local stack reliably.
3. Phase 2: identity and sessions. GitHub authorization, user records, device pairing, refresh rotation with reuse detection, revocation, IP and user-agent recording. Exit: a user can sign in and pair and revoke a device.
4. Phase 3: ingestion pipeline. The submission endpoint, validation, Kafka production, the submissions rows and the extension's offline queue and backfill. Exit: duplicate and offline sends produce exactly one queued submission.
5. Phase 4: GitHub publishing. Repository creation and selection, README, safe file writes, serialized commits, retries, dead-letter topic and ambiguous-write recovery. Exit: distinct submissions publish without overwriting unrelated content.
6. Phase 5: dashboard. Onboarding, repository settings, submission history, sessions page, pause and resume, retry and resend. Exit: a user can set up and monitor the whole flow.
7. Phase 6: reliability and release readiness. Concurrency, restart and recovery tests, security tests, account deletion, deployment and operations documentation. Exit: the acceptance criteria pass in a repeatable environment.
Definition of MVP
The MVP is done when a user can:
1. Install the extension, sign in with GitHub and pair the extension.
2. Create or select a GitHub repository.
3. Solve a problem on LeetCode and have the accepted submission published to its problem directory.
4. See every distinct submission preserved, with no duplicates.
5. Recover from temporary failures, see errors and retry.
6. Pause and resume syncing, and see and revoke signed-in devices.
7. Run the whole stack locally with ./dev.sh.
The MVP does not need AI features, other browsers, a mobile app, social features or advanced analytics.
Acceptance criteria
[ ] Installing the extension opens onboarding where Chrome allows it.
[ ] A user can sign in with GitHub and pair the extension.
[ ] A revoked device's next API call is rejected.
[ ] A reused refresh token revokes its whole token family.
[ ] The sessions page shows IP, approximate location and last seen for each device.
[ ] An accepted submission is queued, published and shown on the dashboard.
[ ] Rejected or unverified submissions are never queued or published.
[ ] A duplicate send creates no second record, file or commit.
[ ] Submissions sent while Kafka was down arrive after the extension retries.
[ ] Backfill sends only the submissions the backend is missing.
[ ] Multiple accepted submissions for one problem keep their history.
[ ] Retries never overwrite unrelated files or create duplicates.
[ ] A conflicting existing file produces a visible conflict, not an overwrite.
[ ] An expired message is marked expired and a resend recovers it.
[ ] A failed submission can be retried manually.
[ ] Pause and resume stop and restart publishing.
[ ] Source code is absent from PostgreSQL, logs and metrics.
[ ] Restarting a worker, PostgreSQL or Kafka loses no queued work within the retention window.
[ ] ./dev.sh starts an empty checkout, and stopping and restarting keeps PostgreSQL data.
[ ] Tests run without real production credentials.
Open decisions and risks
The two critical questions both concern how the extension reads submissions from LeetCode, which is why Phase 0 comes first.
Priority
Open question
Why it matters
Critical
Which in-session LeetCode requests return an accepted submission with its code reliably?
The whole capture flow depends on them; they may be undocumented and can change.
Critical
Is reading a user's own submissions from their own session acceptable under LeetCode's terms?
Client-side capture avoids server scraping, but the terms still need checking before release.
High
GitHub OAuth App or GitHub App?
Decides repository permissions and the token lifecycle. A GitHub App limited to the selected repository fits the narrow-permissions goal better.
High
How are GitHub tokens encrypted and keys rotated?
Needed before any production token is stored.
High
What happens when an existing repository already has files or a README?
Prevents data loss and conflicts.
High
Retention for Kafka messages, IP addresses, audit records and deleted accounts
Sets privacy expectations. Proposed Kafka values are 7 and 14 days.
Medium
Expected number of users and submission volume
Sets Kafka partitions and worker concurrency.
Medium
Default repository visibility during onboarding
Affects the risk of accidental public disclosure.
Medium
Production deployment environment
Decides TLS, secrets management and monitoring.
Product risks
• LeetCode changes. Page and request formats can change without notice. Keep capture logic isolated in the extension and covered by its own tests.
• Client-asserted data. The backend trusts what the extension sends. This is acceptable for a personal portfolio, since only the owner could fake an entry, but it must be a stated limit.
• Missed submissions. If the extension is off or the browser is closed, nothing is captured until backfill runs. Backfill depends on the extension being used again.
• Code in Kafka. Source code sits in Kafka until retention expires. Encrypt disks, limit access, and keep retention short.
• Retention versus outages. A long GitHub outage or revoked authorization can outlast retention. Resend from the extension is the recovery path.
• GitHub rate limits. Large backlogs need throttled, serialized commits per repository.
• Duplicate processing. Redelivery and crashes are normal. The unique key and path check are mandatory, not optional.
• IP privacy. Session IPs are personal data and need a defined retention period.
• Scope growth. AI explanations and advanced analytics wait until after the MVP.