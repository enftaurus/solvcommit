package submissions

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var (
	ErrNotAccepted         = errors.New("submission is not accepted; only accepted submissions can be ingested")
	ErrUnsupportedLanguage = errors.New("unsupported programming language")
	ErrPayloadTooLarge     = errors.New("source code exceeds maximum allowed size")
	ErrInvalidSubmissionID = errors.New("invalid submission id")
	ErrMissingProblemInfo  = errors.New("missing problem slug or title")
	ErrEmptyCode           = errors.New("source code cannot be empty")
)

var slugRegex = regexp.MustCompile(`^[a-z0-9-]+$`)

// ValidatedSubmission represents a thoroughly validated ingestion request
type ValidatedSubmission struct {
	SubmissionID int64
	ProblemSlug  string
	ProblemTitle string
	Language     string
	FileExt      string
	Code         string
	Status       string
}

// ValidateIngestion validates incoming submission request (FR-ING-02, D-10, D-24)
func ValidateIngestion(req *IngestionRequest, maxCodeBytes int64) (*ValidatedSubmission, error) {
	if req == nil {
		return nil, errors.New("nil request body")
	}

	// 1. Validate Status: strictly "Accepted" (D-10)
	cleanStatus := strings.TrimSpace(req.Status)
	if !strings.EqualFold(cleanStatus, "Accepted") {
		return nil, fmt.Errorf("%w: received '%s'", ErrNotAccepted, req.Status)
	}

	// 2. Validate 64-bit Submission ID (D-24)
	subID, err := strconv.ParseInt(strings.TrimSpace(req.SubmissionID), 10, 64)
	if err != nil || subID <= 0 {
		return nil, fmt.Errorf("%w: '%s'", ErrInvalidSubmissionID, req.SubmissionID)
	}

	// 3. Validate Problem Info
	slug := strings.ToLower(strings.TrimSpace(req.ProblemSlug))
	if slug == "" || !slugRegex.MatchString(slug) {
		return nil, fmt.Errorf("%w: invalid problem slug '%s'", ErrMissingProblemInfo, req.ProblemSlug)
	}
	title := strings.TrimSpace(req.ProblemTitle)
	if title == "" {
		return nil, fmt.Errorf("%w: title cannot be empty", ErrMissingProblemInfo)
	}

	// 4. Validate Language (FR-GH-04)
	lang := strings.ToLower(strings.TrimSpace(req.Language))
	ext, ok := SupportedLanguages[lang]
	if !ok {
		return nil, fmt.Errorf("%w: '%s'", ErrUnsupportedLanguage, req.Language)
	}

	// 5. Validate Code & Size Limit (FR-ING-02)
	code := req.Code
	if strings.TrimSpace(code) == "" {
		return nil, ErrEmptyCode
	}
	codeBytes := int64(len([]byte(code)))
	if maxCodeBytes > 0 && codeBytes > maxCodeBytes {
		return nil, fmt.Errorf("%w: size %d bytes exceeds limit of %d bytes", ErrPayloadTooLarge, codeBytes, maxCodeBytes)
	}

	return &ValidatedSubmission{
		SubmissionID: subID,
		ProblemSlug:  slug,
		ProblemTitle: title,
		Language:     lang,
		FileExt:      ext,
		Code:         code,
		Status:       "Accepted",
	}, nil
}
