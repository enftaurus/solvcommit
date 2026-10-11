package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"leetsync/internal/api"
	"leetsync/internal/auth"
	"leetsync/internal/devices"
	"leetsync/internal/github"
	"leetsync/internal/repositories"
	"leetsync/internal/submissions"
)

type mockPinger struct {
	err error
}

func (m *mockPinger) Ping(ctx context.Context) error {
	return m.err
}

type mockUserManager struct {
	upsertFunc func(ctx context.Context, ghID, instID int64) (string, error)
	getFunc    func(ctx context.Context, userID string) (*auth.UserProfile, error)
	deleteFunc func(ctx context.Context, userID string) error
}

func (m *mockUserManager) UpsertGitHubUser(ctx context.Context, ghID, instID int64) (string, error) {
	if m.upsertFunc != nil {
		return m.upsertFunc(ctx, ghID, instID)
	}
	return "user-mock-123", nil
}

func (m *mockUserManager) GetProfile(ctx context.Context, userID string) (*auth.UserProfile, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, userID)
	}
	return &auth.UserProfile{ID: userID, Status: "active", GitHubUserID: 99999}, nil
}

func (m *mockUserManager) HardDelete(ctx context.Context, userID string) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, userID)
	}
	return nil
}

type mockDeviceManager struct {
	pairFunc     func(ctx context.Context, userID, name, ua, ip string) (*devices.PairResult, error)
	refreshFunc  func(ctx context.Context, devID, token, ip string) (*devices.RefreshResult, error)
	listFunc     func(ctx context.Context, userID string) ([]devices.Device, error)
	revokeFunc   func(ctx context.Context, userID, devID string) error
	validateFunc func(ctx context.Context, devID string) error
}

func (m *mockDeviceManager) Pair(ctx context.Context, userID, name, ua, ip string) (*devices.PairResult, error) {
	if m.pairFunc != nil {
		return m.pairFunc(ctx, userID, name, ua, ip)
	}
	return &devices.PairResult{
		DeviceID:     "dev-abc",
		AccessToken:  "access-123",
		RefreshToken: "refresh-456",
		ExpiresIn:    900,
	}, nil
}

func (m *mockDeviceManager) Refresh(ctx context.Context, devID, token, ip string) (*devices.RefreshResult, error) {
	if m.refreshFunc != nil {
		return m.refreshFunc(ctx, devID, token, ip)
	}
	return &devices.RefreshResult{
		AccessToken:  "access-new",
		RefreshToken: "refresh-new",
		ExpiresIn:    900,
	}, nil
}

func (m *mockDeviceManager) List(ctx context.Context, userID string) ([]devices.Device, error) {
	if m.listFunc != nil {
		return m.listFunc(ctx, userID)
	}
	return []devices.Device{
		{ID: "dev-abc", DeviceName: "Chrome Ext", FirstIP: "1.2.3.4", LastIP: "1.2.3.4"},
	}, nil
}

func (m *mockDeviceManager) Revoke(ctx context.Context, userID, devID string) error {
	if m.revokeFunc != nil {
		return m.revokeFunc(ctx, userID, devID)
	}
	return nil
}

func (m *mockDeviceManager) ValidateDeviceActive(ctx context.Context, devID string) error {
	if m.validateFunc != nil {
		return m.validateFunc(ctx, devID)
	}
	return nil
}

type mockSubmissionManager struct {
	ingestFunc   func(ctx context.Context, userID, deviceID string, req *submissions.IngestionRequest) (*submissions.IngestionResult, error)
	backfillFunc func(ctx context.Context, userID string, requestedIDs []string) (*submissions.BackfillResponse, error)
}

func (m *mockSubmissionManager) Ingest(ctx context.Context, userID, deviceID string, req *submissions.IngestionRequest) (*submissions.IngestionResult, error) {
	if m.ingestFunc != nil {
		return m.ingestFunc(ctx, userID, deviceID, req)
	}
	return &submissions.IngestionResult{
		Status:       "queued",
		SubmissionID: req.SubmissionID,
		JobID:        "job-mock-123",
	}, nil
}

func (m *mockSubmissionManager) FindMissingSubmissions(ctx context.Context, userID string, requestedIDs []string) (*submissions.BackfillResponse, error) {
	if m.backfillFunc != nil {
		return m.backfillFunc(ctx, userID, requestedIDs)
	}
	return &submissions.BackfillResponse{MissingSubmissionIDs: requestedIDs}, nil
}

