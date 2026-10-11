package publisher

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"leetsync/internal/github"
	"leetsync/internal/submissions"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/segmentio/kafka-go"
)

type Worker struct {
	pool      *pgxpool.Pool
	github    github.Client
	logger    *slog.Logger
	repoLocks sync.Map // map[string]*sync.Mutex for per-repo serialization (D-11, FR-GH-06)
}

func NewWorker(pool *pgxpool.Pool, gh github.Client, logger *slog.Logger) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	return &Worker{
		pool:   pool,
		github: gh,
		logger: logger,
	}
}

func (w *Worker) getRepoMutex(owner, repo string) *sync.Mutex {
	key := fmt.Sprintf("%s/%s", strings.ToLower(owner), strings.ToLower(repo))
	val, _ := w.repoLocks.LoadOrStore(key, &sync.Mutex{})
	return val.(*sync.Mutex)
}

// ProcessSubmission handles a single Kafka submission message (D-08, D-11, FR-HIST-01 to 04)
func (w *Worker) ProcessSubmission(ctx context.Context, msg *submissions.KafkaSubmissionMessage) error {
	if msg == nil || msg.UserID == "" || msg.SubmissionID == "" {
		return errors.New("invalid nil or empty submission message")
	}

	subIDInt, err := strconv.ParseInt(msg.SubmissionID, 10, 64)
	if err != nil || subIDInt <= 0 {
		return fmt.Errorf("invalid submission id '%s'", msg.SubmissionID)
	}

	// 1. Ensure submissions row exists in PostgreSQL (D-08: consumer creates row if missing)
	var currentStatus string
	queryStatus := `SELECT status FROM submissions WHERE user_id = $1 AND leetcode_submission_id = $2;`
	err = w.pool.QueryRow(ctx, queryStatus, msg.UserID, subIDInt).Scan(&currentStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		// Create row with queued
		insertSQL := `
			INSERT INTO submissions (
				user_id, leetcode_submission_id, problem_slug, problem_title,
				language, status, content_sha256, attempt_count, received_at
			) VALUES ($1, $2, $3, $4, $5, 'processing', $6, 0, $7)
			ON CONFLICT (user_id, leetcode_submission_id) DO NOTHING;
		`
		_, _ = w.pool.Exec(ctx, insertSQL,
			msg.UserID, subIDInt, msg.ProblemSlug, msg.ProblemTitle,
			msg.Language, msg.ContentSHA256, msg.ReceivedAt,
		)
	} else if err == nil {
		if currentStatus == "published" {
			// FR-HIST-02: Idempotent reprocessing; already published
			w.logger.Info("Submission already published; skipping", "user_id", msg.UserID, "submission_id", msg.SubmissionID)
			return nil
		}
		// Update status to processing
		_, _ = w.pool.Exec(ctx, `UPDATE submissions SET status = 'processing' WHERE user_id = $1 AND leetcode_submission_id = $2;`, msg.UserID, subIDInt)
	} else {
		return fmt.Errorf("failed to check submission status: %w", err)
	}

	// 2. Fetch user's active repository and installation ID
	var repoOwner, repoName, defaultBranch string
	var instID int64

	repoQuery := `
		SELECT r.owner, r.name, r.default_branch, c.installation_id
		FROM repositories r
		JOIN github_connections c ON r.user_id = c.user_id
		WHERE r.user_id = $1 AND r.status = 'active' AND c.status = 'connected'
		LIMIT 1;
	`
	err = w.pool.QueryRow(ctx, repoQuery, msg.UserID).Scan(&repoOwner, &repoName, &defaultBranch, &instID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			w.logger.Warn("No active repository or GitHub connection for user", "user_id", msg.UserID)
			_, _ = w.pool.Exec(ctx, `
				UPDATE submissions 
				SET status = 'failed', last_error_code = 'NO_ACTIVE_REPO' 
				WHERE user_id = $1 AND leetcode_submission_id = $2;
			`, msg.UserID, subIDInt)
			return nil // Acknowledge message since user must configure repo
		}
		return fmt.Errorf("failed to load repository config: %w", err)
	}

	// 3. Derive destination path: <problem-slug>/submission-<id>.<ext> (D-11, FR-GH-04)
	ext, ok := submissions.SupportedLanguages[strings.ToLower(msg.Language)]
	if !ok {
		ext = "txt"
	}
	targetPath := fmt.Sprintf("%s/submission-%s.%s", msg.ProblemSlug, msg.SubmissionID, ext)

	// 4. Serialize commits per repository (D-11, FR-GH-06)
	repoMu := w.getRepoMutex(repoOwner, repoName)
	repoMu.Lock()
	defer repoMu.Unlock()

	// 5. Check if file already exists at target path (FR-HIST-03, FR-HIST-04, D-14)
	existingFile, err := w.github.GetFile(ctx, instID, repoOwner, repoName, targetPath)
	if err == nil && existingFile != nil {
		// File already exists at this path
		existingHash := sha256Hex(existingFile.Content)
		incomingHash := sha256Hex(msg.Code)

		if existingHash == incomingHash {
			// Subcase A: Ambiguous write recovery (FR-HIST-03)
			// File matches exactly; mark as published without committing again
			w.logger.Info("Target path already holds this submission; recovering published state", "path", targetPath)
			return w.recordSuccess(ctx, msg.UserID, subIDInt, targetPath, existingFile.SHA)
		}

		// Subcase B: Visible Conflict (FR-HIST-04, D-14)
		// Different content exists at path: STOP and record conflict, never overwrite
		w.logger.Warn("Conflicting file already exists at target path; aborting overwrite", "path", targetPath)
		_, _ = w.pool.Exec(ctx, `
			UPDATE submissions 
			SET status = 'failed', last_error_code = 'PATH_CONFLICT' 
			WHERE user_id = $1 AND leetcode_submission_id = $2;
		`, msg.UserID, subIDInt)
		return nil
	} else if err != nil && !errors.Is(err, github.ErrFileNotFound) {
		// Transient or GitHub API error checking path
		return w.handleTransientError(ctx, msg.UserID, subIDInt, err)
	}

	// 6. Write file to GitHub repository (FR-GH-04, FR-GH-05, D-11)
	commitMsg := fmt.Sprintf("feat: sync accepted %s submission (%s)", msg.ProblemTitle, msg.SubmissionID)
	commitRes, err := w.github.PutFile(ctx, instID, repoOwner, repoName, targetPath, msg.Code, commitMsg, defaultBranch)
	if err != nil {
		return w.handleTransientError(ctx, msg.UserID, subIDInt, err)
	}

	// 7. Update status to 'published' (D-09)
	return w.recordSuccess(ctx, msg.UserID, subIDInt, targetPath, commitRes.CommitSHA)
}

