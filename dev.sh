#!/usr/bin/env bash
set -eo pipefail

# Ensure /usr/local/go/bin is in PATH if present
if [ -d "/usr/local/go/bin" ] && ! command -v go >/dev/null 2>&1; then
  export PATH="/usr/local/go/bin:$PATH"
fi

COMMAND="${1:-start}"

check_prerequisites() {
  if ! command -v go >/dev/null 2>&1; then
    echo "Error: Go is not installed or not in PATH."
    exit 1
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "Error: Docker is not installed or not in PATH."
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "Error: Docker Compose is not installed."
    exit 1
  fi
}

init_env() {
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      echo "Creating .env from .env.example..."
      cp .env.example .env
    else
      echo "Warning: .env.example not found."
    fi
  fi
}

wait_for_infra() {
  echo "Waiting for PostgreSQL to be healthy..."
  local timeout=30
  local count=0
  until docker compose exec -T postgres pg_isready -h localhost -p 5432 -U leetsync -d leetsync >/dev/null 2>&1; do
    sleep 1
    count=$((count + 1))
    if [ $count -ge $timeout ]; then
      echo "Error: Timed out waiting for PostgreSQL."
      exit 1
    fi
  done
  echo "PostgreSQL is ready."

  echo "Waiting for Kafka to be healthy..."
  count=0
  until docker compose exec -T kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 >/dev/null 2>&1; do
    sleep 2
    count=$((count + 2))
    if [ $count -ge $timeout ]; then
      echo "Error: Timed out waiting for Kafka."
      exit 1
    fi
  done
  echo "Kafka is ready."
}

start_infra() {
  check_prerequisites
  init_env
  echo "Starting infrastructure containers (PostgreSQL, Kafka)..."
  docker compose up -d
  wait_for_infra
  echo "Applying database migrations..."
  ./scripts/migrate.sh
  echo "Setting up Kafka topics..."
  ./scripts/create-topics.sh
}

build_binaries() {
  echo "Building Go binaries..."
  mkdir -p bin
  if [ -d "web" ] && command -v npm >/dev/null 2>&1; then
    if [ ! -d "web/dist" ] || [ "web/src" -nt "web/dist" ]; then
      echo "Building web dashboard assets..."
      (cd web && npm run build)
    fi
  fi
  go build -o bin/api ./cmd/api
  go build -o bin/publisher ./cmd/publisher
  echo "Build complete."
}

run_tests() {
  check_prerequisites
  echo "Running automated tests..."
  go test -v ./...
}

show_logs() {
  docker compose logs -f
}

stop_all() {
  echo "Stopping services and infrastructure..."
  # Kill local services if running
  pkill -f "bin/api" || true
  pkill -f "bin/publisher" || true
  docker compose stop
  echo "Services stopped. (PostgreSQL data preserved in docker volume)."
}

reset_all() {
  echo "WARNING: Reset is destructive and will erase all database data and Kafka topics."
  echo "Resetting Docker Compose volumes and cleaning binaries..."
  pkill -f "bin/api" || true
  pkill -f "bin/publisher" || true
  docker compose down -v
  rm -rf bin/
  echo "Reset complete. Database volumes and topics destroyed."
}

start_all() {
  check_prerequisites
  init_env
  start_infra
  build_binaries

  echo "=================================================="
  echo "Starting LeetSync native Go services..."
  echo "=================================================="

  # Launch native Go services
  ./bin/api &
  API_PID=$!
  ./bin/publisher &
  PUB_PID=$!

  cleanup() {
    echo ""
    echo "Received termination signal. Shutting down native Go services..."
    kill -TERM "$API_PID" 2>/dev/null || true
    kill -TERM "$PUB_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
    wait "$PUB_PID" 2>/dev/null || true
    echo "Services stopped. Infrastructure remains running (use ./dev.sh stop to stop infra)."
    exit 0
  }

  trap cleanup SIGINT SIGTERM

  # Wait for services
  wait
}

case "$COMMAND" in
  start|"")
    start_all
    ;;
  infra)
    start_infra
    ;;
  migrate)
    check_prerequisites
    ./scripts/migrate.sh
    ;;
  test)
    run_tests
    ;;
  logs)
    show_logs
    ;;
  stop)
    stop_all
    ;;
  reset)
    reset_all
    ;;
  build)
    check_prerequisites
    build_binaries
    ;;
  *)
    echo "Usage: ./dev.sh [start|infra|migrate|test|logs|stop|reset|build]"
    exit 1
    ;;
esac
