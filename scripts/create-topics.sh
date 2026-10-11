#!/usr/bin/env bash
set -euo pipefail

# Idempotently creates Kafka topics with configured retention
BOOTSTRAP_SERVER="${KAFKA_BROKERS:-localhost:9092}"
TOPIC_NAME="${KAFKA_TOPIC_SUBMISSIONS:-submissions}"
RETENTION_MS="604800000" # 7 days = 7 * 24 * 60 * 60 * 1000 ms

echo "Checking / creating topic: ${TOPIC_NAME} on ${BOOTSTRAP_SERVER}..."

# Use kafka-topics inside running kafka container or local binary
if docker compose ps kafka | grep -q "Up"; then
  docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server "${BOOTSTRAP_SERVER}" \
    --create \
    --if-not-exists \
    --topic "${TOPIC_NAME}" \
    --partitions 1 \
    --replication-factor 1 \
    --config retention.ms="${RETENTION_MS}"
  echo "Topic ${TOPIC_NAME} is ready (retention: 7 days)."
else
  echo "Kafka container is not running. Start infrastructure first."
  exit 1
fi
