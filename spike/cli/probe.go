package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// GraphQL request payload
type GraphQLRequest struct {
	Query         string                 `json:"query"`
	Variables     map[string]interface{} `json:"variables"`
	OperationName string                 `json:"operationName"`
}

type QuestionData struct {
	QuestionID string `json:"questionId"`
	TitleSlug  string `json:"titleSlug"`
	Title      string `json:"title"`
}

type LangData struct {
	Name        string `json:"name"`
	VerboseName string `json:"verboseName"`
}

type SubmissionDetails struct {
	ID            *json.RawMessage `json:"id,omitempty"`
	Runtime       string           `json:"runtime"`
	Memory        string           `json:"memory"`
	Code          string           `json:"code"`
	Timestamp     int64            `json:"timestamp"`
	StatusCode    int              `json:"statusCode"`
	StatusDisplay string           `json:"statusDisplay"`
	Lang          LangData         `json:"lang"`
	Question      QuestionData     `json:"question"`
}

type GraphQLResponse struct {
	Data struct {
		SubmissionDetails *SubmissionDetails `json:"submissionDetails"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors,omitempty"`
}

var langExtensions = map[string]string{
	"python":     "py",
	"python3":    "py",
	"golang":     "go",
	"java":       "java",
	"cpp":        "cpp",
	"c":          "c",
	"csharp":     "cs",
	"javascript": "js",
	"typescript": "ts",
	"rust":       "rs",
}

const submissionDetailsQuery = `
query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    code
    timestamp
    statusCode
    statusDisplay
    lang {
      name
      verboseName
    }
    question {
      questionId
      titleSlug
      title
    }
  }
}
`

func main() {
	sessionCookie := os.Getenv("LEETCODE_SESSION")
	csrfCookie := os.Getenv("LEETCODE_CSRF")
	subIDStr := os.Getenv("SUBMISSION_ID")

	if subIDStr == "" {
		fmt.Println("Usage: SUBMISSION_ID=2138016677 [LEETCODE_SESSION=...] [LEETCODE_CSRF=...] go run spike/cli/probe.go")
		os.Exit(1)
	}

	subID, err := strconv.ParseInt(subIDStr, 10, 64)
	if err != nil {
		fmt.Printf("Error: invalid 64-bit submission ID '%s': %v\n", subIDStr, err)
		os.Exit(1)
	}

	fmt.Println("==================================================")
	fmt.Println("LeetSync Phase 0: CLI Probe")
	fmt.Printf("Target Submission ID (int64): %d\n", subID)
	fmt.Println("==================================================")

	client := &http.Client{Timeout: 10 * time.Second}

	// Test 1: Fetch with CSRF header
	fmt.Println("\n[Test 1] Testing GraphQL fetch with x-csrftoken...")
	testFetch(client, subID, sessionCookie, csrfCookie, true)

	// Test 2: Fetch without CSRF header
	fmt.Println("\n[Test 2] Testing GraphQL fetch without x-csrftoken...")
	subDetails := testFetch(client, subID, sessionCookie, csrfCookie, false)

	// Optional GitHub Commit Test
	ghToken := os.Getenv("GITHUB_TOKEN")
	ghRepo := os.Getenv("GITHUB_REPO") // format: "owner/repo"
	if ghToken != "" && ghRepo != "" && subDetails != nil {
		fmt.Println("\n[Test 3] Testing GitHub file commit...")
		testGitHubCommit(client, ghToken, ghRepo, subID, subDetails)
	} else {
		fmt.Println("\n[Note] GITHUB_TOKEN or GITHUB_REPO not set. Skipping GitHub commit test.")
	}
}

func testFetch(client *http.Client, subID int64, session, csrf string, sendCsrfHeader bool) *SubmissionDetails {
	reqBody := GraphQLRequest{
		Query:         submissionDetailsQuery,
		Variables:     map[string]interface{}{"submissionId": subID},
		OperationName: "submissionDetails",
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", "https://leetcode.com/graphql/", bytes.NewReader(bodyBytes))
	if err != nil {
		fmt.Printf("Failed to create request: %v\n", err)
		return nil
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Referer", "https://leetcode.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// Set cookies
	var cookieParts []string
	if session != "" {
		cookieParts = append(cookieParts, fmt.Sprintf("LEETCODE_SESSION=%s", session))
	}
	if csrf != "" {
		cookieParts = append(cookieParts, fmt.Sprintf("csrftoken=%s", csrf))
	}
	if len(cookieParts) > 0 {
		req.Header.Set("Cookie", strings.Join(cookieParts, "; "))
	}

	if sendCsrfHeader && csrf != "" {
		req.Header.Set("x-csrftoken", csrf)
	}

	start := time.Now()
	resp, err := client.Do(req)
	duration := time.Since(start)

	if err != nil {
		fmt.Printf("HTTP Request failed: %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Failed to read response body: %v\n", err)
		return nil
	}

	fmt.Printf("HTTP Status: %d (%v)\n", resp.StatusCode, duration)

	var gqlResp GraphQLResponse
	if err := json.Unmarshal(respBytes, &gqlResp); err != nil {
		fmt.Printf("Failed to parse JSON response: %v\nResponse text: %s\n", err, string(respBytes))
		return nil
	}

	if len(gqlResp.Errors) > 0 {
		fmt.Println("GraphQL Errors returned:")
		for _, e := range gqlResp.Errors {
			fmt.Printf("  - %s\n", e.Message)
		}
		return nil
	}

	details := gqlResp.Data.SubmissionDetails
	if details == nil {
		fmt.Println("No submissionDetails returned (null data).")
		return nil
	}

	fmt.Printf("  Status:        %s (Code %d)\n", details.StatusDisplay, details.StatusCode)
	fmt.Printf("  Language:      %s (%s)\n", details.Lang.Name, details.Lang.VerboseName)
	fmt.Printf("  Problem Title: %s\n", details.Question.Title)
	fmt.Printf("  Problem Slug:  %s\n", details.Question.TitleSlug)
	fmt.Printf("  Code Length:   %d bytes\n", len(details.Code))
	if len(details.Code) > 0 {
		lines := strings.Split(details.Code, "\n")
		previewLines := 5
		if len(lines) < previewLines {
			previewLines = len(lines)
		}
		fmt.Println("  Code Preview:")
		for i := 0; i < previewLines; i++ {
			fmt.Printf("    | %s\n", lines[i])
		}
	}
	return details
}

func testGitHubCommit(client *http.Client, token, repo string, subID int64, details *SubmissionDetails) {
	ext := "txt"
	if mapped, ok := langExtensions[strings.ToLower(details.Lang.Name)]; ok {
		ext = mapped
	}

	slug := details.Question.TitleSlug
	if slug == "" {
		slug = "unknown-problem"
	}

	filePath := fmt.Sprintf("%s/submission-%d.%s", slug, subID, ext)
	commitMsg := fmt.Sprintf("feat: sync accepted %s submission (%d)", details.Question.Title, subID)
	contentB64 := base64.StdEncoding.EncodeToString([]byte(details.Code))

	url := fmt.Sprintf("https://api.github.com/repos/%s/contents/%s", repo, filePath)

	// Check if file exists to fetch sha if needed
	var sha string
	checkReq, _ := http.NewRequest("GET", url, nil)
	checkReq.Header.Set("Authorization", "Bearer "+token)
	checkReq.Header.Set("Accept", "application/vnd.github+json")
	if checkResp, err := client.Do(checkReq); err == nil && checkResp.StatusCode == 200 {
		var existing map[string]interface{}
		_ = json.NewDecoder(checkResp.Body).Decode(&existing)
		if s, ok := existing["sha"].(string); ok {
			sha = s
		}
		checkResp.Body.Close()
	}

	putPayload := map[string]string{
		"message": commitMsg,
		"content": contentB64,
	}
	if sha != "" {
		putPayload["sha"] = sha
	}

	putBytes, _ := json.Marshal(putPayload)
	putReq, _ := http.NewRequest("PUT", url, bytes.NewReader(putBytes))
	putReq.Header.Set("Authorization", "Bearer "+token)
	putReq.Header.Set("Accept", "application/vnd.github+json")
	putReq.Header.Set("Content-Type", "application/json")

	putResp, err := client.Do(putReq)
	if err != nil {
		fmt.Printf("GitHub commit failed: %v\n", err)
		return
	}
	defer putResp.Body.Close()

	fmt.Printf("GitHub Commit Status: %d\n", putResp.StatusCode)
	fmt.Printf("Target Path: %s\n", filePath)
}
