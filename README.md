# SolvCommit

> Automatically publish your accepted LeetCode submissions to GitHub.

SolvCommit is a privacy-first developer tool that synchronizes every accepted LeetCode solution to your GitHub repository in real time. It consists of a lightweight browser extension (Manifest V3), a high-performance Go backend with Apache Kafka for asynchronous processing, and a modern React dashboard.

---

## Key Architectural Principles

1. **Zero LeetCode Credentials on Backend**: The backend never connects to LeetCode. The browser extension observes submissions within the user's active browser session and pushes accepted solutions to the SolvCommit API.
2. **Code Lives Only in Kafka**: Source code is processed asynchronously via Apache Kafka (retention-bound). PostgreSQL persists only submission metadata (problem slug, difficulty, language, runtime, memory).
3. **Idempotency & Non-Destructive Commits**: Duplicate submissions are rejected using `(user_id, leetcode_submission_id)` constraints. GitHub commits check existing file paths and never overwrite or force-push.
4. **Minimal Privileges**: Sessions use cryptographic token hashing and rotation. Container runtimes execute as unprivileged users (`appuser:10001`).

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend API**: Go 1.24+, Gorilla Mux, native database migrations
- **Publisher Worker**: Go 1.24+, Kafka consumer group, GitHub App REST client
- **Database**: PostgreSQL 16
- **Message Broker**: Apache Kafka 3.8 (KRaft mode)
- **Reverse Proxy**: Caddy 2 (Automatic TLS via Let's Encrypt)
- **Containerization**: Multi-stage Docker builds, Alpine Linux 3.21 minimal base images

---

## Getting Started (Local Development)

### Prerequisites
- Docker & Docker Compose
- Go 1.24+
- Node.js 20+ & npm

### Starting the Dev Environment
```bash
./dev.sh
```
This script:
1. Starts PostgreSQL and Kafka containers via Docker Compose.
2. Verifies network connectivity and applies database migrations.
3. Builds and runs the native Go API (`:8080`) and Publisher worker.

To run the frontend dev server concurrently:
```bash
cd web
npm install
npm run dev
```

To clean up and reset local volumes:
```bash
./dev.sh reset
```

---

## Production Deployment (Azure Ubuntu 24.04)

SolvCommit includes a complete production setup powered by `compose.prod.yaml` and Caddy reverse proxy on custom domains (`solvcommit.eterno.software` and `api.solvcommit.eterno.software`).

For step-by-step instructions on Azure VM provisioning, DNS records, secrets generation, automated CI/CD publishing to GHCR, backup/restore procedures, and troubleshooting, read the complete guide:

👉 [**docs/DEPLOYMENT.md**](docs/DEPLOYMENT.md)

### Quick Production Launch
```bash
# 1. Copy and configure environment variables
cp .env.example .env

# 2. Launch production stack
docker compose -f compose.prod.yaml up -d

# 3. Check status
docker compose -f compose.prod.yaml ps
```

> [!CAUTION]
> **Never run `docker compose down -v` in production.** The `-v` flag permanently removes PostgreSQL and Kafka persistent data volumes.

---

## CI/CD Pipeline

SolvCommit uses GitHub Actions (`.github/workflows/docker-publish.yml`) to:
- Run backend unit tests (`go test -race ./...`).
- Verify frontend TypeScript compilation and production build.
- Build multi-stage container images for `api`, `publisher`, and `frontend`.
- Publish signed and tagged images to GitHub Container Registry (`ghcr.io/enftaurus/solvcommit-*`).

---

## License

Eterno Labs © 2026. All rights reserved.
