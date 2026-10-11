package submissions_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"leetsync/internal/submissions"
)

func TestValidateIngestion_Success(t *testing.T) {
	req := &submissions.IngestionRequest{
		SubmissionID: "2138016677",
		ProblemSlug:  "two-sum",
		ProblemTitle: "Two Sum",
		Language:     "python3",
		Code:         "def twoSum(nums, target): return []",
		Status:       "Accepted",
		SubmittedAt:  time.Now(),
	}

	val, err := submissions.ValidateIngestion(req, 1024*1024)
	if err != nil {
		t.Fatalf("expected validation success, got error: %v", err)
	}

	if val.SubmissionID != 2138016677 {
		t.Errorf("expected SubmissionID 2138016677, got %d", val.SubmissionID)
	}
	if val.ProblemSlug != "two-sum" {
		t.Errorf("expected ProblemSlug 'two-sum', got '%s'", val.ProblemSlug)
	}
	if val.ProblemTitle != "Two Sum" {
		t.Errorf("expected ProblemTitle 'Two Sum', got '%s'", val.ProblemTitle)
	}
	if val.Language != "python3" {
		t.Errorf("expected Language 'python3', got '%s'", val.Language)
	}
	if val.FileExt != "py" {
		t.Errorf("expected FileExt 'py', got '%s'", val.FileExt)
	}
	if val.Code != req.Code {
		t.Errorf("code mismatch")
	}
	if val.Status != "Accepted" {
		t.Errorf("expected Status 'Accepted', got '%s'", val.Status)
	}
}

func TestValidateIngestion_StatusNotAccepted(t *testing.T) {
	invalidStatuses := []string{
		"Wrong Answer",
		"Runtime Error",
		"Time Limit Exceeded",
		"Memory Limit Exceeded",
		"Compile Error",
		"Output Limit Exceeded",
		"",
	}

	for _, status := range invalidStatuses {
		t.Run("Status_"+status, func(t *testing.T) {
			req := &submissions.IngestionRequest{
				SubmissionID: "12345",
				ProblemSlug:  "two-sum",
				ProblemTitle: "Two Sum",
				Language:     "python3",
				Code:         "print(1)",
				Status:       status,
			}
			_, err := submissions.ValidateIngestion(req, 1024*1024)
			if err == nil || !errors.Is(err, submissions.ErrNotAccepted) {
				t.Fatalf("expected ErrNotAccepted for status '%s', got %v", status, err)
			}
		})
	}
}

func TestValidateIngestion_InvalidSubmissionID(t *testing.T) {
	testIDs := []string{
		"",
		"not-a-number",
		"-1",
		"0",
		"9223372036854775808", // exceeds max int64
	}

	for _, id := range testIDs {
		t.Run("ID_"+id, func(t *testing.T) {
			req := &submissions.IngestionRequest{
				SubmissionID: id,
				ProblemSlug:  "two-sum",
				ProblemTitle: "Two Sum",
				Language:     "python3",
				Code:         "print(1)",
				Status:       "Accepted",
			}
			_, err := submissions.ValidateIngestion(req, 1024*1024)
			if err == nil || !errors.Is(err, submissions.ErrInvalidSubmissionID) {
				t.Fatalf("expected ErrInvalidSubmissionID for '%s', got %v", id, err)
			}
		})
	}
}

func TestValidateIngestion_ProblemInfoValidation(t *testing.T) {
	tests := []struct {
		name  string
		slug  string
		title string
	}{
		{"empty slug", "", "Two Sum"},
		{"slug with spaces", "two sum", "Two Sum"},
		{"slug with invalid chars", "two_sum!", "Two Sum"},
		{"empty title", "two-sum", ""},
		{"whitespace title", "two-sum", "   "},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := &submissions.IngestionRequest{
				SubmissionID: "12345",
				ProblemSlug:  tc.slug,
				ProblemTitle: tc.title,
				Language:     "python3",
				Code:         "print(1)",
				Status:       "Accepted",
			}
			_, err := submissions.ValidateIngestion(req, 1024*1024)
			if err == nil || !errors.Is(err, submissions.ErrMissingProblemInfo) {
				t.Fatalf("expected ErrMissingProblemInfo, got %v", err)
			}
		})
	}
}

func TestValidateIngestion_Languages(t *testing.T) {
	validLanguages := map[string]string{
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

	for lang, expectedExt := range validLanguages {
		t.Run("Lang_"+lang, func(t *testing.T) {
			req := &submissions.IngestionRequest{
				SubmissionID: "12345",
				ProblemSlug:  "two-sum",
				ProblemTitle: "Two Sum",
				Language:     lang,
				Code:         "code",
				Status:       "Accepted",
			}
			val, err := submissions.ValidateIngestion(req, 1024*1024)
			if err != nil {
				t.Fatalf("expected supported language '%s', got err: %v", lang, err)
			}
			if val.FileExt != expectedExt {
				t.Errorf("expected ext '%s' for '%s', got '%s'", expectedExt, lang, val.FileExt)
			}
		})
	}

	// Unsupported language
	req := &submissions.IngestionRequest{
		SubmissionID: "12345",
		ProblemSlug:  "two-sum",
		ProblemTitle: "Two Sum",
		Language:     "fortran",
		Code:         "code",
		Status:       "Accepted",
	}
	_, err := submissions.ValidateIngestion(req, 1024*1024)
	if err == nil || !errors.Is(err, submissions.ErrUnsupportedLanguage) {
		t.Fatalf("expected ErrUnsupportedLanguage, got %v", err)
	}
}

func TestValidateIngestion_CodeAndPayloadSize(t *testing.T) {
	// Empty code
	reqEmpty := &submissions.IngestionRequest{
		SubmissionID: "12345",
		ProblemSlug:  "two-sum",
		ProblemTitle: "Two Sum",
		Language:     "python3",
		Code:         "   ",
		Status:       "Accepted",
	}
	_, err := submissions.ValidateIngestion(reqEmpty, 1024)
	if err == nil || !errors.Is(err, submissions.ErrEmptyCode) {
		t.Fatalf("expected ErrEmptyCode, got %v", err)
	}

	// Code exceeds size limit
	bigCode := strings.Repeat("a", 2048)
	reqBig := &submissions.IngestionRequest{
		SubmissionID: "12345",
		ProblemSlug:  "two-sum",
		ProblemTitle: "Two Sum",
		Language:     "python3",
		Code:         bigCode,
		Status:       "Accepted",
	}
	_, err = submissions.ValidateIngestion(reqBig, 1024)
	if err == nil || !errors.Is(err, submissions.ErrPayloadTooLarge) {
		t.Fatalf("expected ErrPayloadTooLarge, got %v", err)
	}
}
