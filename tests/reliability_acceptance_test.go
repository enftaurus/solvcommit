package tests

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"leetsync/internal/auth"
	"leetsync/internal/database"
	"leetsync/internal/devices"
	"leetsync/internal/github"
	"leetsync/internal/publisher"
	"leetsync/internal/submissions"
)

// TestConcurrencyAndPerRepoSerialization tests that multiple concurrent submissions
// for the same repository are safely serialized by the per-repo mutex and never cause
// race conditions or lost updates. (PRD: FR-GH-06, D-11)
func TestConcurrencyAndPerRepoSerialization(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live database test: PostgreSQL unreachable: %v", err)
		return
	}
	defer db.Close()

	userSvc := auth.NewUserService(db.Pool)
	userID, err := userSvc.UpsertGitHubUser(ctx, 88112233, 54321)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	defer func() {
		_ = userSvc.HardDelete(context.Background(), userID)
	}()

	// Configure repository
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO repositories (user_id, github_repo_id, owner, name, default_branch, status)
		VALUES ($1, 7777, 'octoconcurrent', 'leetcode-solutions', 'main', 'active')
		ON CONFLICT (user_id, github_repo_id) DO UPDATE SET status = 'active';
	`, userID)
	if err != nil {
		t.Fatalf("failed to insert repository: %v", err)
	}

	// Mock GitHub HTTP server tracking in-flight operations and committed files
	var mu sync.Mutex
	filesStore := make(map[string]string)
	var activeWrites int32

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Installation token endpoint
		if strings.HasPrefix(r.URL.Path, "/app/installations/") && strings.HasSuffix(r.URL.Path, "/access_tokens") {
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"token":      "ghs_mock_concurrency_token",
				"expires_at": time.Now().Add(1 * time.Hour).Format(time.RFC3339),
			})
			return
		}

		// GitHub Contents API
		if strings.HasPrefix(r.URL.Path, "/repos/octoconcurrent/leetcode-solutions/contents/") {
			relPath := strings.TrimPrefix(r.URL.Path, "/repos/octoconcurrent/leetcode-solutions/contents/")
			if r.Method == http.MethodGet {
				mu.Lock()
				content, exists := filesStore[relPath]
				mu.Unlock()
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
				// Assert serialization: no concurrent PUT should happen if per-repo locking works
				current := atomic.AddInt32(&activeWrites, 1)
				if current > 1 {
					t.Errorf("Race condition detected! %d simultaneous writes executing", current)
				}
				// Simulate realistic GitHub API write latency
				time.Sleep(20 * time.Millisecond)
				atomic.AddInt32(&activeWrites, -1)

				body, _ := io.ReadAll(r.Body)
				var req struct {
					Message string `json:"message"`
					Content string `json:"content"`
				}
				_ = json.Unmarshal(body, &req)
				raw, _ := base64.StdEncoding.DecodeString(req.Content)

				mu.Lock()
				filesStore[relPath] = string(raw)
				mu.Unlock()

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
	ghClient, err := github.NewClient("app-concurrency", keyPEM, mockServer.URL)
	if err != nil {
		t.Fatalf("failed to create github client: %v", err)
	}

	worker := publisher.NewWorker(db.Pool, ghClient, nil)

	// Launch 6 concurrent submissions for the same repository
	const numConcurrent = 6
	var wg sync.WaitGroup
	errCh := make(chan error, numConcurrent)

	for i := 0; i < numConcurrent; i++ {
		wg.Add(1)
		subID := int64(3000000000 + i)
		slug := fmt.Sprintf("problem-%d", i)
		title := fmt.Sprintf("Problem %d", i)
		code := fmt.Sprintf("// Solution for problem %d\nint solve() { return %d; }", i, i)

		go func(id int64, problemSlug, problemTitle, solutionCode string) {
			defer wg.Done()

			// Insert queued submission row in DB
			_, err := db.Pool.Exec(ctx, `
				INSERT INTO submissions (
					user_id, leetcode_submission_id, problem_slug, problem_title,
					language, status, content_sha256, attempt_count
				) VALUES (
					$1, $2, $3, $4, 'cpp', 'queued', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 0
				) ON CONFLICT (user_id, leetcode_submission_id) DO NOTHING;
			`, userID, id, problemSlug, problemTitle)
			if err != nil {
				errCh <- fmt.Errorf("failed to insert submission %d: %w", id, err)
				return
			}

			// Publish submission through worker
			msg := &submissions.KafkaSubmissionMessage{
				SchemaVersion: 1,
				UserID:        userID,
				SubmissionID:  strconv.FormatInt(id, 10),
				ProblemSlug:   problemSlug,
				ProblemTitle:  problemTitle,
				Language:      "cpp",
				Code:          solutionCode,
				ContentSHA256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
				SubmittedAt:   time.Now().UTC(),
				ReceivedAt:    time.Now().UTC(),
			}

			if err := worker.ProcessSubmission(ctx, msg); err != nil {
				errCh <- fmt.Errorf("worker failed on submission %d: %w", id, err)
			}
		}(subID, slug, title, code)
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Errorf("concurrent processing error: %v", err)
	}

	// Verify all submissions are published in PostgreSQL
	var publishedCount int
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM submissions WHERE user_id = $1 AND status = 'published';
	`, userID).Scan(&publishedCount)
	if err != nil {
		t.Fatalf("failed to query published count: %v", err)
	}

	if publishedCount != numConcurrent {
		t.Fatalf("expected %d published submissions, got %d", numConcurrent, publishedCount)
	}

	// Verify all files were committed in mock GitHub store
	mu.Lock()
	defer mu.Unlock()
	for i := 0; i < numConcurrent; i++ {
		expectedPath := fmt.Sprintf("problem-%d/submission-%d.cpp", i, 3000000000+i)
		if _, exists := filesStore[expectedPath]; !exists {
			t.Errorf("expected committed file missing in GitHub store: %s", expectedPath)
		}
	}
}

