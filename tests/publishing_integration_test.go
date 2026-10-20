package tests

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"leetsync/internal/auth"
	"leetsync/internal/database"
	"leetsync/internal/github"
	"leetsync/internal/publisher"
	"leetsync/internal/submissions"
)

func generateTestRSAKey(t *testing.T) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}
	keyBytes := x509.MarshalPKCS1PrivateKey(key)
	return pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: keyBytes,
	})
}

func TestPublishingPipelineIntegration(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live publishing integration test: PostgreSQL unreachable: %v", err)
		return
	}
	defer db.Close()

	// Create test user and repository configuration
	userSvc := auth.NewUserService(db.Pool)
	userID, err := userSvc.UpsertGitHubUser(ctx, 77665544, 98765)
	if err != nil {
		t.Fatalf("failed to upsert user: %v", err)
	}
	defer func() {
		_ = userSvc.HardDelete(context.Background(), userID)
	}()

	// Insert destination repository
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO repositories (user_id, github_repo_id, owner, name, default_branch, status)
		VALUES ($1, 9999, 'octotest', 'leetcode-solutions', 'main', 'active')
		ON CONFLICT (user_id, github_repo_id) DO UPDATE SET status = 'active';
	`, userID)
	if err != nil {
		t.Fatalf("failed to configure repository: %v", err)
	}

	// Mock GitHub HTTP Server
	var mu sync.Mutex
	filesStore := make(map[string]string) // path -> content
	putCount := 0

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()

		// 1. App token minting
		if strings.HasPrefix(r.URL.Path, "/app/installations/") && strings.HasSuffix(r.URL.Path, "/access_tokens") {
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"token":      "ghs_mock_token_pub",
				"expires_at": time.Now().Add(1 * time.Hour).Format(time.RFC3339),
			})
			return
		}

		// 2. Contents API
		if strings.HasPrefix(r.URL.Path, "/repos/octotest/leetcode-solutions/contents/") {
			relPath := strings.TrimPrefix(r.URL.Path, "/repos/octotest/leetcode-solutions/contents/")
			if r.Method == http.MethodGet {
				content, exists := filesStore[relPath]
				if !exists {
					http.NotFound(w, r)
					return
				}
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"path":     relPath,
					"sha":      "25b90218153406f8e7182da94089c16262b9a7c3",
					"content":  base64.StdEncoding.EncodeToString([]byte(content)),
					"encoding": "base64",
					"size":     len(content),
				})
				return
			}

			if r.Method == http.MethodPut {
				if relPath != "README.md" {
					putCount++
				}
				body, _ := io.ReadAll(r.Body)
				var req struct {
					Message string `json:"message"`
					Content string `json:"content"`
				}
				_ = json.Unmarshal(body, &req)
				raw, _ := base64.StdEncoding.DecodeString(req.Content)
				filesStore[relPath] = string(raw)

				w.WriteHeader(http.StatusCreated)
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"content": map[string]string{"sha": "25b90218153406f8e7182da94089c16262b9a7c3"},
					"commit":  map[string]string{"sha": "25b90218153406f8e7182da94089c16262b9a7c3"},
				})
				return
			}
		}

		http.NotFound(w, r)
	}))
	defer mockServer.Close()

	keyPEM := generateTestRSAKey(t)
	ghClient, err := github.NewClient("app-987", keyPEM, mockServer.URL)
	if err != nil {
		t.Fatalf("failed to create github client: %v", err)
	}

	worker := publisher.NewWorker(db.Pool, ghClient, nil)

	// Test 1: Publish Accepted Submission (FR-GH-04, FR-GH-05, D-11)
	code1 := "def twoSum(nums, target):\n    return [0, 1]"
	msg1 := &submissions.KafkaSubmissionMessage{
		SchemaVersion: 1,
		JobID:         "job-1",
		UserID:        userID,
		DeviceID:      "dev-1",
		SubmissionID:  "2138016677",
		ProblemSlug:   "two-sum",
		ProblemTitle:  "Two Sum",
		Language:      "python3",
		Code:          code1,
		ContentSHA256: "sha256-code-1",
		SubmittedAt:   time.Now(),
		ReceivedAt:    time.Now(),
	}

	err = worker.ProcessSubmission(ctx, msg1)
	if err != nil {
		t.Fatalf("failed to process submission 1: %v", err)
	}

	// Verify file was written to expected path in repo: two-sum/submission-2138016677.py (D-11)
	expectedPath1 := "two-sum/submission-2138016677.py"
	mu.Lock()
	if filesStore[expectedPath1] != code1 {
		t.Errorf("expected file content '%s', got '%s'", code1, filesStore[expectedPath1])
	}
	if putCount != 1 {
		t.Errorf("expected exactly 1 PutFile call, got %d", putCount)
	}
	mu.Unlock()

	// Verify PostgreSQL metadata row is marked 'published' with github_path and commit_sha
	var status1, path1, commit1 string
	err = db.Pool.QueryRow(ctx, `
		SELECT status, github_path, commit_sha
		FROM submissions
		WHERE user_id = $1 AND leetcode_submission_id = 2138016677
	`, userID).Scan(&status1, &path1, &commit1)
	if err != nil {
		t.Fatalf("failed to query submission 1 row: %v", err)
	}
	if status1 != "published" || path1 != expectedPath1 || commit1 == "" {
		t.Errorf("unexpected submission row state: status=%s path=%s commit=%s", status1, path1, commit1)
	}

	// Test 2: Idempotent Reprocessing (FR-HIST-02: duplicate creates no second commit)
	err = worker.ProcessSubmission(ctx, msg1)
	if err != nil {
		t.Fatalf("failed on duplicate submission 1: %v", err)
	}
	mu.Lock()
	if putCount != 1 {
		t.Errorf("expected putCount to remain 1 on duplicate, got %d", putCount)
	}
	mu.Unlock()

	// Test 3: Ambiguous Write Recovery (FR-HIST-03)
	// Simulate: File already committed on GitHub, but DB row was queued / not updated
	code2 := "def addTwoNumbers(): pass"
	expectedPath2 := "add-two-numbers/submission-2138016678.py"
	mu.Lock()
	filesStore[expectedPath2] = code2 // Already exists on GitHub
	mu.Unlock()

	msg2 := &submissions.KafkaSubmissionMessage{
		SchemaVersion: 1,
		JobID:         "job-2",
		UserID:        userID,
		DeviceID:      "dev-1",
		SubmissionID:  "2138016678",
		ProblemSlug:   "add-two-numbers",
		ProblemTitle:  "Add Two Numbers",
		Language:      "python3",
		Code:          code2,
		ContentSHA256: "sha256-code-2",
		SubmittedAt:   time.Now(),
		ReceivedAt:    time.Now(),
	}

	err = worker.ProcessSubmission(ctx, msg2)
	if err != nil {
		t.Fatalf("failed on ambiguous write recovery: %v", err)
	}

	mu.Lock()
	if putCount != 1 {
		t.Errorf("expected no additional PutFile call for existing matching file, putCount=%d", putCount)
	}
	mu.Unlock()

	var status2 string
	_ = db.Pool.QueryRow(ctx, "SELECT status FROM submissions WHERE user_id = $1 AND leetcode_submission_id = 2138016678", userID).Scan(&status2)
	if status2 != "published" {
		t.Errorf("expected status 'published' after ambiguous recovery, got '%s'", status2)
	}

	// Test 4: Path Conflict Detection (FR-HIST-04, D-14: visible conflict, never overwrite)
	// Simulate: File exists at target path with DIFFERENT content
	expectedPath3 := "two-sum/submission-2138016679.py"
	mu.Lock()
	filesStore[expectedPath3] = "DIFFERENT UNRELATED CONTENT IN REPO"
	mu.Unlock()

	msg3 := &submissions.KafkaSubmissionMessage{
		SchemaVersion: 1,
		JobID:         "job-3",
		UserID:        userID,
		DeviceID:      "dev-1",
		SubmissionID:  "2138016679",
		ProblemSlug:   "two-sum",
		ProblemTitle:  "Two Sum",
		Language:      "python3",
		Code:          "class NewSolution: pass",
		ContentSHA256: "sha256-code-3",
		SubmittedAt:   time.Now(),
		ReceivedAt:    time.Now(),
	}

	err = worker.ProcessSubmission(ctx, msg3)
	if err != nil {
		t.Fatalf("unexpected error on conflict: %v", err)
	}

	mu.Lock()
	// Must NOT overwrite! Content remains the original different content
	if filesStore[expectedPath3] != "DIFFERENT UNRELATED CONTENT IN REPO" {
		t.Errorf("VIOLATION: conflicting file was overwritten!")
	}
	if putCount != 1 {
		t.Errorf("expected putCount to remain 1 (no overwrite), got %d", putCount)
	}
	mu.Unlock()

	var status3, lastErr3 string
	_ = db.Pool.QueryRow(ctx, `
		SELECT status, last_error_code 
		FROM submissions 
		WHERE user_id = $1 AND leetcode_submission_id = 2138016679
	`, userID).Scan(&status3, &lastErr3)
	if status3 != "failed" || lastErr3 != "PATH_CONFLICT" {
		t.Errorf("expected status='failed' and last_error_code='PATH_CONFLICT', got status=%s err=%s", status3, lastErr3)
	}

	// Test 5: Multiple Distinct Submissions for same problem keep history (FR-HIST-01)
	code4 := "class OptimizedTwoSum: pass"
	msg4 := &submissions.KafkaSubmissionMessage{
		SchemaVersion: 1,
		JobID:         "job-4",
		UserID:        userID,
		DeviceID:      "dev-1",
		SubmissionID:  "2138016680",
		ProblemSlug:   "two-sum",
		ProblemTitle:  "Two Sum",
		Language:      "python3",
		Code:          code4,
		ContentSHA256: "sha256-code-4",
		SubmittedAt:   time.Now(),
		ReceivedAt:    time.Now(),
	}

	err = worker.ProcessSubmission(ctx, msg4)
	if err != nil {
		t.Fatalf("failed to process second distinct submission for two-sum: %v", err)
	}

	expectedPath4 := "two-sum/submission-2138016680.py"
	mu.Lock()
	if filesStore[expectedPath4] != code4 {
		t.Errorf("expected second solution to be written to %s", expectedPath4)
	}
	// First solution is still intact!
	if filesStore[expectedPath1] != code1 {
		t.Errorf("expected first solution %s to be preserved intact", expectedPath1)
	}
	if putCount != 2 {
		t.Errorf("expected putCount to be 2, got %d", putCount)
	}
	mu.Unlock()
}
