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

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