type mockRepositoryManager struct {
	listFunc   func(ctx context.Context, userID string) ([]github.RepositoryInfo, error)
	selectFunc func(ctx context.Context, userID string, req *repositories.SelectRepoRequest) (*repositories.Repository, error)
	getFunc    func(ctx context.Context, userID string) (*repositories.Repository, error)
	updateFunc func(ctx context.Context, userID string, defaultBranch string) (*repositories.Repository, error)
	verifyFunc func(ctx context.Context, userID string) error
}

func (m *mockRepositoryManager) ListAvailable(ctx context.Context, userID string) ([]github.RepositoryInfo, error) {
	if m.listFunc != nil {
		return m.listFunc(ctx, userID)
	}
	return []github.RepositoryInfo{{ID: 100, Owner: "octocat", Name: "leetcode", DefaultBranch: "main"}}, nil
}

func (m *mockRepositoryManager) SelectRepository(ctx context.Context, userID string, req *repositories.SelectRepoRequest) (*repositories.Repository, error) {
	if m.selectFunc != nil {
		return m.selectFunc(ctx, userID, req)
	}
	return &repositories.Repository{
		ID:            "repo-123",
		UserID:        userID,
		GitHubRepoID:  req.GitHubRepoID,
		Owner:         req.Owner,
		Name:          req.Name,
		DefaultBranch: req.DefaultBranch,
		Status:        "active",
	}, nil
}

func (m *mockRepositoryManager) GetSelected(ctx context.Context, userID string) (*repositories.Repository, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, userID)
	}
	return &repositories.Repository{
		ID:            "repo-123",
		UserID:        userID,
		GitHubRepoID:  100,
		Owner:         "octocat",
		Name:          "leetcode",
		DefaultBranch: "main",
		Status:        "active",
	}, nil
}

func (m *mockRepositoryManager) UpdateSelected(ctx context.Context, userID string, defaultBranch string) (*repositories.Repository, error) {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, userID, defaultBranch)
	}
	return &repositories.Repository{
		ID:            "repo-123",
		UserID:        userID,
		GitHubRepoID:  100,
		Owner:         "octocat",
		Name:          "leetcode",
		DefaultBranch: defaultBranch,
		Status:        "active",
	}, nil
}

func (m *mockRepositoryManager) VerifySelected(ctx context.Context, userID string) error {
	if m.verifyFunc != nil {
		return m.verifyFunc(ctx, userID)
	}
	return nil
}

type mockGitHubClient struct {
	authURLFunc  func(state, redirectURI string) string
	exchangeFunc func(ctx context.Context, code string) (*auth.GitHubUserInfo, error)
}

func (m *mockGitHubClient) GetAuthURL(state, redirectURI string) string {
	if m.authURLFunc != nil {
		return m.authURLFunc(state, redirectURI)
	}
	return "https://github.com/login/oauth/authorize?state=" + state
}

func (m *mockGitHubClient) ExchangeCode(ctx context.Context, code string) (*auth.GitHubUserInfo, error) {
	if m.exchangeFunc != nil {
		return m.exchangeFunc(ctx, code)
	}
	return &auth.GitHubUserInfo{GitHubUserID: 12345, Login: "octocat", InstallationID: 6789}, nil
}

func testSecret() []byte {
	return []byte("test-secret-at-least-32-bytes-long-123")
}

