# SolvCommit Production Deployment Guide

This guide details the complete procedure for deploying SolvCommit to an Azure Ubuntu 24.04 LTS VM using Docker Compose, Caddy (automated Let's Encrypt TLS reverse proxy), and GitHub Container Registry (GHCR).

---

## 1. Prerequisites

### Infrastructure Requirements
- **Host VM**: Ubuntu 24.04 LTS (e.g. Azure Standard_B2s or Standard_D2s_v5)
  - **CPU**: 2 vCPUs minimum
  - **RAM**: 4 GiB minimum (Kafka JVM heap is constrained to 512 MiB; ~3+ GiB remains for OS, PostgreSQL, Go API, Publisher, and Caddy)
  - **Disk**: 30+ GiB SSD (OS + Docker container images + persistent volumes for PostgreSQL, Kafka, and Caddy certs)

### Software on the VM
- **Docker Engine** (>= 26.0) & **Docker Compose plugin** (>= 2.27)
  ```bash
  # Quick installation on Ubuntu 24.04
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Enable and start Docker, add user to docker group
  sudo systemctl enable --now docker
  sudo usermod -aG docker $USER
  newgrp docker
  ```

---

## 2. Network & DNS Setup

### Azure Network Security Group (NSG) Rules
Configure inbound security rules in your Azure VM's Network Security Group:

| Priority | Name | Port(s) | Protocol | Source | Action | Note |
|---|---|---|---|---|---|---|
| 100 | AllowSSH | 22 | TCP | Your Admin IP / VPN | Allow | Restrict to your static IP or bastion |
| 110 | AllowHTTP | 80 | TCP | Any / Internet | Allow | Required for Let's Encrypt ACME challenge & HTTP->HTTPS redirect |
| 120 | AllowHTTPS | 443 | TCP | Any / Internet | Allow | Secure public ingress |

> [!CAUTION]
> **Never open internal ports to the internet!** Ports 5432 (PostgreSQL), 9092/9093 (Kafka), and 8080 (Go API) must remain strictly internal to the Docker bridge network. Ingress is handled exclusively by Caddy on ports 80 and 443.

### DNS Records
Create two `A` records in your DNS management console pointing to your Azure VM's static Public IP:
- `solvcommit.eterno.software` -> `<YOUR_AZURE_PUBLIC_IP>`
- `api.solvcommit.eterno.software` -> `<YOUR_AZURE_PUBLIC_IP>`

Verify propagation before starting Caddy:
```bash
dig +short solvcommit.eterno.software
dig +short api.solvcommit.eterno.software
```

---

## 3. Server Setup & Configuration

### Clone Repository
```bash
sudo mkdir -p /opt/solvcommit
sudo chown -R $USER:$USER /opt/solvcommit
git clone https://github.com/enftaurus/solvcommit.git /opt/solvcommit
cd /opt/solvcommit
```

### Configure Environment Variables
Copy `.env.example` to `.env` and fill in your production credentials:
```bash
cp .env.example .env
chmod 600 .env
```

#### Generating Strong Secrets
Generate a cryptographically secure 32-byte secret for `SESSION_SECRET`:
```bash
openssl rand -hex 32
```
Generate strong random passwords for the database:
```bash
openssl rand -base64 24
```

#### GitHub App Private Key
Place your GitHub App's private key (`github-app.pem`) into `/opt/solvcommit/` and ensure restricted permissions:
```bash
chmod 600 /opt/solvcommit/github-app.pem
```

#### Environment Checklist
Ensure `.env` contains:
```ini
FRONTEND_DOMAIN=solvcommit.eterno.software
API_DOMAIN=api.solvcommit.eterno.software
CADDY_ACME_EMAIL=admin@eterno.software

PORT=8080
SESSION_SECRET=<generated_32_byte_hex>
AUTO_MIGRATE=true
MIGRATIONS_DIR=migrations

GITHUB_APP_ID=<your_app_id>
GITHUB_APP_PRIVATE_KEY_PATH=/etc/solvcommit/github-app.pem
GITHUB_CLIENT_ID=<your_client_id>
GITHUB_CLIENT_SECRET=<your_client_secret>

POSTGRES_USER=solvcommit
POSTGRES_PASSWORD=<strong_password>
POSTGRES_DB=solvcommit

# Production internal networking:
DB_HOST=postgres
DB_PORT=5432
DB_USER=solvcommit
DB_PASSWORD=<strong_password>
DB_NAME=solvcommit
DB_SSLMODE=disable

KAFKA_BROKERS=kafka:9092
KAFKA_TOPIC=submissions.accepted
KAFKA_CONSUMER_GROUP=solvcommit-publisher-prod
```

---

## 4. Launching the Production Stack

Start all services in detached mode:
```bash
docker compose -f compose.prod.yaml up -d
```

### Service Architecture
When running, the compose file provisions:
1. `caddy`: Reverse proxy listening on ports 80 and 443 with automated Let's Encrypt certificates.
2. `frontend`: High-performance Nginx server hosting the compiled SPA static assets with security headers, client-side routing fallback, and `/healthz`.
3. `api`: Native Go REST API running as unprivileged user `appuser:10001` with `AUTO_MIGRATE=true`.
4. `publisher`: Native Go background worker consuming accepted LeetCode submissions from Kafka and committing them to GitHub repositories.
5. `postgres`: PostgreSQL 16 Alpine container with isolated volume `solvcommit_postgres_data`.
6. `kafka`: Apache Kafka 3.8.0 in KRaft mode (no Zookeeper required) restricted to 512 MiB JVM heap.
7. `kafka-init`: Short-lived init container that ensures the `submissions.accepted` topic exists before exiting.

---

## 5. Verification & Health Checks

### Check Container Status
```bash
docker compose -f compose.prod.yaml ps
```
All long-running services (`caddy`, `frontend`, `api`, `publisher`, `postgres`, `kafka`) should show `Up` and `healthy`. `kafka-init` should show `Exited (0)`.

### Test Endpoints Locally & Remotely
```bash
# Internal health endpoints
curl -I http://localhost/healthz
curl http://localhost:8080/healthz

# External HTTPS endpoints (after DNS propagation)
curl -I https://solvcommit.eterno.software/healthz
curl https://api.solvcommit.eterno.software/healthz
```

### View Live Logs
```bash
# Follow logs for all services
docker compose -f compose.prod.yaml logs -f

# Follow specific service
docker compose -f compose.prod.yaml logs -f api
docker compose -f compose.prod.yaml logs -f publisher
docker compose -f compose.prod.yaml logs -f caddy
```

---

## 6. Updating the Application

When a new version is pushed to GitHub, the GitHub Actions workflow builds and publishes images to GHCR:
- `ghcr.io/enftaurus/solvcommit-frontend:latest`
- `ghcr.io/enftaurus/solvcommit-api:latest`
- `ghcr.io/enftaurus/solvcommit-publisher:latest`

### Zero / Low-Downtime Rolling Update
To pull and apply the latest images on the VM:
```bash
cd /opt/solvcommit

# Pull latest container images
docker compose -f compose.prod.yaml pull

# Recreate containers with new images
docker compose -f compose.prod.yaml up -d --no-deps api publisher frontend

# Prune unused dangling images
docker image prune -f
```

### Rollback Procedure
If a release causes issues, rollback to a specific SHA or previous tag:
```bash
# Set specific version tag in .env or via environment variable
IMAGE_TAG=sha-<previous_commit_sha> docker compose -f compose.prod.yaml up -d
```

---

## 7. Database Backup & Restore Procedures

### Automated Daily Backup Script
Create `/opt/solvcommit/scripts/backup-db.sh`:
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/solvcommit/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/solvcommit_db_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Run pg_dump from inside the container without exposing credentials
docker compose -f /opt/solvcommit/compose.prod.yaml exec -T postgres \
  pg_dump -U solvcommit -d solvcommit | gzip > "$BACKUP_FILE"

chmod 600 "$BACKUP_FILE"

# Keep last 14 days of backups
find "$BACKUP_DIR" -type f -name "solvcommit_db_*.sql.gz" -mtime +14 -delete

echo "Backup completed: $BACKUP_FILE"
```
Make executable:
```bash
chmod +x /opt/solvcommit/scripts/backup-db.sh
```

### Database Restoration
To restore from a backup:
```bash
# 1. Unzip the backup file
gunzip -c /opt/solvcommit/backups/solvcommit_db_<timestamp>.sql.gz > /tmp/restore.sql

# 2. Feed the dump into PostgreSQL container
cat /tmp/restore.sql | docker compose -f compose.prod.yaml exec -T postgres psql -U solvcommit -d solvcommit

# 3. Clean up the uncompressed temporary SQL file
rm /tmp/restore.sql
```

---

## 8. Safety Invariants & Destructive Commands

> [!CAUTION]
> **NEVER run `docker compose down -v` on production!**
> The `-v` (or `--volumes`) flag **permanently deletes** the Docker named volumes (`solvcommit_postgres_data`, `solvcommit_kafka_data`, and `solvcommit_caddy_data`). This will destroy all registered users, device pairings, submission metadata, and Let's Encrypt certificates.
> 
> Safe commands for routine maintenance:
> - Stop services: `docker compose -f compose.prod.yaml stop`
> - Restart services: `docker compose -f compose.prod.yaml restart`
> - Remove containers safely (preserving volumes): `docker compose -f compose.prod.yaml down` (without `-v`)

---

## 9. Troubleshooting & FAQ

### TLS Certificate Issuance Failures
- **Symptom**: Caddy logs show ACME challenge timeout or rate limit errors.
- **Resolution**:
  1. Verify DNS `A` records point to the VM's public IP: `dig +short solvcommit.eterno.software`.
  2. Verify Azure NSG allows inbound TCP port 80 and 443 from all sources.
  3. Inspect Caddy logs: `docker compose -f compose.prod.yaml logs caddy`.

### Kafka Out of Memory (OOM) / Container Exits
- **Symptom**: Kafka container gets killed with exit code 137.
- **Resolution**: Verify `KAFKA_HEAP_OPTS: "-Xms256M -Xmx512M"` is set in `compose.prod.yaml`. If host memory is tight, create a 2 GiB swap file on Ubuntu:
  ```bash
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

### Database Connection Refused
- **Symptom**: API or Publisher logs `dial tcp ... connect: connection refused`.
- **Resolution**: The API and Publisher wait for PostgreSQL's `pg_isready` healthcheck before starting. Check Postgres container logs: `docker compose -f compose.prod.yaml logs postgres`.
