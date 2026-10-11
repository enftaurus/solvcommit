#!/usr/bin/env bash
set -euo pipefail

# Runs PostgreSQL migrations
MIGRATIONS_DIR="${MIGRATIONS_DIR:-migrations}"
DB_URL="${DATABASE_URL:-postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable}"

echo "Applying SQL migrations from ${MIGRATIONS_DIR}..."

if docker compose ps postgres | grep -q "Up"; then
  # Use psql inside running postgres container
  for f in $(ls -1 "${MIGRATIONS_DIR}"/*.sql | sort); do
    filename=$(basename "$f")
    echo "Checking ${filename}..."
    docker compose exec -T postgres psql -U leetsync -d leetsync -c \
      "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" > /dev/null

    applied=$(docker compose exec -T postgres psql -U leetsync -d leetsync -t -A -c \
      "SELECT COUNT(*) FROM schema_migrations WHERE version = '${filename}';")

    if [ "$applied" -eq 0 ]; then
      echo "Applying ${filename}..."
      docker compose exec -T postgres psql -U leetsync -d leetsync < "$f"
      docker compose exec -T postgres psql -U leetsync -d leetsync -c \
        "INSERT INTO schema_migrations (version) VALUES ('${filename}');" > /dev/null
      echo "Applied ${filename} successfully."
    else
      echo "${filename} already applied."
    fi
  done
  echo "All migrations applied successfully."
else
  echo "PostgreSQL container is not running. Start infrastructure first."
  exit 1
fi