// TestSecurityAndCodeAbsenceInvariant strictly verifies that source code never exists
// in PostgreSQL tables or columns. (PRD: Non-negotiable #2)
func TestSecurityAndCodeAbsenceInvariant(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live database test: PostgreSQL unreachable: %v", err)
		return
	}
	defer db.Close()

	// Query information_schema for all columns in the public schema
	rows, err := db.Pool.Query(ctx, `
		SELECT table_name::text, column_name::text, data_type::text
		FROM information_schema.columns
		WHERE table_schema = 'public'
		ORDER BY table_name, column_name;
	`)
	if err != nil {
		t.Fatalf("failed to inspect database columns: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, colName, dataType string
		if err := rows.Scan(&tableName, &colName, &dataType); err != nil {
			t.Fatalf("scan error: %v", err)
		}

		lowerCol := strings.ToLower(colName)

		// Whitelist metadata columns
		if lowerCol == "content_sha256" || lowerCol == "last_error_code" {
			continue
		}

		forbiddenColumns := []string{"code", "source_code", "source", "solution", "payload", "body", "password", "cookie", "secret", "token_plain"}
		for _, forbidden := range forbiddenColumns {
			if lowerCol == forbidden || strings.HasPrefix(lowerCol, "source_") || strings.HasPrefix(lowerCol, "solution_") {
				t.Fatalf("Security Violation! Forbidden column '%s' found in table '%s' (type: %s). PRD Non-Negotiable #2: Source code must only exist in Kafka.",
					colName, tableName, dataType)
			}
		}
	}
}