func (w *Worker) recordSuccess(ctx context.Context, userID string, subID int64, path, commitSHA string) error {
	if len(commitSHA) > 40 {
		commitSHA = commitSHA[:40]
	}
	query := `
		UPDATE submissions
		SET status = 'published',
		    github_path = $3,
		    commit_sha = $4,
		    published_at = NOW()
		WHERE user_id = $1 AND leetcode_submission_id = $2;
	`
	_, err := w.pool.Exec(ctx, query, userID, subID, path, commitSHA)
	if err != nil {
		return fmt.Errorf("failed to record published status in database: %w", err)
	}
	w.logger.Info("Submission published successfully", "user_id", userID, "submission_id", subID, "commit_sha", commitSHA)
	return nil
}

func (w *Worker) handleTransientError(ctx context.Context, userID string, subID int64, err error) error {
	w.logger.Error("GitHub publishing error", "user_id", userID, "submission_id", subID, "error", err)

	// Increment attempt count and mark retrying
	query := `
		UPDATE submissions
		SET attempt_count = attempt_count + 1,
		    status = 'retrying',
		    next_attempt_at = NOW() + INTERVAL '30 seconds',
		    last_error_code = 'TRANSIENT_ERROR'
		WHERE user_id = $1 AND leetcode_submission_id = $2;
	`
	_, _ = w.pool.Exec(ctx, query, userID, subID)
	return err
}

// RunConsumer runs the Kafka consumer loop until context is canceled
func (w *Worker) RunConsumer(ctx context.Context, reader *kafka.Reader) error {
	w.logger.Info("Starting Kafka consumer loop for submissions")
	for {
		select {
		case <-ctx.Done():
			w.logger.Info("Consumer context canceled, stopping worker loop")
			return nil
		default:
		}

		m, err := reader.FetchMessage(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return nil
			}
			w.logger.Error("Failed to fetch message from Kafka", "error", err)
			time.Sleep(1 * time.Second)
			continue
		}

		var subMsg submissions.KafkaSubmissionMessage
		if err := json.Unmarshal(m.Value, &subMsg); err != nil {
			w.logger.Error("Failed to parse Kafka submission message; skipping unparseable message", "error", err)
			_ = reader.CommitMessages(ctx, m)
			continue
		}

		// Process submission
		if err := w.ProcessSubmission(ctx, &subMsg); err != nil {
			w.logger.Warn("Submission processing encountered transient error, will retry message", "error", err)
			// Sleep briefly before retrying to avoid hot-looping on Kafka broker
			time.Sleep(2 * time.Second)
			continue
		}

		// Commit Kafka offset upon successful processing
		if err := reader.CommitMessages(ctx, m); err != nil {
			w.logger.Error("Failed to commit Kafka offset", "error", err)
		}
	}
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
