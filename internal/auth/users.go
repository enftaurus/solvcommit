package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUserNotFound = errors.New("user not found")

type UserProfile struct {
	ID             string    `json:"id"`
	Status         string    `json:"status"`
	GitHubUserID   int64     `json:"github_user_id"`
	InstallationID int64     `json:"installation_id"`
	CreatedAt      time.Time `json:"created_at"`
}

type UserService struct {
	pool *pgxpool.Pool
}

func NewUserService(pool *pgxpool.Pool) *UserService {
	return &UserService{pool: pool}
}

// UpsertGitHubUser creates or finds user by GitHub ID and associates App installation (D-12, D-19)
func (s *UserService) UpsertGitHubUser(ctx context.Context, githubUserID, installationID int64) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var userID string
	// Check if connection already exists
	queryExisting := `SELECT user_id FROM github_connections WHERE github_user_id = $1;`
	err = tx.QueryRow(ctx, queryExisting, githubUserID).Scan(&userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("failed to check existing connection: %w", err)
	}

	if userID == "" {
		// New user
		insertUser := `INSERT INTO users (status) VALUES ('active') RETURNING id;`
		if err := tx.QueryRow(ctx, insertUser).Scan(&userID); err != nil {
			return "", fmt.Errorf("failed to create user: %w", err)
		}

		insertConn := `
			INSERT INTO github_connections (user_id, github_user_id, installation_id, status)
			VALUES ($1, $2, $3, 'connected');
		`
		if _, err := tx.Exec(ctx, insertConn, userID, githubUserID, installationID); err != nil {
			return "", fmt.Errorf("failed to link github connection: %w", err)
		}
	} else {
		// Update installation ID if changed (do not overwrite with 0)
		updateConn := `
			UPDATE github_connections
			SET installation_id = CASE WHEN $1 > 0 THEN $1 ELSE installation_id END,
			    status = 'connected',
			    updated_at = NOW()
			WHERE user_id = $2;
		`
		if _, err := tx.Exec(ctx, updateConn, installationID, userID); err != nil {
			return "", fmt.Errorf("failed to update github connection: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}

	return userID, nil
}

// GetProfile retrieves user profile
func (s *UserService) GetProfile(ctx context.Context, userID string) (*UserProfile, error) {
	query := `
		SELECT u.id, u.status, u.created_at, gc.github_user_id, gc.installation_id
		FROM users u
		LEFT JOIN github_connections gc ON u.id = gc.user_id
		WHERE u.id = $1;
	`
	var p UserProfile
	err := s.pool.QueryRow(ctx, query, userID).Scan(&p.ID, &p.Status, &p.CreatedAt, &p.GitHubUserID, &p.InstallationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &p, nil
}

// HardDelete removes user and all cascading relations (D-22)
func (s *UserService) HardDelete(ctx context.Context, userID string) error {
	query := `DELETE FROM users WHERE id = $1;`
	tag, err := s.pool.Exec(ctx, query, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}