func TestHealthLive(t *testing.T) {
	router := api.NewRouter(&api.Handler{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health/live", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var body map[string]string
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["status"] != "ok" {
		t.Errorf("expected status ok, got %s", body["status"])
	}
}

func TestHealthReady_Healthy(t *testing.T) {
	h := &api.Handler{
		DB:    &mockPinger{err: nil},
		Kafka: &mockPinger{err: nil},
	}
	router := api.NewRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health/ready", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
}

func TestGitHubOAuthFlow(t *testing.T) {
	mockGH := &mockGitHubClient{}
	mockUsers := &mockUserManager{}
	h := &api.Handler{
		GitHub:        mockGH,
		Users:         mockUsers,
		SessionSecret: testSecret(),
	}
	router := api.NewRouter(h)

	// Step 1: Start
	startReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/github/start", nil)
	startReq.Header.Set("Accept", "application/json")
	startRec := httptest.NewRecorder()
	router.ServeHTTP(startRec, startReq)

	if startRec.Code != http.StatusOK {
		t.Fatalf("start endpoint expected 200, got %d", startRec.Code)
	}

	// Verify state cookie is set
	var stateCookie *http.Cookie
	for _, c := range startRec.Result().Cookies() {
		if c.Name == "leetsync_oauth_state" {
			stateCookie = c
			break
		}
	}
	if stateCookie == nil || stateCookie.Value == "" {
		t.Fatalf("expected leetsync_oauth_state cookie to be set")
	}

	// Step 2: Callback with invalid state -> 400 Bad Request (FR-AUTH-01)
	badCbReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/github/callback?state=wrong&code=123", nil)
	badCbReq.AddCookie(stateCookie)
	badCbRec := httptest.NewRecorder()
	router.ServeHTTP(badCbRec, badCbReq)

	if badCbRec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 on invalid state, got %d", badCbRec.Code)
	}

	// Step 3: Callback with valid state -> sets session cookie (FR-AUTH-03)
	goodCbReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/github/callback?state="+stateCookie.Value+"&code=123", nil)
	goodCbReq.AddCookie(stateCookie)
	goodCbRec := httptest.NewRecorder()
	router.ServeHTTP(goodCbRec, goodCbReq)

	if goodCbRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on valid callback, got %d", goodCbRec.Code)
	}

	var sessionCookie *http.Cookie
	for _, c := range goodCbRec.Result().Cookies() {
		if c.Name == "leetsync_session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatalf("expected leetsync_session cookie to be returned")
	}

	// Verify payload contains user ID
	payload, err := auth.VerifySessionCookie(testSecret(), sessionCookie.Value)
	if err != nil || payload.UserID != "user-mock-123" {
		t.Errorf("invalid session cookie payload: %v", payload)
	}
}

func TestDevicePairAndRefresh(t *testing.T) {
	mockDevs := &mockDeviceManager{}
	h := &api.Handler{
		Devices:       mockDevs,
		SessionSecret: testSecret(),
	}
	router := api.NewRouter(h)

	sessionVal, _ := auth.MintSessionCookie(testSecret(), "user-1", 1*time.Hour)

	// 1. Pair without session cookie -> 401
	unauthPairReq := httptest.NewRequest(http.MethodPost, "/api/v1/devices/pair", nil)
	unauthPairRec := httptest.NewRecorder()
	router.ServeHTTP(unauthPairRec, unauthPairReq)
	if unauthPairRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 when pairing unauthenticated, got %d", unauthPairRec.Code)
	}

	// 2. Pair with session cookie -> 201 Created (Acceptance Criterion: pair extension)
	pairBody, _ := json.Marshal(map[string]string{"device_name": "Test Chrome"})
	pairReq := httptest.NewRequest(http.MethodPost, "/api/v1/devices/pair", bytes.NewReader(pairBody))
	pairReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	pairRec := httptest.NewRecorder()
	router.ServeHTTP(pairRec, pairReq)

	if pairRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on pair, got %d", pairRec.Code)
	}

	var pairRes devices.PairResult
	_ = json.Unmarshal(pairRec.Body.Bytes(), &pairRes)
	if pairRes.DeviceID != "dev-abc" || pairRes.AccessToken == "" || pairRes.RefreshToken == "" {
		t.Errorf("invalid pair response: %+v", pairRes)
	}

	// 3. Refresh with valid token -> 200 OK
	refBody, _ := json.Marshal(map[string]string{
		"device_id":     "dev-abc",
		"refresh_token": "refresh-456",
	})
	refReq := httptest.NewRequest(http.MethodPost, "/api/v1/devices/refresh", bytes.NewReader(refBody))
	refRec := httptest.NewRecorder()
	router.ServeHTTP(refRec, refReq)

	if refRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on refresh, got %d", refRec.Code)
	}

	// 4. Token Reuse Detection: (Acceptance Criterion: reused token revokes family)
	mockDevs.refreshFunc = func(ctx context.Context, devID, token, ip string) (*devices.RefreshResult, error) {
		return nil, devices.ErrTokenReuseDetected
	}
	reuseReq := httptest.NewRequest(http.MethodPost, "/api/v1/devices/refresh", bytes.NewReader(refBody))
	reuseRec := httptest.NewRecorder()
	router.ServeHTTP(reuseRec, reuseReq)

	if reuseRec.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden on token reuse breach, got %d", reuseRec.Code)
	}
}

