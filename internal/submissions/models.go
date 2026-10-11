package submissions

import (
	"time"
)

// Supported language mapping (FR-GH-04, FR-ING-02)
var SupportedLanguages = map[string]string{
	"python":     "py",
	"python3":    "py",
	"golang":     "go",
	"go":         "go",
	"java":       "java",
	"cpp":        "cpp",
	"c++":        "cpp",
	"c":          "c",
	"csharp":     "cs",
	"c#":         "cs",
	"javascript": "js",
	"typescript": "ts",
	"rust":       "rs",
	"ruby":       "rb",
	"swift":      "swift",
	"kotlin":     "kt",
	"scala":      "scala",
	"php":        "php",
}

// IngestionRequest is the payload sent by the extension (FR-ING-01)
type IngestionRequest struct {
	SubmissionID string    `json:"submission_id"`
	ProblemSlug  string    `json:"problem_slug"`
	ProblemTitle string    `json:"problem_title"`
	Language     string    `json:"language"`
	Code         string    `json:"code"`
	Status       string    `json:"status"` // Strictly "Accepted"
	SubmittedAt  time.Time `json:"submitted_at"`
}

// KafkaSubmissionMessage is the payload serialized to Kafka (D-03, D-08)
// Code lives ONLY in this message and never in PostgreSQL
type KafkaSubmissionMessage struct {
	SchemaVersion int       `json:"schema_version"`
	JobID         string    `json:"job_id"`
	UserID        string    `json:"user_id"`
	DeviceID      string    `json:"device_id"`
	SubmissionID  string    `json:"submission_id"` // Transmitted as string to avoid 32-bit truncation
	ProblemSlug   string    `json:"problem_slug"`
	ProblemTitle  string    `json:"problem_title"`
	Language      string    `json:"language"`
	Code          string    `json:"code"`
	ContentSHA256 string    `json:"content_sha256"`
	SubmittedAt   time.Time `json:"submitted_at"`
	ReceivedAt    time.Time `json:"received_at"`
}

// BackfillRequest is sent by extension to discover missing submissions (FR-ING-05)
type BackfillRequest struct {
	SubmissionIDs []string `json:"submission_ids"`
}

// BackfillResponse returns the subset of IDs missing from backend
type BackfillResponse struct {
	MissingSubmissionIDs []string `json:"missing_submission_ids"`
}

// IngestionResult represents the outcome returned to the extension
type IngestionResult struct {
	Status       string `json:"status"` // "queued" or "already_queued" or "already_published"
	SubmissionID string `json:"submission_id"`
	JobID        string `json:"job_id,omitempty"`
	Message      string `json:"message,omitempty"`
}

// SubmissionRow represents thin metadata stored in PostgreSQL (D-02, D-09)
type SubmissionRow struct {
	ID                   string     `json:"id"`
	UserID               string     `json:"user_id"`
	LeetCodeSubmissionID int64      `json:"leetcode_submission_id"`
	ProblemSlug          string     `json:"problem_slug"`
	ProblemTitle         string     `json:"problem_title"`
	Language             string     `json:"language"`
	Status               string     `json:"status"`
	ContentSHA256        string     `json:"content_sha256"`
	GitHubPath           *string    `json:"github_path,omitempty"`
	CommitSHA            *string    `json:"commit_sha,omitempty"`
	AttemptCount         int        `json:"attempt_count"`
	NextAttemptAt        *time.Time `json:"next_attempt_at,omitempty"`
	LastError            *string    `json:"last_error,omitempty"`
	ReceivedAt           time.Time  `json:"received_at"`
	PublishedAt          *time.Time `json:"published_at,omitempty"`
}

// SyncStatusResponse represents aggregated pipeline counts for dashboard (FR-DASH-03, D-09)
type SyncStatusResponse struct {
	Queued     int  `json:"queued"`
	Processing int  `json:"processing"`
	Retrying   int  `json:"retrying"`
	Published  int  `json:"published"`
	Failed     int  `json:"failed"`
	Expired    int  `json:"expired"`
	Total      int  `json:"total"`
	IsPaused   bool `json:"is_paused"`
}

// SubmissionsListResponse represents paginated metadata for dashboard table
type SubmissionsListResponse struct {
	Submissions []SubmissionRow `json:"submissions"`
	Total       int             `json:"total"`
	Limit       int             `json:"limit"`
	Offset      int             `json:"offset"`
}
