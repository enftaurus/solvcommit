package tests

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"leetsync/internal/auth"
	"leetsync/internal/database"
	"leetsync/internal/queue"
	"leetsync/internal/submissions"
)

func TestIngestionPipelineIntegration(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://leetsync:change-me@localhost:5432/leetsync?sslmode=disable"
	}

	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		kafkaBrokers = "localhost:9092"
	}
	kafkaTopic := os.Getenv("KAFKA_TOPIC")
	if kafkaTopic == "" {
		kafkaTopic = "submissions"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// 1. Connect to Database
	db, err := database.Connect(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live ingestion integration test: PostgreSQL unreachable: %v", err)
		return
	}
	defer db.Close()

	// 2. Connect to Kafka
	brokers := strings.Split(kafkaBrokers, ",")
	kafkaClient := queue.NewClient(brokers, kafkaTopic)
	if err := kafkaClient.Ping(ctx); err != nil {
		t.Skipf("Skipping live ingestion integration test: Kafka unreachable: %v", err)
		return
	}

	// Create test user
	userSvc := auth.NewUserService(db.Pool)
	userID, err := userSvc.UpsertGitHubUser(ctx, 99887766, 554433)
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	defer func() {
		_ = userSvc.HardDelete(context.Background(), userID)
	}()

	submissionSvc := submissions.NewService(db.Pool, kafkaClient, 1024*1024)

	// Test Case 1: Rejected / Non-accepted submission is never queued (Acceptance Criterion)
	rejectedReq := &submissions.IngestionRequest{
		SubmissionID: "99999901",
		ProblemSlug:  "two-sum",
		ProblemTitle: "Two Sum",
		Language:     "python3",
		Code:         "def twoSum(): return [0, 0]",
		Status:       "Wrong Answer",
		SubmittedAt:  time.Now(),
	}
	_, err = submissionSvc.Ingest(ctx, userID, "dev-test-1", rejectedReq)
	if err == nil || !errors.Is(err, submissions.ErrNotAccepted) {
		t.Fatalf("expected ErrNotAccepted for 'Wrong Answer', got %v", err)
	}

	// Verify no row was inserted in database for rejected submission
	var count int
	err = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM submissions WHERE user_id = $1 AND leetcode_submission_id = 99999901", userID).Scan(&count)
	if err != nil || count != 0 {
		t.Fatalf("expected 0 rows for rejected submission, got count=%d, err=%v", count, err)
	}

	// Test Case 2: Ingest Accepted Submission (Acceptance Criterion: An accepted submission is queued)
	const testSubID = "2138016677"
	acceptedReq := &submissions.IngestionRequest{
		SubmissionID: testSubID,
		ProblemSlug:  "two-sum",
		ProblemTitle: "Two Sum",
		Language:     "python3",
		Code:         "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        return [0, 1]",
		Status:       "Accepted",
		SubmittedAt:  time.Now(),
	}

	result, err := submissionSvc.Ingest(ctx, userID, "dev-test-1", acceptedReq)
	if err != nil {
		t.Fatalf("failed to ingest accepted submission: %v", err)
	}
	if result.Status != "queued" || result.SubmissionID != testSubID || result.JobID == "" {
		t.Fatalf("unexpected ingestion result: %+v", result)
	}

	// Verify thin metadata row exists in PostgreSQL with status 'queued' (D-02, D-09)
	var dbStatus, dbSlug, dbTitle, dbLang, dbSHA string
	err = db.Pool.QueryRow(ctx, `
		SELECT status, problem_slug, problem_title, language, content_sha256 
		FROM submissions 
		WHERE user_id = $1 AND leetcode_submission_id = 2138016677
	`, userID).Scan(&dbStatus, &dbSlug, &dbTitle, &dbLang, &dbSHA)
	if err != nil {
		t.Fatalf("failed to query metadata row from db: %v", err)
	}

	if dbStatus != "queued" || dbSlug != "two-sum" || dbTitle != "Two Sum" || dbLang != "python3" || dbSHA == "" {
		t.Errorf("metadata row values mismatch: status=%s slug=%s title=%s lang=%s sha=%s",
			dbStatus, dbSlug, dbTitle, dbLang, dbSHA)
	}

	// Non-Negotiable 2: Verify PostgreSQL schema contains NO column for code
	var codeColCount int
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM information_schema.columns 
		WHERE table_name = 'submissions' AND column_name IN ('code', 'source_code', 'payload')
	`).Scan(&codeColCount)
	if err != nil || codeColCount != 0 {
		t.Fatalf("VIOLATION of Non-Negotiable 2: source code column detected in PostgreSQL submissions table! count=%d", codeColCount)
	}

	// Test Case 3: Duplicate Send (Acceptance Criterion: A duplicate send creates no second record)
	dupResult, err := submissionSvc.Ingest(ctx, userID, "dev-test-1", acceptedReq)
	if err != nil {
		t.Fatalf("failed on duplicate ingest: %v", err)
	}
	if dupResult.Status != "queued" {
		t.Errorf("expected duplicate result to report current status 'queued', got '%s'", dupResult.Status)
	}

	// Verify row count is still exactly 1
	var subCount int
	err = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM submissions WHERE user_id = $1 AND leetcode_submission_id = 2138016677", userID).Scan(&subCount)
	if err != nil || subCount != 1 {
		t.Fatalf("expected exactly 1 row after duplicate send, got %d", subCount)
	}

	// Test Case 4: Backfill Discovery (Acceptance Criterion: Backfill sends only submissions backend is missing)
	requestedIDs := []string{"2138016677", "2138016678", "2138016679"}
	backfillResp, err := submissionSvc.FindMissingSubmissions(ctx, userID, requestedIDs)
	if err != nil {
		t.Fatalf("failed to query backfill: %v", err)
	}

	// Should return only 2138016678 and 2138016679 (missing)
	if len(backfillResp.MissingSubmissionIDs) != 2 {
		t.Fatalf("expected 2 missing submissions, got: %v", backfillResp.MissingSubmissionIDs)
	}
	missingSet := make(map[string]bool)
	for _, id := range backfillResp.MissingSubmissionIDs {
		missingSet[id] = true
	}
	if !missingSet["2138016678"] || !missingSet["2138016679"] || missingSet["2138016677"] {
		t.Fatalf("unexpected missing IDs set: %v", backfillResp.MissingSubmissionIDs)
	}
}