func TestDeviceRevocation(t *testing.T) {
	mockDevs := &mockDeviceManager{}
	h := &api.Handler{
		Devices:       mockDevs,
		SessionSecret: testSecret(),
	}
	router := api.NewRouter(h)

	sessionVal, _ := auth.MintSessionCookie(testSecret(), "user-1", 1*time.Hour)

	// List devices (Acceptance Criterion: sessions page shows IP, last seen)
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/devices", nil)
	listReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on list devices, got %d", listRec.Code)
	}

	var devList []devices.Device
	_ = json.Unmarshal(listRec.Body.Bytes(), &devList)
	if len(devList) != 1 || devList[0].FirstIP != "1.2.3.4" {
		t.Errorf("expected device list with IP, got %+v", devList)
	}

	// Revoke device
	revReq := httptest.NewRequest(http.MethodDelete, "/api/v1/devices/dev-abc", nil)
	revReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	revRec := httptest.NewRecorder()
	router.ServeHTTP(revRec, revReq)

	if revRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on revoke device, got %d", revRec.Code)
	}

	// Middleware check: (Acceptance Criterion: revoked device's next API call is rejected)
	mockDevs.validateFunc = func(ctx context.Context, devID string) error {
		return devices.ErrDeviceRevoked
	}

	protectedEndpoint := h.RequireDeviceToken(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	token, _ := auth.MintDeviceAccessToken(testSecret(), "dev-abc", "user-1", "fam-1", 15*time.Minute)
	apiReq := httptest.NewRequest(http.MethodGet, "/api/v1/sync/status", nil)
	apiReq.Header.Set("Authorization", "Bearer "+token)
	apiRec := httptest.NewRecorder()

	protectedEndpoint.ServeHTTP(apiRec, apiReq)

	if apiRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 on revoked device API call, got %d", apiRec.Code)
	}
}

func TestAccountDeletion(t *testing.T) {
	mockUsers := &mockUserManager{}
	h := &api.Handler{
		Users:         mockUsers,
		SessionSecret: testSecret(),
	}
	router := api.NewRouter(h)

	sessionVal, _ := auth.MintSessionCookie(testSecret(), "user-1", 1*time.Hour)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/me", nil)
	delReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)

	if delRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on account deletion, got %d", delRec.Code)
	}

	var sessionCookie *http.Cookie
	for _, c := range delRec.Result().Cookies() {
		if c.Name == "leetsync_session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value != "" {
		t.Errorf("expected session cookie to be cleared on deletion")
	}
}

