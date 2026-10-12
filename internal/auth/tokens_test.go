package auth_test

import (
	"testing"
	"time"

	"leetsync/internal/auth"
)

func TestTokenHashing(t *testing.T) {
	// D-12: Refresh tokens stored only as SHA-256 hashes
	token := "sample-high-entropy-token-12345"
	hash1 := auth.HashToken(token)
	hash2 := auth.HashToken(token)

	if hash1 != hash2 {
		t.Errorf("expected deterministic hash output")
	}
	if len(hash1) != 64 {
		t.Errorf("expected 64-char sha256 hex string, got %d", len(hash1))
	}

	diffHash := auth.HashToken("different-token")
	if diffHash == hash1 {
		t.Errorf("different tokens must produce different hashes")
	}
}

func TestDeviceAccessToken(t *testing.T) {
	secret := []byte("super-secret-key-for-testing-123456")
	tokenStr, err := auth.MintDeviceAccessToken(secret, "dev-1", "user-1", "fam-1", 15*time.Minute)
	if err != nil {
		t.Fatalf("failed to mint token: %v", err)
	}

	payload, err := auth.VerifyDeviceAccessToken(secret, tokenStr)
	if err != nil {
		t.Fatalf("failed to verify token: %v", err)
	}

	if payload.DeviceID != "dev-1" || payload.UserID != "user-1" || payload.FamilyID != "fam-1" {
		t.Errorf("payload mismatch: %+v", payload)
	}

	// Tampered token check
	tampered := tokenStr + "tamper"
	if _, err := auth.VerifyDeviceAccessToken(secret, tampered); err == nil {
		t.Errorf("expected error on tampered token signature")
	}

	// Expired token check
	expToken, _ := auth.MintDeviceAccessToken(secret, "dev-1", "user-1", "fam-1", -1*time.Second)
	if _, err := auth.VerifyDeviceAccessToken(secret, expToken); err == nil {
		t.Errorf("expected error on expired token")
	}
}

func TestSessionCookie(t *testing.T) {
	secret := []byte("super-secret-key-for-testing-123456")
	cookieStr, err := auth.MintSessionCookie(secret, "user-abc", 7*24*time.Hour)
	if err != nil {
		t.Fatalf("failed to mint cookie: %v", err)
	}

	payload, err := auth.VerifySessionCookie(secret, cookieStr)
	if err != nil {
		t.Fatalf("failed to verify cookie: %v", err)
	}

	if payload.UserID != "user-abc" {
		t.Errorf("expected user-abc, got %s", payload.UserID)
	}

	// Invalid signature
	wrongSecret := []byte("wrong-secret-key-123456789012345")
	if _, err := auth.VerifySessionCookie(wrongSecret, cookieStr); err == nil {
		t.Errorf("expected signature failure with wrong secret")
	}
}

func TestTokenCrossTypeRejection(t *testing.T) {
	secret := []byte("super-secret-key-for-testing-123456")

	// Mint device token
	deviceToken, err := auth.MintDeviceAccessToken(secret, "dev-1", "user-1", "fam-1", 15*time.Minute)
	if err != nil {
		t.Fatalf("failed to mint device token: %v", err)
	}

	// Mint session cookie
	sessionCookie, err := auth.MintSessionCookie(secret, "user-1", 7*24*time.Hour)
	if err != nil {
		t.Fatalf("failed to mint session cookie: %v", err)
	}

	// Verify device token with VerifySessionCookie -> MUST FAIL
	if _, err := auth.VerifySessionCookie(secret, deviceToken); err == nil {
		t.Errorf("expected VerifySessionCookie to reject device token, but it passed")
	}

	// Verify session cookie with VerifyDeviceAccessToken -> MUST FAIL
	if _, err := auth.VerifyDeviceAccessToken(secret, sessionCookie); err == nil {
		t.Errorf("expected VerifyDeviceAccessToken to reject session cookie, but it passed")
	}
}
