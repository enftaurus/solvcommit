package submissions

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"leetsync/internal/auth"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// KafkaProducer defines the interface to produce submissions to Kafka (D-03, D-08)
type KafkaProducer interface {
	ProduceSubmission(ctx context.Context, msg *KafkaSubmissionMessage) error
}

type Service struct {
	pool         *pgxpool.Pool
	producer     KafkaProducer
	maxCodeBytes int64
}

func NewService(pool *pgxpool.Pool, producer KafkaProducer, maxCodeBytes int64) *Service {
	return &Service{
		pool:         pool,
		producer:     producer,
		maxCodeBytes: maxCodeBytes,
	}
}

// Ingest handles validation, idempotency check, Kafka produce, and metadata row insertion
// Fulfills FR-ING-01, FR-ING-02, FR-ING-03, FR-ING-04, D-02, D-08, D-10
func (s *Service) Ingest(ctx context.Context, userID, deviceID string, req *IngestionRequest) (*IngestionResult, error) {
	// 1. Validate submission payload (FR-ING-02, D-10)
	val, err := ValidateIngestion(req, s.maxCodeBytes)
	if err != nil {
		return nil, err
	}

	// 2. Check Deduplication in PostgreSQL (FR-ING-03, D-08)
	var existingStatus string
	queryExisting := `SELECT status FROM submissions WHERE user_id = $1 AND leetcode_submission_id = $2;`
	err = s.pool.QueryRow(ctx, queryExisting, userID, val.SubmissionID).Scan(&existingStatus)
	if err == nil {
		// Submission already known
		if existingStatus == "queued" || existingStatus == "processing" || existingStatus == "published" {
			// Idempotent duplicate: return existing status without enqueuing again (FR-ING-03)
			return &IngestionResult{
				Status:       existingStatus,
				SubmissionID: req.SubmissionID,
				Message:      fmt.Sprintf("duplicate send: submission is already %s", existingStatus),
			}, nil
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("database check failed: %w", err)
	}

	// 3. Compute Content Fingerprint (SHA-256)
	contentHash := sha256Hex(val.Code)

	// 4. Generate Job ID
	jobID, err := auth.GenerateRandomString(16)
	if err != nil {
		jobID = fmt.Sprintf("job-%d", time.Now().UnixNano())
	}

	now := time.Now().UTC()
	subTime := req.SubmittedAt
	if subTime.IsZero() {
		subTime = now
	}

	// 5. Produce to Kafka with acks=all (D-08, FR-ING-04)
	kafkaMsg := &KafkaSubmissionMessage{
		SchemaVersion: 1,
		JobID:         jobID,
		UserID:        userID,
		DeviceID:      deviceID,
		SubmissionID:  strconv.FormatInt(val.SubmissionID, 10),
		ProblemSlug:   val.ProblemSlug,
		ProblemTitle:  val.ProblemTitle,
		Language:      val.Language,
		Code:          val.Code, // Source code is ONLY transmitted in Kafka (D-02, D-03)
		ContentSHA256: contentHash,
		SubmittedAt:   subTime,
		ReceivedAt:    now,
	}

	if s.producer != nil {
		if err := s.producer.ProduceSubmission(ctx, kafkaMsg); err != nil {
			// FR-ING-04: If Kafka is unavailable, return error so the extension keeps it and retries
			return nil, fmt.Errorf("failed to produce to kafka (acks=all): %w", err)
		}
	}

	// 6. Record metadata row in PostgreSQL (D-02, D-09)
	// Notice: Source code is strictly omitted from PostgreSQL
	insertSQL := `
		INSERT INTO submissions (
			user_id, leetcode_submission_id, problem_slug, problem_title,
			language, status, content_sha256, attempt_count, received_at
		) VALUES ($1, $2, $3, $4, $5, 'queued', $6, 0, $7)
		ON CONFLICT (user_id, leetcode_submission_id) 
		DO UPDATE SET status = 'queued', received_at = EXCLUDED.received_at;
	`
	_, err = s.pool.Exec(ctx, insertSQL,
		userID, val.SubmissionID, val.ProblemSlug, val.ProblemTitle,
		val.Language, contentHash, now,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert metadata row: %w", err)
	}

	return &IngestionResult{
		Status:       "queued",
		SubmissionID: req.SubmissionID,
		JobID:        jobID,
		Message:      "submission successfully queued for publishing",
	}, nil
}

// FindMissingSubmissions determines which IDs sent by the extension are missing in the backend (FR-ING-05)
func (s *Service) FindMissingSubmissions(ctx context.Context, userID string, requestedIDs []string) (*BackfillResponse, error) {
	if len(requestedIDs) == 0 {
		return &BackfillResponse{MissingSubmissionIDs: []string{}}, nil
	}

	// Parse valid 64-bit integer IDs
	var intIDs []int64
	parsedMap := make(map[int64]string)
	for _, idStr := range requestedIDs {
		clean := strings.TrimSpace(idStr)
		if id, err := strconv.ParseInt(clean, 10, 64); err == nil && id > 0 {
			intIDs = append(intIDs, id)
			parsedMap[id] = clean
		}
	}

	if len(intIDs) == 0 {
		return &BackfillResponse{MissingSubmissionIDs: []string{}}, nil
	}

	// Query existing IDs in database
	query := `
		SELECT leetcode_submission_id 
		FROM submissions 
		WHERE user_id = $1 AND leetcode_submission_id = ANY($2);
	`
	rows, err := s.pool.Query(ctx, query, userID, intIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query existing submissions: %w", err)
	}
	defer rows.Close()

	foundSet := make(map[int64]bool)
	for rows.Next() {
		var foundID int64
		if err := rows.Scan(&foundID); err == nil {
			foundSet[foundID] = true
		}
	}

	// Build missing list
	var missing []string
	for _, id := range intIDs {
		if !foundSet[id] {
			missing = append(missing, parsedMap[id])
		}
	}

	if missing == nil {
		missing = []string{}
	}

	return &BackfillResponse{MissingSubmissionIDs: missing}, nil
}

// GetSyncStatus retrieves aggregated pipeline counts (FR-DASH-03, D-09)
func (s *Service) GetSyncStatus(ctx context.Context, userID string) (*SyncStatusResponse, error) {
	queryCounts := `
		SELECT status, COUNT(*)
		FROM submissions
		WHERE user_id = $1
		GROUP BY status;
	`
	rows, err := s.pool.Query(ctx, queryCounts, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query sync counts: %w", err)
	}
	defer rows.Close()

	res := &SyncStatusResponse{}
	for rows.Next() {
		var st string
		var cnt int
		if err := rows.Scan(&st, &cnt); err == nil {
			switch st {
			case "queued":
				res.Queued = cnt
			case "processing":
				res.Processing = cnt
			case "retrying":
				res.Retrying = cnt
			case "published":
				res.Published = cnt
			case "failed":
				res.Failed = cnt
			case "expired":
				res.Expired = cnt
			}
			res.Total += cnt
		}
	}

	// Check pause state
	var userStatus string
	_ = s.pool.QueryRow(ctx, "SELECT status FROM users WHERE id = $1;", userID).Scan(&userStatus)
	res.IsPaused = (userStatus == "paused")

	return res, nil
}

// ListSubmissions returns a paginated list of submission metadata for dashboard
func (s *Service) ListSubmissions(ctx context.Context, userID string, limit, offset int) (*SubmissionsListResponse, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	err := s.pool.QueryRow(ctx, "SELECT COUNT(*) FROM submissions WHERE user_id = $1;", userID).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count submissions: %w", err)
	}

	query := `
		SELECT id, user_id, leetcode_submission_id, problem_slug, problem_title,
		       language, status, content_sha256, github_path, commit_sha,
		       attempt_count, next_attempt_at, last_error_code, received_at, published_at
		FROM submissions
		WHERE user_id = $1
		ORDER BY received_at DESC
		LIMIT $2 OFFSET $3;
	`
	rows, err := s.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list submissions: %w", err)
	}
	defer rows.Close()

	var list []SubmissionRow
	for rows.Next() {
		var r SubmissionRow
		err := rows.Scan(
			&r.ID, &r.UserID, &r.LeetCodeSubmissionID, &r.ProblemSlug, &r.ProblemTitle,
			&r.Language, &r.Status, &r.ContentSHA256, &r.GitHubPath, &r.CommitSHA,
			&r.AttemptCount, &r.NextAttemptAt, &r.LastError, &r.ReceivedAt, &r.PublishedAt,
		)
		if err == nil {
			list = append(list, r)
		}
	}
	if list == nil {
		list = []SubmissionRow{}
	}

	return &SubmissionsListResponse{
		Submissions: list,
		Total:       total,
		Limit:       limit,
		Offset:      offset,
	}, nil
}

// RetrySubmission re-queues a failed or expired submission for retry (FR-DASH-02, D-07)
func (s *Service) RetrySubmission(ctx context.Context, userID, subID string) error {
	query := `
		UPDATE submissions
		SET status = 'queued', attempt_count = 0, next_attempt_at = NULL, last_error_code = NULL
		WHERE user_id = $1 AND (id::text = $2 OR leetcode_submission_id::text = $2) AND status IN ('failed', 'expired', 'retrying');
	`
	cmd, err := s.pool.Exec(ctx, query, userID, subID)
	if err != nil {
		return fmt.Errorf("failed to retry submission: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("submission not found or not in retryable state")
	}
	return nil
}

// PauseSync pauses syncing for the user (FR-DASH-01)
func (s *Service) PauseSync(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, "UPDATE users SET status = 'paused', updated_at = NOW() WHERE id = $1;", userID)
	return err
}

// ResumeSync resumes syncing for the user (FR-DASH-01)
func (s *Service) ResumeSync(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx, "UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1;", userID)
	return err
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