func TestSyncSubmissions_AuthRequired(t *testing.T) {
	mockSubs := &mockSubmissionManager{}
	h := &api.Handler{
		Submissions:   mockSubs,
		SessionSecret: testSecret(),
	}
	router := api.NewRouter(h)

	body := []byte(`{"submission_id":"12345"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/submissions", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without bearer token, got %d", rec.Code)
	}
}

func TestSyncSubmissions_ValidationAndIngest(t *testing.T) {
	mockDevs := &mockDeviceManager{}
	mockSubs := &mockSubmissionManager{}
	h := &api.Handler{
		Devices:       mockDevs,
		Submissions:   mockSubs,
		SessionSecret: testSecret(),
	}
	router := api.NewRouter(h)

	token, _ := auth.MintDeviceAccessToken(testSecret(), "dev-abc", "user-1", "fam-1", 15*time.Minute)

	// 1. Success case
	reqPayload := submissions.IngestionRequest{
		SubmissionID: "2138016677",
		ProblemSlug:  "two-sum",
		ProblemTitle: "Two Sum",
		Language:     "python3",
		Code:         "def twoSum(): pass",
		Status:       "Accepted",
	}
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/submissions", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on valid ingestion, got %d: %s", rec.Code, rec.Body.String())
	}
	var res submissions.IngestionResult
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if res.Status != "queued" || res.SubmissionID != "2138016677" {
		t.Errorf("unexpected response: %+v", res)
	}

	// 2. Unprocessable Entity (e.g. Not Accepted)
	mockSubs.ingestFunc = func(ctx context.Context, userID, deviceID string, r *submissions.IngestionRequest) (*submissions.IngestionResult, error) {
		return nil, submissions.ErrNotAccepted
	}
	req = httptest.NewRequest(http.MethodPost, "/api/v1/sync/submissions", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for ErrNotAccepted, got %d", rec.Code)
	}

	// 3. Payload too large
	mockSubs.ingestFunc = func(ctx context.Context, userID, deviceID string, r *submissions.IngestionRequest) (*submissions.IngestionResult, error) {
		return nil, submissions.ErrPayloadTooLarge
	}
	req = httptest.NewRequest(http.MethodPost, "/api/v1/sync/submissions", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 for ErrPayloadTooLarge, got %d", rec.Code)
	}

	// 4. Downstream Kafka Failure (Service Unavailable)
	mockSubs.ingestFunc = func(ctx context.Context, userID, deviceID string, r *submissions.IngestionRequest) (*submissions.IngestionResult, error) {
		return nil, errors.New("failed to produce to kafka broker")
	}
	req = httptest.NewRequest(http.MethodPost, "/api/v1/sync/submissions", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for kafka failure, got %d", rec.Code)
	}
}

func TestSyncBackfill(t *testing.T) {
	mockDevs := &mockDeviceManager{}
	mockSubs := &mockSubmissionManager{
		backfillFunc: func(ctx context.Context, userID string, requestedIDs []string) (*submissions.BackfillResponse, error) {
			return &submissions.BackfillResponse{
				MissingSubmissionIDs: []string{"2138016678"},
			}, nil
		},
	}
	h := &api.Handler{
		Devices:       mockDevs,
		Submissions:   mockSubs,
		SessionSecret: testSecret(),
	}
	router := api.NewRouter(h)

	token, _ := auth.MintDeviceAccessToken(testSecret(), "dev-abc", "user-1", "fam-1", 15*time.Minute)

	// 1. Missing auth
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/backfill", bytes.NewReader([]byte("{}")))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", rec.Code)
	}

	// 2. Successful backfill discovery
	backfillReq := submissions.BackfillRequest{
		SubmissionIDs: []string{"2138016677", "2138016678"},
	}
	body, _ := json.Marshal(backfillReq)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/sync/backfill", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on backfill, got %d: %s", rec.Code, rec.Body.String())
	}

	var res submissions.BackfillResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if len(res.MissingSubmissionIDs) != 1 || res.MissingSubmissionIDs[0] != "2138016678" {
		t.Errorf("unexpected backfill response: %+v", res)
	}
}

func TestRepositoryEndpoints(t *testing.T) {
	mockRepos := &mockRepositoryManager{}
	h := &api.Handler{
		Repositories:  mockRepos,
		SessionSecret: testSecret(),
	}
	router := api.NewRouter(h)

	sessionVal, _ := auth.MintSessionCookie(testSecret(), "user-1", 1*time.Hour)

	// 1. List available repos
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/github/repositories", nil)
	listReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on list repos, got %d: %s", listRec.Code, listRec.Body.String())
	}
	var repos []github.RepositoryInfo
	_ = json.Unmarshal(listRec.Body.Bytes(), &repos)
	if len(repos) != 1 || repos[0].Name != "leetcode" {
		t.Errorf("unexpected repos response: %+v", repos)
	}

	// 2. Select repository
	selBody := []byte(`{"github_repo_id":100,"owner":"octocat","name":"leetcode","default_branch":"main"}`)
	selReq := httptest.NewRequest(http.MethodPost, "/api/v1/repositories", bytes.NewReader(selBody))
	selReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	selRec := httptest.NewRecorder()
	router.ServeHTTP(selRec, selReq)
	if selRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 on select repo, got %d: %s", selRec.Code, selRec.Body.String())
	}

	// 3. Get selected repository
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/repositories/selected", nil)
	getReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on get selected repo, got %d", getRec.Code)
	}

	// 4. Update selected repository branch
	updBody := []byte(`{"default_branch":"develop"}`)
	updReq := httptest.NewRequest(http.MethodPut, "/api/v1/repositories/selected", bytes.NewReader(updBody))
	updReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	updRec := httptest.NewRecorder()
	router.ServeHTTP(updRec, updReq)
	if updRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on update selected repo, got %d", updRec.Code)
	}

	// 5. Verify repository write access
	verReq := httptest.NewRequest(http.MethodPost, "/api/v1/repositories/verify", nil)
	verReq.AddCookie(&http.Cookie{Name: "leetsync_session", Value: sessionVal})
	verRec := httptest.NewRecorder()
	router.ServeHTTP(verRec, verReq)
	if verRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on verify repo, got %d", verRec.Code)
	}
}
