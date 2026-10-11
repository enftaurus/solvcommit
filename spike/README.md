# Phase 0: Capture Spike Guide & Findings

> Technical probe validating in-session LeetCode submission capture and GitHub publishing.
> Last updated: Phase 0 (Capture Spike)

## Objectives Tested
1. **In-Session Capture**: Verify that a Chrome extension content script on `leetcode.com` can execute `fetch('/graphql/', { method: 'POST', credentials: 'include', ... })` and retrieve full submission source code and metadata without holding session credentials on a server.
2. **CSRF Token Header**: Test whether `x-csrftoken` (from the `csrftoken` cookie) is mandatory or optional for GraphQL `POST` requests.
3. **Question Details**: Confirm the presence of problem title and slug via `question { questionId titleSlug title }` on `submissionDetails`.
4. **64-bit ID Support**: Verify handling of large submission IDs approaching/exceeding signed 32-bit integer limits (`2,147,483,647`).
5. **Direct GitHub Commit Feasibility**: Validate committing the captured file directly to a target GitHub repository path: `{titleSlug}/submission-{submissionId}.{ext}`.

---

## 1. Real Path: Chrome Extension In-Session Spike

The extension in [`spike/extension/`](file:///home/rajababu/intern/leetsync/spike/extension/) runs directly inside the user's browser:

### How to Run
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in upper right corner).
3. Click **Load unpacked** and select the [`spike/extension/`](file:///home/rajababu/intern/leetsync/spike/extension/) directory.
4. Log into `https://leetcode.com` and open any problem (e.g. `https://leetcode.com/problems/two-sum/`).
5. A floating **LeetSync Spike Probe** widget will appear at the bottom right.
6. Enter an accepted submission ID (or solve/submit a problem to let the observer auto-detect it).
7. Test the two in-session paths:
   - Click **Fetch (with CSRF)**: Sends request with `x-csrftoken` header read from `document.cookie`.
   - Click **Fetch (no CSRF)**: Sends request with standard cookies attached (`credentials: 'include'`) without custom CSRF header.
8. (Optional) Enter your GitHub username, test repository, and a Personal Access Token to test committing the captured code to GitHub.

---

## 2. CLI Probe Tool

A CLI probe is located in [`spike/cli/probe.go`](file:///home/rajababu/intern/leetsync/spike/cli/probe.go) to test the exact GraphQL query against LeetCode outside the browser:

```bash
# Safe testing with environment variables (never committed)
SUBMISSION_ID=2138016677 \
LEETCODE_SESSION="<your_cookie>" \
LEETCODE_CSRF="<your_csrf>" \
go run spike/cli/probe.go
```

---

## 3. Findings & Schema Specification

### The GraphQL Query
```graphql
query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    runtime
    runtimeDisplay
    memory
    memoryDisplay
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
```

### Behavior Matrix
- **`credentials: 'include'`**: When invoked from `content.js` on `https://leetcode.com`, the browser automatically includes `LEETCODE_SESSION` and `csrftoken` cookies.
- **`x-csrftoken` Header**: LeetCode's backend rejects `POST` requests without the `x-csrftoken` header (HTTP 403 CSRF Failed) when session cookies are present. The extension reads `csrftoken` from `document.cookie` and passes it in the header.
- **`question` Field**: `question { titleSlug title questionId }` is confirmed present on `submissionDetails`. This provides the problem slug for directory creation without requiring a secondary API lookup.
- **64-bit IDs**: IDs must be stored as `BIGINT` in PostgreSQL, `int64` in Go, and serialized as strings in JSON/Kafka to avoid JavaScript/GraphQL integer precision truncation.

---

## 4. Terms of Service & Security Evaluation
- **Zero Custody**: Backend server never touches or stores `LEETCODE_SESSION`.
- **Browser-Initiated**: Requests are issued strictly by the user's browser for their own past submissions.
- **No Scraping**: No automated server crawlers or bulk scraping against LeetCode infrastructure.
