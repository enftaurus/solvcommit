# API Specification

> REST API contracts, callers, and authentication requirements for `/api/v1`.
> Last updated: Phase 0 (Pre-implementation)

See [`docs/PRD.md#api-specification`](file:///home/rajababu/intern/leetsync/docs/PRD.md#api-specification) for complete route definitions.

## Authentication & Device Sessions
| Method | Endpoint | Caller | Auth Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/auth/github/start` | Website | Public | Initiates GitHub OAuth flow with CSRF state token. |
| `GET` | `/api/v1/auth/github/callback` | Website | Public | Verifies OAuth state, establishes user session cookie. |
| `POST` | `/api/v1/auth/logout` | Website | Session Cookie | Clears website session. |
| `GET` | `/api/v1/me` | Website | Session Cookie | Returns authenticated user profile and repo status. |
| `DELETE` | `/api/v1/me` | Website | Session Cookie | Initiates account deletion and data purge. |
| `POST` | `/api/v1/devices/pair` | Extension | Temporary Code / Session | Enrolls extension, issues access token & refresh token. |
| `POST` | `/api/v1/devices/refresh` | Extension | Refresh Token | Rotates refresh token, issues fresh short-lived access token. |
| `GET` | `/api/v1/devices` | Website | Session Cookie | Lists active sessions with IP, approximate location, last seen. |
| `DELETE` | `/api/v1/devices/{deviceId}` | Website | Session Cookie | Revokes specific device session family. |

## Repositories
| Method | Endpoint | Caller | Auth Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/github/repositories` | Website | Session Cookie | Lists GitHub repositories with App installed. |
| `POST` | `/api/v1/repositories` | Website | Session Cookie | Registers selected repository (repo creation deferred in MVP per D-23). |
| `GET` | `/api/v1/repositories/selected` | Website | Session Cookie | Reads current destination repository configuration. |
| `PUT` | `/api/v1/repositories/selected` | Website | Session Cookie | Updates destination repository. |
| `POST` | `/api/v1/repositories/verify` | Website | Session Cookie | Server-side verification of repo write permissions. |

## Synchronization
| Method | Endpoint | Caller | Auth Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/sync/submissions` | Extension | Device Bearer Token | Submits accepted code payload; blocks until Kafka ack. |
| `POST` | `/api/v1/sync/backfill` | Extension | Device Bearer Token | Sends recent LeetCode IDs; returns IDs missing in backend. |
| `GET` | `/api/v1/sync/resend-requests` | Extension | Device Bearer Token | Queries submissions needing extension refetch & re-upload. |
| `GET` | `/api/v1/sync/status` | Website | Session Cookie | Aggregated sync counts and pipeline health. |
| `GET` | `/api/v1/sync/submissions` | Website | Session Cookie | Paginated submission metadata and sync history. |
| `POST` | `/api/v1/sync/submissions/{id}/retry` | Website | Session Cookie | Manually re-queues a failed or expired submission. |
| `POST` | `/api/v1/sync/pause` | Website | Session Cookie | Pauses GitHub publishing workers for the user. |
| `POST` | `/api/v1/sync/resume` | Website | Session Cookie | Resumes GitHub publishing workers for the user. |

## Operations & Telemetry
| Method | Endpoint | Caller | Auth Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health/live` | Ops/Probe | None | Process liveness. |
| `GET` | `/api/v1/health/ready` | Ops/Probe | None | Readiness (PostgreSQL and Kafka connectivity). |

*(Note: `/metrics` dropped in favor of structured logs per D-21).*
