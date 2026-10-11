package tests

import (
	"context"
	"os"
	"testing"
	"time"

	"leetsync/internal/auth"
	"leetsync/internal/database"
	"leetsync/internal/devices"
)

func TestIdentityAndSessionsIntegration(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live database integration test: PostgreSQL unreachable: %v", err)
		return
	}
	defer db.Close()

	secret := "test-secret-at-least-32-bytes-long"
	userSvc := auth.NewUserService(db.Pool)
	devSvc := devices.NewService(db.Pool, secret)

	// 1. Upsert GitHub User
	var githubUserID int64 = 8877665544
	var instID int64 = 112233
	userID, err := userSvc.UpsertGitHubUser(ctx, githubUserID, instID)
	if err != nil {
		t.Fatalf("failed to upsert github user: %v", err)
	}

	profile, err := userSvc.GetProfile(ctx, userID)
	if err != nil || profile.GitHubUserID != githubUserID {
		t.Fatalf("failed to retrieve profile: %v", err)
	}

	// 2. Pair Extension Device (Acceptance Criterion: Pair Extension)
	pairRes, err := devSvc.Pair(ctx, userID, "Integration Chrome", "Mozilla/5.0", "192.168.1.50")
	if err != nil {
		t.Fatalf("failed to pair device: %v", err)
	}
	if pairRes.DeviceID == "" || pairRes.RefreshToken == "" || pairRes.AccessToken == "" {
		t.Fatalf("invalid pair result: %+v", pairRes)
	}

	// Verify device appears in list with raw IP and last seen (Acceptance Criterion)
	devList, err := devSvc.List(ctx, userID)
	if err != nil || len(devList) == 0 {
		t.Fatalf("failed to list devices: %v", err)
	}
	found := false
	for _, d := range devList {
		if d.ID == pairRes.DeviceID {
			found = true
			if d.FirstIP != "192.168.1.50" || d.LastIP != "192.168.1.50" {
				t.Errorf("IP mismatch: first=%s last=%s", d.FirstIP, d.LastIP)
			}
			if d.LastSeenAt.IsZero() {
				t.Errorf("expected last_seen_at to be non-zero")
			}
		}
	}
	if !found {
		t.Fatalf("paired device not found in user device list")
	}

	// 3. Refresh Token Rotation
	oldRefreshToken := pairRes.RefreshToken
	refRes, err := devSvc.Refresh(ctx, pairRes.DeviceID, oldRefreshToken, "192.168.1.55")
	if err != nil {
		t.Fatalf("failed to refresh token: %v", err)
	}
	if refRes.RefreshToken == oldRefreshToken {
		t.Errorf("expected refresh token to rotate to a new value")
	}

	// 4. Token Reuse Detection (Acceptance Criterion: Reused token revokes family)
	_, err = devSvc.Refresh(ctx, pairRes.DeviceID, oldRefreshToken, "192.168.1.99")
	if !errorsIs(err, devices.ErrTokenReuseDetected) {
		t.Fatalf("expected ErrTokenReuseDetected on old token replay, got: %v", err)
	}

	// Verify device is now revoked in database
	err = devSvc.ValidateDeviceActive(ctx, pairRes.DeviceID)
	if !errorsIs(err, devices.ErrDeviceRevoked) {
		t.Fatalf("expected device to be revoked after reuse detection, got: %v", err)
	}

	// 5. Hard Deletion (D-22, Acceptance Criterion)
	if err := userSvc.HardDelete(ctx, userID); err != nil {
		t.Fatalf("failed to delete user: %v", err)
	}

	// Verify profile is gone
	if _, err := userSvc.GetProfile(ctx, userID); !errorsIs(err, auth.ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound after deletion, got: %v", err)
	}

	// Verify cascading deletion removed device rows
	var devCount int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM devices WHERE id = $1", pairRes.DeviceID).Scan(&devCount)
	if devCount != 0 {
		t.Fatalf("expected devices to be cascade-deleted, found %d", devCount)
	}
}

func errorsIs(err, target error) bool {
	if err == nil && target == nil {
		return true
	}
	if err == nil || target == nil {
		return false
	}
	return err.Error() == target.Error()
}
