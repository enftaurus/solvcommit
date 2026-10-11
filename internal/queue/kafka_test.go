package queue_test

import (
	"context"
	"testing"
	"time"

	"leetsync/internal/queue"
)

func TestFormatSubID(t *testing.T) {
	// Acceptance Criterion: 64-bit submission IDs exceeding signed 32-bit limit
	var largeID int64 = 2138016677
	str := queue.FormatSubID(largeID)
	if str != "2138016677" {
		t.Errorf("expected string '2138016677', got '%s'", str)
	}

	var maxInt64 int64 = 9223372036854775807
	strMax := queue.FormatSubID(maxInt64)
	if strMax != "9223372036854775807" {
		t.Errorf("expected max int64 string, got '%s'", strMax)
	}
}

func TestKafkaClientPingFailure(t *testing.T) {
	// Ping non-existent broker should fail gracefully without panic
	client := queue.NewClient([]string{"localhost:99999"}, "submissions")
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	err := client.Ping(ctx)
	if err == nil {
		t.Errorf("expected error pinging invalid broker port, got nil")
	}
}
