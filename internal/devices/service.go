package devices

import (
	"context"
	"errors"
	"fmt"
	"time"

	"leetsync/internal/auth"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDeviceNotFound      = errors.New("device not found")
	ErrDeviceRevoked       = errors.New("device revoked")
	ErrInvalidToken        = errors.New("invalid refresh token")
	ErrTokenReuseDetected  = errors.New("token reuse detected; device family revoked")
)

type Device struct {
	ID                string     `json:"id"`
	UserID            string     `json:"user_id"`
	DeviceName        string     `json:"device_name"`
	UserAgent         string     `json:"user_agent"`
	FirstIP           string     `json:"first_ip"`
	LastIP            string     `json:"last_ip"`
	TokenFamilyID     string     `json:"token_family_id"`
	CreatedAt         time.Time  `json:"created_at"`
	LastSeenAt        time.Time  `json:"last_seen_at"`
	RevokedAt         *time.Time `json:"revoked_at,omitempty"`
	RevokedReason     *string    `json:"revoked_reason,omitempty"`
}

type PairResult struct {
	DeviceID     string `json:"device_id"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"` // seconds
}

type RefreshResult struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

type Service struct {
	pool   *pgxpool.Pool
	secret []byte
}

func NewService(pool *pgxpool.Pool, secret string) *Service {
	return &Service{
		pool:   pool,
		secret: []byte(secret),
	}
}

// Pair creates a new device session, returning access & rotating refresh token (D-12, FR-EXT-02)
func (s *Service) Pair(ctx context.Context, userID, deviceName, userAgent, ip string) (*PairResult, error) {
	refreshToken, err := auth.GenerateRandomString(32)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}
	tokenHash := auth.HashToken(refreshToken)

	var deviceID string
	query := `
		INSERT INTO devices (
			user_id, device_name, user_agent, first_ip, last_ip,
			token_family_id, refresh_token_hash, created_at, last_seen_at
		) VALUES ($1, $2, $3, $4, $5, gen_random_uuid(), $6, NOW(), NOW())
		RETURNING id, token_family_id;
	`

	var returnedFamilyID string
	err = s.pool.QueryRow(ctx, query, userID, deviceName, userAgent, ip, ip, tokenHash).Scan(&deviceID, &returnedFamilyID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert device: %w", err)
	}

	// 15-minute access token
	ttl := 15 * time.Minute
	accessToken, err := auth.MintDeviceAccessToken(s.secret, deviceID, userID, returnedFamilyID, ttl)
	if err != nil {
		return nil, fmt.Errorf("failed to mint access token: %w", err)
	}

	return &PairResult{
		DeviceID:     deviceID,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(ttl.Seconds()),
	}, nil
}

// Refresh rotates the refresh token and issues a fresh access token with reuse detection (D-12)
func (s *Service) Refresh(ctx context.Context, deviceID, presentedToken, ip string) (*RefreshResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var (
		userID             string
		familyID           string
		currentHash        string
		prevHash           *string
		revokedAt          *time.Time
	)

	query := `
		SELECT user_id, token_family_id, refresh_token_hash, previous_token_hash, revoked_at
		FROM devices
		WHERE id = $1
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, query, deviceID).Scan(&userID, &familyID, &currentHash, &prevHash, &revokedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrDeviceNotFound
		}
		return nil, fmt.Errorf("failed to query device: %w", err)
	}

	if revokedAt != nil {
		return nil, ErrDeviceRevoked
	}

	presentedHash := auth.HashToken(presentedToken)

	// Reuse detection: If presented hash matches the PREVIOUS hash, token was stolen/reused!
	if prevHash != nil && *prevHash == presentedHash {
		// Revoke the whole family immediately
		_, _ = tx.Exec(ctx, `
			UPDATE devices 
			SET revoked_at = NOW(), revoked_reason = 'token_reuse_detected'
			WHERE id = $1;
		`, deviceID)
		_ = tx.Commit(ctx)
		return nil, ErrTokenReuseDetected
	}

	if currentHash != presentedHash {
		return nil, ErrInvalidToken
	}

	// Valid refresh: generate new refresh token and rotate
	newRefreshToken, err := auth.GenerateRandomString(32)
	if err != nil {
		return nil, err
	}
	newHash := auth.HashToken(newRefreshToken)

	updateQuery := `
		UPDATE devices
		SET previous_token_hash = refresh_token_hash,
		    refresh_token_hash = $1,
		    last_ip = $2,
		    last_seen_at = NOW()
		WHERE id = $3;
	`
	if _, err := tx.Exec(ctx, updateQuery, newHash, ip, deviceID); err != nil {
		return nil, fmt.Errorf("failed to rotate refresh token: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	ttl := 15 * time.Minute
	accessToken, err := auth.MintDeviceAccessToken(s.secret, deviceID, userID, familyID, ttl)
	if err != nil {
		return nil, err
	}

	return &RefreshResult{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    int(ttl.Seconds()),
	}, nil
}

// List returns all extension devices for a user (D-13)
func (s *Service) List(ctx context.Context, userID string) ([]Device, error) {
	query := `
		SELECT id, user_id, device_name, user_agent, first_ip, last_ip,
		       token_family_id, created_at, last_seen_at, revoked_at, revoked_reason
		FROM devices
		WHERE user_id = $1
		ORDER BY created_at DESC;
	`
	rows, err := s.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Device
	for rows.Next() {
		var d Device
		err := rows.Scan(
			&d.ID, &d.UserID, &d.DeviceName, &d.UserAgent, &d.FirstIP, &d.LastIP,
			&d.TokenFamilyID, &d.CreatedAt, &d.LastSeenAt, &d.RevokedAt, &d.RevokedReason,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, d)
	}

	if result == nil {
		result = []Device{}
	}
	return result, nil
}

// Revoke explicitly terminates a device session (D-12, FR-AUTH-04)
func (s *Service) Revoke(ctx context.Context, userID, deviceID string) error {
	query := `
		UPDATE devices
		SET revoked_at = NOW(), revoked_reason = 'user_revoked'
		WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;
	`
	tag, err := s.pool.Exec(ctx, query, deviceID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrDeviceNotFound
	}
	return nil
}

// ValidateDeviceActive verifies that a device ID is currently active (not revoked)
func (s *Service) ValidateDeviceActive(ctx context.Context, deviceID string) error {
	var revokedAt *time.Time
	query := `SELECT revoked_at FROM devices WHERE id = $1;`
	err := s.pool.QueryRow(ctx, query, deviceID).Scan(&revokedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrDeviceNotFound
		}
		return err
	}
	if revokedAt != nil {
		return ErrDeviceRevoked
	}
	return nil
}
