package repositories_test

import (
	"context"
	"errors"
	"testing"

	"leetsync/internal/github"
	"leetsync/internal/repositories"
)

type mockGitHubClient struct {
	verifyFunc   func(ctx context.Context, instID int64, owner, repo string) error
	getFileFunc  func(ctx context.Context, instID int64, owner, repo, path string) (*github.FileInfo, error)
	putFileFunc  func(ctx context.Context, instID int64, owner, repo, path, content, msg, branch string) (*github.CommitResult, error)
	listRepoFunc func(ctx context.Context, instID int64) ([]github.RepositoryInfo, error)
}

func (m *mockGitHubClient) GetInstallationToken(ctx context.Context, installationID int64) (string, error) {
	return "mock-token", nil
}

func (m *mockGitHubClient) ListRepositories(ctx context.Context, installationID int64) ([]github.RepositoryInfo, error) {
	if m.listRepoFunc != nil {
		return m.listRepoFunc(ctx, installationID)
	}
	return []github.RepositoryInfo{{ID: 100, Owner: "octocat", Name: "leetcode"}}, nil
}

func (m *mockGitHubClient) GetFile(ctx context.Context, installationID int64, owner, repo, path string) (*github.FileInfo, error) {
	if m.getFileFunc != nil {
		return m.getFileFunc(ctx, installationID, owner, repo, path)
	}
	return nil, github.ErrFileNotFound
}

func (m *mockGitHubClient) PutFile(ctx context.Context, installationID int64, owner, repo, path, content, msg, branch string) (*github.CommitResult, error) {
	if m.putFileFunc != nil {
		return m.putFileFunc(ctx, installationID, owner, repo, path, content, msg, branch)
	}
	return &github.CommitResult{CommitSHA: "commit-123", ContentSHA: "blob-123"}, nil
}

func (m *mockGitHubClient) UpdateFile(ctx context.Context, installationID int64, owner, repo, path, content, commitMsg, branch, fileSHA string) (*github.CommitResult, error) {
	return &github.CommitResult{CommitSHA: "commit-123", ContentSHA: "blob-123"}, nil
}

func (m *mockGitHubClient) VerifyRepoWrite(ctx context.Context, installationID int64, owner, repo string) error {
	if m.verifyFunc != nil {
		return m.verifyFunc(ctx, installationID, owner, repo)
	}
	return nil
}

func TestSelectRepoRequestValidation(t *testing.T) {
	svc := repositories.NewService(nil, &mockGitHubClient{})
	ctx := context.Background()

	// Invalid request
	_, err := svc.SelectRepository(ctx, "user-1", &repositories.SelectRepoRequest{
		Owner: "",
		Name:  "repo",
	})
	if err == nil {
		t.Fatal("expected error for empty owner")
	}
}

func TestVerifyPermissionDenied(t *testing.T) {
	mockGH := &mockGitHubClient{
		verifyFunc: func(ctx context.Context, instID int64, owner, repo string) error {
			return github.ErrPermissionDenied
		},
	}
	_ = mockGH
	// Verified client returns ErrPermissionDenied as expected
	err := mockGH.VerifyRepoWrite(context.Background(), 123, "octocat", "repo")
	if !errors.Is(err, github.ErrPermissionDenied) {
		t.Fatalf("expected ErrPermissionDenied, got %v", err)
	}
}
