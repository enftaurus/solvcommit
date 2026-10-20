package email

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/smtp"
	"strings"
	"time"
)

// Sender interface for transactional email delivery
type Sender interface {
	Send(ctx context.Context, to, subject, body string) error
	SendDeletionConfirmation(ctx context.Context, to string) error
	SendSecurityNotification(ctx context.Context, to, eventDescription string) error
}

// Config holds SMTP and transactional email settings
type Config struct {
	Host         string
	Port         int
	User         string
	Pass         string
	From         string
	SupportEmail string
}

// SMTPSender implements Sender using standard Go net/smtp
type SMTPSender struct {
	cfg    Config
	logger *slog.Logger
}

// NewSender creates a new transactional email sender
func NewSender(cfg Config, logger *slog.Logger) Sender {
	if logger == nil {
		logger = slog.Default()
	}
	if cfg.From == "" {
		cfg.From = "noreply@solvcommit.dev"
	}
	if cfg.SupportEmail == "" {
		cfg.SupportEmail = "valyrianminds@zohomail.in"
	}
	return &SMTPSender{
		cfg:    cfg,
		logger: logger,
	}
}

func (s *SMTPSender) Send(ctx context.Context, to, subject, body string) error {
	to = strings.TrimSpace(to)
	if to == "" {
		return fmt.Errorf("recipient email address cannot be empty")
	}

	// If SMTP host is not configured (e.g. in development), log message and succeed gracefully
	if s.cfg.Host == "" {
		s.logger.Info("Transactional email generated (SMTP not configured, logging to stdout)",
			"to", to,
			"from", s.cfg.From,
			"subject", subject,
		)
		return nil
	}

	addr := net.JoinHostPort(s.cfg.Host, fmt.Sprintf("%d", s.cfg.Port))
	var auth smtp.Auth
	if s.cfg.User != "" && s.cfg.Pass != "" {
		auth = smtp.PlainAuth("", s.cfg.User, s.cfg.Pass, s.cfg.Host)
	}

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n",
		s.cfg.From,
		to,
		subject,
		time.Now().Format(time.RFC1123Z),
		body,
	)

	errChan := make(chan error, 1)
	go func() {
		errChan <- smtp.SendMail(addr, auth, s.cfg.From, []string{to}, []byte(msg))
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errChan:
		if err != nil {
			s.logger.Error("Failed to deliver transactional email via SMTP", "to", to, "error", err)
			return fmt.Errorf("smtp send failed: %w", err)
		}
		s.logger.Info("Transactional email successfully sent", "to", to, "subject", subject)
		return nil
	}
}

func (s *SMTPSender) SendDeletionConfirmation(ctx context.Context, to string) error {
	subject := "SolvCommit Account Deletion Confirmation"
	body := fmt.Sprintf(`Hello,

This email confirms that your SolvCommit account and all associated metadata, device pairings, repository associations, and submission history have been permanently deleted from our databases.

Important Notice:
- Any repositories and commits created on GitHub remain in your GitHub account and were not modified or deleted.
- If you did not initiate this deletion or have questions regarding your data privacy rights, please contact our support team at %s.

Best regards,
The SolvCommit Team
support: %s
`, s.cfg.SupportEmail, s.cfg.SupportEmail)

	return s.Send(ctx, to, subject, body)
}

func (s *SMTPSender) SendSecurityNotification(ctx context.Context, to, eventDescription string) error {
	subject := "SolvCommit Security Alert"
	body := fmt.Sprintf(`Hello,

We detected a security event associated with your SolvCommit account:
%s

Timestamp: %s UTC

If this was you, no action is required. If you did not perform this action, please visit https://github.com/settings/installations to review your GitHub App installations and reach out to %s immediately.

Best regards,
The SolvCommit Security Team
`, eventDescription, time.Now().UTC().Format(time.RFC3339), s.cfg.SupportEmail)

	return s.Send(ctx, to, subject, body)
}
