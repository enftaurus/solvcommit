package repositories

import (
	"context"
	"errors"
	"fmt"
	"time"

	"leetsync/internal/github"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNoConnection    = errors.New("user has no github app connection")
	ErrRepoNotFound    = errors.New("repository not found")
	ErrNoSelectedRepo  = errors.New("no active repository selected for user")
)

type Repository struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	GitHubRepoID  int64     `json:"github_repo_id"`
	Owner         string    `json:"owner"`
	Name          string    `json:"name"`
	DefaultBranch string    `json:"default_branch"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type SelectRepoRequest struct {
	GitHubRepoID  int64  `json:"github_repo_id"`
	Owner         string `json:"owner"`
	Name          string `json:"name"`
	DefaultBranch string `json:"default_branch"`
}

type Service struct {
	pool   *pgxpool.Pool
	github github.Client
}

func NewService(pool *pgxpool.Pool, gh github.Client) *Service {
	return &Service{
		pool:   pool,
		github: gh,
	}
}

// GetUserInstallationID finds the installation ID from github_connections
func (s *Service) GetUserInstallationID(ctx context.Context, userID string) (int64, error) {
	var instID int64
	query := `SELECT installation_id FROM github_connections WHERE user_id = $1 AND status = 'connected';`
	err := s.pool.QueryRow(ctx, query, userID).Scan(&instID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrNoConnection
		}
		return 0, fmt.Errorf("failed to get installation id: %w", err)
	}
	return instID, nil
}

// ListAvailable lists GitHub repositories available to the user's installation
func (s *Service) ListAvailable(ctx context.Context, userID string) ([]github.RepositoryInfo, error) {
	instID, err := s.GetUserInstallationID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.github.ListRepositories(ctx, instID)
}

// SelectRepository connects and sets the user's destination repository (FR-GH-02, FR-GH-03, D-14)
func (s *Service) SelectRepository(ctx context.Context, userID string, req *SelectRepoRequest) (*Repository, error) {
	if req.Owner == "" || req.Name == "" || req.GitHubRepoID <= 0 {
		return nil, errors.New("invalid repository details")
	}
	branch := req.DefaultBranch
	if branch == "" {
		branch = "main"
	}

	instID, err := s.GetUserInstallationID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 1. Server-side verification of repo write permissions (FR-GH-02)
	if err := s.github.VerifyRepoWrite(ctx, instID, req.Owner, req.Name); err != nil {
		return nil, fmt.Errorf("write verification failed: %w", err)
	}

	// 2. Safe README handling (FR-GH-03, D-14): Never touch existing README.
	// Only initialize basic README if none exists.
	_, err = s.github.GetFile(ctx, instID, req.Owner, req.Name, "README.md")
	if errors.Is(err, github.ErrFileNotFound) {
		defaultReadme := "# LeetCode Submissions\n\nPersonal LeetCode solutions synchronized automatically by [LeetSync](https://github.com/adias/leetsync).\n"
		_, putErr := s.github.PutFile(ctx, instID, req.Owner, req.Name, "README.md", defaultReadme, "chore: initialize leetsync readme", branch)
		if putErr != nil {
			// Non-fatal if branch is empty or initialization fails; log and proceed
			fmt.Printf("[LeetSync] Note: initial README creation skipped/failed: %v\n", putErr)
		}
	}

	// 3. Persist repository in database
	query := `
		INSERT INTO repositories (
			user_id, github_repo_id, owner, name, default_branch, status, updated_at
		) VALUES ($1, $2, $3, $4, $5, 'active', NOW())
		ON CONFLICT (user_id, github_repo_id) 
		DO UPDATE SET 
			owner = EXCLUDED.owner,
			name = EXCLUDED.name,
			default_branch = EXCLUDED.default_branch,
			status = 'active',
			updated_at = NOW()
		RETURNING id, user_id, github_repo_id, owner, name, default_branch, status, created_at, updated_at;
	`

	var repo Repository
	err = s.pool.QueryRow(ctx, query, userID, req.GitHubRepoID, req.Owner, req.Name, branch).Scan(
		&repo.ID, &repo.UserID, &repo.GitHubRepoID, &repo.Owner, &repo.Name,
		&repo.DefaultBranch, &repo.Status, &repo.CreatedAt, &repo.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to save repository: %w", err)
	}

	return &repo, nil
}

// GetSelected retrieves the current active destination repository for the user
func (s *Service) GetSelected(ctx context.Context, userID string) (*Repository, error) {
	query := `
		SELECT id, user_id, github_repo_id, owner, name, default_branch, status, created_at, updated_at
		FROM repositories
		WHERE user_id = $1 AND status = 'active'
		ORDER BY updated_at DESC
		LIMIT 1;
	`
	var repo Repository
	err := s.pool.QueryRow(ctx, query, userID).Scan(
		&repo.ID, &repo.UserID, &repo.GitHubRepoID, &repo.Owner, &repo.Name,
		&repo.DefaultBranch, &repo.Status, &repo.CreatedAt, &repo.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoSelectedRepo
		}
		return nil, fmt.Errorf("failed to query selected repository: %w", err)
	}
	return &repo, nil
}

// UpdateSelected updates branch configuration on user's active repository
func (s *Service) UpdateSelected(ctx context.Context, userID string, defaultBranch string) (*Repository, error) {
	if defaultBranch == "" {
		return nil, errors.New("default branch cannot be empty")
	}

	query := `
		UPDATE repositories
		SET default_branch = $2, updated_at = NOW()
		WHERE user_id = $1 AND status = 'active'
		RETURNING id, user_id, github_repo_id, owner, name, default_branch, status, created_at, updated_at;
	`
	var repo Repository
	err := s.pool.QueryRow(ctx, query, userID, defaultBranch).Scan(
		&repo.ID, &repo.UserID, &repo.GitHubRepoID, &repo.Owner, &repo.Name,
		&repo.DefaultBranch, &repo.Status, &repo.CreatedAt, &repo.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoSelectedRepo
		}
		return nil, fmt.Errorf("failed to update repository: %w", err)
	}
	return &repo, nil
}

// VerifySelected checks write access to the currently selected repository (FR-GH-02)
func (s *Service) VerifySelected(ctx context.Context, userID string) error {
	repo, err := s.GetSelected(ctx, userID)
	if err != nil {
		return err
	}

	instID, err := s.GetUserInstallationID(ctx, userID)
	if err != nil {
		return err
	}

	return s.github.VerifyRepoWrite(ctx, instID, repo.Owner, repo.Name)
}