// TestTokenRotationReuseBreachDetection verifies that refresh tokens rotate on use
// and an attempted reuse of an old token revokes the entire token family. (PRD: D-12)
func TestTokenRotationReuseBreachDetection(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live database test: PostgreSQL unreachable: %v", err)
		return
	}
	defer db.Close()

	userSvc := auth.NewUserService(db.Pool)
	userID, err := userSvc.UpsertGitHubUser(ctx, 44556677, 11223)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	defer func() {
		_ = userSvc.HardDelete(context.Background(), userID)
	}()

	secret := "test-secret-at-least-32-bytes-long!"
	devSvc := devices.NewService(db.Pool, secret)

	// 1. Initial pair
	pairRes, err := devSvc.Pair(ctx, userID, "Firefox Laptop", "Mozilla/5.0", "192.168.1.100")
	if err != nil {
		t.Fatalf("pairing failed: %v", err)
	}
	token1 := pairRes.RefreshToken

	// 2. First rotation (valid)
	refreshRes, err := devSvc.Refresh(ctx, pairRes.DeviceID, token1, "192.168.1.101")
	if err != nil {
		t.Fatalf("first refresh failed: %v", err)
	}
	token2 := refreshRes.RefreshToken

	// 3. Replay attack: present the consumed token1 again
	_, err = devSvc.Refresh(ctx, pairRes.DeviceID, token1, "192.168.1.102")
	if err == nil {
		t.Fatalf("expected ErrTokenReuseDetected on reuse of old refresh token, got nil")
	}
	if !strings.Contains(err.Error(), "token breach detected") && !strings.Contains(err.Error(), "token reuse detected") {
		t.Fatalf("expected token reuse breach error, got: %v", err)
	}

	// 4. Verify device is now revoked: subsequent attempts with token2 should fail
	_, err = devSvc.Refresh(ctx, pairRes.DeviceID, token2, "192.168.1.103")
	if err == nil {
		t.Fatalf("expected refresh attempt with token2 to fail after reuse breach revoked family")
	}

	err = devSvc.ValidateDeviceActive(ctx, pairRes.DeviceID)
	if err == nil {
		t.Fatalf("expected device to be inactive after reuse breach detection")
	}
}

// TestAccountHardDeletion verifies that DELETE /api/v1/me cascades and removes
// all user records, device sessions, repository mappings, and submissions. (PRD: D-22)
func TestAccountHardDeletion(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live database test: PostgreSQL unreachable: %v", err)
		return
	}
	defer db.Close()

	userSvc := auth.NewUserService(db.Pool)
	devSvc := devices.NewService(db.Pool, "test-secret-at-least-32-bytes-long!")

	// 1. Create user
	userID, err := userSvc.UpsertGitHubUser(ctx, 99887766, 66554)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// 2. Create device
	_, err = devSvc.Pair(ctx, userID, "Chrome Test", "Chrome/120", "127.0.0.1")
	if err != nil {
		t.Fatalf("failed to pair device: %v", err)
	}

	// 3. Create repository
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO repositories (user_id, github_repo_id, owner, name, default_branch, status)
		VALUES ($1, 5555, 'octodelete', 'leetcode', 'main', 'active');
	`, userID)
	if err != nil {
		t.Fatalf("failed to insert repo: %v", err)
	}

	// 4. Create submission metadata row
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO submissions (
			user_id, leetcode_submission_id, problem_slug, problem_title,
			language, status, content_sha256, attempt_count
		) VALUES (
			$1, 4000000001, 'two-sum', 'Two Sum', 'python', 'published',
			'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 1
		);
	`, userID)
	if err != nil {
		t.Fatalf("failed to insert submission: %v", err)
	}

	// 5. Execute HardDelete
	if err := userSvc.HardDelete(ctx, userID); err != nil {
		t.Fatalf("HardDelete failed: %v", err)
	}

	// 6. Verify zero records remain across all tables
	var uCount, dCount, rCount, sCount int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE id = $1", userID).Scan(&uCount)
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM devices WHERE user_id = $1", userID).Scan(&dCount)
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM repositories WHERE user_id = $1", userID).Scan(&rCount)
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM submissions WHERE user_id = $1", userID).Scan(&sCount)

	if uCount != 0 || dCount != 0 || rCount != 0 || sCount != 0 {
		t.Fatalf("HardDelete failed to cascade: remaining records: users=%d devices=%d repos=%d submissions=%d",
			uCount, dCount, rCount, sCount)
	}
}
