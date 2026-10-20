package email

import (
	"context"
	"log/slog"
	"testing"
	"time"
)

func TestSMTPSender_DevFallback(t *testing.T) {
	cfg := Config{
		Host:         "", // unconfigured: should log and succeed
		Port:         587,
		From:         "noreply@solvcommit.dev",
		SupportEmail: "valyrianminds@zohomail.in",
	}

	sender := NewSender(cfg, slog.Default())

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := sender.Send(ctx, "developer@example.com", "Test Subject", "Test message body")
	if err != nil {
		t.Fatalf("expected nil error on dev fallback, got: %v", err)
	}

	delErr := sender.SendDeletionConfirmation(ctx, "developer@example.com")
	if delErr != nil {
		t.Fatalf("expected nil error on deletion confirmation, got: %v", delErr)
	}
}

func TestSMTPSender_EmptyRecipient(t *testing.T) {
	sender := NewSender(Config{}, slog.Default())
	err := sender.Send(context.Background(), "", "Subject", "Body")
	if err == nil {
		t.Fatalf("expected error for empty recipient, got nil")
	}
}
