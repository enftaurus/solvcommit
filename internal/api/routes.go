package api

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"leetsync/internal/auth"
	"leetsync/internal/devices"
	"leetsync/internal/github"
	"leetsync/internal/repositories"
	"leetsync/internal/submissions"
)

type contextKey string

const (
	userIDKey   contextKey = "userID"
	deviceIDKey contextKey = "deviceID"
)

// Pinger interface for health probes
type Pinger interface {
	Ping(ctx context.Context) error
}

// UserManager interface for user operations
type UserManager interface {
	UpsertGitHubUser(ctx context.Context, githubUserID, installationID int64) (string, error)
	GetProfile(ctx context.Context, userID string) (*auth.UserProfile, error)
	HardDelete(ctx context.Context, userID string) error
}

// DeviceManager interface for device operations
type DeviceManager interface {
	Pair(ctx context.Context, userID, deviceName, userAgent, ip string) (*devices.PairResult, error)
	Refresh(ctx context.Context, deviceID, presentedToken, ip string) (*devices.RefreshResult, error)
	List(ctx context.Context, userID string) ([]devices.Device, error)
	Revoke(ctx context.Context, userID, deviceID string) error
	ValidateDeviceActive(ctx context.Context, deviceID string) error
}

// SubmissionManager interface for ingestion & sync dashboard operations (Phase 3 & Phase 5)
type SubmissionManager interface {
	Ingest(ctx context.Context, userID, deviceID string, req *submissions.IngestionRequest) (*submissions.IngestionResult, error)
	FindMissingSubmissions(ctx context.Context, userID string, requestedIDs []string) (*submissions.BackfillResponse, error)
	GetSyncStatus(ctx context.Context, userID string) (*submissions.SyncStatusResponse, error)
	ListSubmissions(ctx context.Context, userID string, limit, offset int) (*submissions.SubmissionsListResponse, error)
	RetrySubmission(ctx context.Context, userID, subID string) error
	PauseSync(ctx context.Context, userID string) error
	ResumeSync(ctx context.Context, userID string) error
}

// RepositoryManager interface for destination repository management (Phase 4)
type RepositoryManager interface {
	ListAvailable(ctx context.Context, userID string) ([]github.RepositoryInfo, error)
	SelectRepository(ctx context.Context, userID string, req *repositories.SelectRepoRequest) (*repositories.Repository, error)
	GetSelected(ctx context.Context, userID string) (*repositories.Repository, error)
	UpdateSelected(ctx context.Context, userID string, defaultBranch string) (*repositories.Repository, error)
	VerifySelected(ctx context.Context, userID string) error
}

// Handler holds dependencies for API endpoints
type Handler struct {
	DB            Pinger
	Kafka         Pinger
	Users         UserManager
	Devices       DeviceManager
	Submissions   SubmissionManager
	Repositories  RepositoryManager
	GitHub        auth.GitHubClient
	SessionSecret []byte
	AppEnv        string
}

// NewRouter constructs the HTTP servemux with all v1 routes (ponytail: stdlib net/http)
func NewRouter(h *Handler) http.Handler {
	mux := http.NewServeMux()

	// Operations: Liveness & Readiness Probes
	mux.HandleFunc("GET /api/v1/health/live", h.handleHealthLive)
	mux.HandleFunc("GET /api/v1/health/ready", h.handleHealthReady)

	// Auth: GitHub App OAuth flow & web session
	mux.HandleFunc("GET /api/v1/auth/github/start", h.handleGitHubStart)
	mux.HandleFunc("GET /api/v1/auth/github/callback", h.handleGitHubCallback)
	mux.HandleFunc("POST /api/v1/auth/logout", h.requireUserSession(h.handleLogout))
	mux.HandleFunc("GET /api/v1/me", h.requireUserSession(h.handleGetMe))
	mux.HandleFunc("DELETE /api/v1/me", h.requireUserSession(h.handleDeleteMe))

	// Devices & Extension Sessions
	mux.HandleFunc("POST /api/v1/devices/pair", h.requireUserSession(h.handlePairDevice))
	mux.HandleFunc("POST /api/v1/devices/refresh", h.handleRefreshDevice)
	mux.HandleFunc("GET /api/v1/devices", h.requireUserSession(h.handleListDevices))
	mux.HandleFunc("DELETE /api/v1/devices/{deviceId}", h.requireUserSession(h.handleRevokeDevice))

	// Repositories (Phase 4: GitHub Publishing & Repositories)
	mux.HandleFunc("GET /api/v1/github/repositories", h.requireUserSession(h.handleListGitHubRepos))
	mux.HandleFunc("POST /api/v1/repositories", h.requireUserSession(h.handleSelectRepository))
	mux.HandleFunc("GET /api/v1/repositories/selected", h.requireUserSession(h.handleGetSelectedRepository))
	mux.HandleFunc("PUT /api/v1/repositories/selected", h.requireUserSession(h.handleUpdateSelectedRepository))
	mux.HandleFunc("POST /api/v1/repositories/verify", h.requireUserSession(h.handleVerifyRepository))

	// Synchronization & Ingestion (Phase 3 & Phase 5)
	mux.HandleFunc("POST /api/v1/sync/submissions", h.RequireDeviceToken(h.handleSyncSubmissions))
	mux.HandleFunc("POST /api/v1/sync/backfill", h.RequireDeviceToken(h.handleSyncBackfill))
	mux.HandleFunc("GET /api/v1/sync/status", h.requireUserSession(h.handleSyncStatus))
	mux.HandleFunc("GET /api/v1/sync/submissions", h.requireUserSession(h.handleListSubmissions))
	mux.HandleFunc("POST /api/v1/sync/submissions/{id}/retry", h.requireUserSession(h.handleRetrySubmission))
	mux.HandleFunc("POST /api/v1/sync/pause", h.requireUserSession(h.handlePauseSync))
	mux.HandleFunc("POST /api/v1/sync/resume", h.requireUserSession(h.handleResumeSync))

	// Web Dashboard Static Files & SPA fallback (Phase 5)
	if _, err := os.Stat("web/dist"); err == nil {
		fs := http.FileServer(http.Dir("web/dist"))
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			cleanPath := filepath.Clean(r.URL.Path)
			fpath := filepath.Join("web/dist", cleanPath)
			if info, err := os.Stat(fpath); err == nil && !info.IsDir() {
				fs.ServeHTTP(w, r)
				return
			}
			http.ServeFile(w, r, "web/dist/index.html")
		})
	}

	return mux
}

// Health Handlers
func (h *Handler) handleHealthLive(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) handleHealthReady(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	probeCtx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	var dbErr error
	if h.DB != nil {
		dbErr = h.DB.Ping(probeCtx)
	}

	var kafkaErr error
	if h.Kafka != nil {
		kafkaErr = h.Kafka.Ping(probeCtx)
	}

	if dbErr != nil || kafkaErr != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		res := map[string]string{"status": "unavailable", "postgres": "down", "kafka": "down"}
		if dbErr == nil {
			res["postgres"] = "up"
		}
		if kafkaErr == nil {
			res["kafka"] = "up"
		}
		_ = json.NewEncoder(w).Encode(res)
		return
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ready", "postgres": "up", "kafka": "up"})
}

// GitHub OAuth Handlers (FR-AUTH-01)
func (h *Handler) handleGitHubStart(w http.ResponseWriter, r *http.Request) {
	if h.GitHub == nil {
		http.Error(w, "GitHub auth not configured", http.StatusNotImplemented)
		return
	}

	state, err := auth.GenerateRandomString(32)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Set state cookie (FR-AUTH-01: bind to initiating browser session)
	http.SetCookie(w, &http.Cookie{
		Name:     "leetsync_oauth_state",
		Value:    state,
		Path:     "/",
		Expires:  time.Now().Add(10 * time.Minute),
		HttpOnly: true,
		Secure:   h.AppEnv == "production",
		SameSite: http.SameSiteLaxMode,
	})

	redirectURI := getFullURL(r, "/api/v1/auth/github/callback")
	authURL := h.GitHub.GetAuthURL(state, redirectURI)

	// If request expects JSON (from frontend API call), return URL; otherwise redirect
	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"url": authURL})
		return
	}
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (h *Handler) handleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	if h.GitHub == nil || h.Users == nil {
		http.Error(w, "auth service unavailable", http.StatusServiceUnavailable)
		return
	}

	stateQuery := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")

	stateCookie, err := r.Cookie("leetsync_oauth_state")
	if err != nil || stateCookie.Value == "" || stateCookie.Value != stateQuery {
		http.Error(w, "invalid or expired oauth state", http.StatusBadRequest)
		return
	}

	// Clear state cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "leetsync_oauth_state",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	userInfo, err := h.GitHub.ExchangeCode(r.Context(), code)
	if err != nil {
		http.Error(w, "failed to exchange github code: "+err.Error(), http.StatusBadGateway)
		return
	}

	userID, err := h.Users.UpsertGitHubUser(r.Context(), userInfo.GitHubUserID, userInfo.InstallationID)
	if err != nil {
		http.Error(w, "failed to save user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Set session cookie (FR-AUTH-03)
	sessionVal, err := auth.MintSessionCookie(h.SessionSecret, userID, 7*24*time.Hour)
	if err != nil {
		http.Error(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "leetsync_session",
		Value:    sessionVal,
		Path:     "/",
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HttpOnly: true,
		Secure:   h.AppEnv == "production",
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "authenticated",
		"user_id": userID,
	})
}

func (h *Handler) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "leetsync_session",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "logged_out"})
}

func (h *Handler) handleGetMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(string)
	profile, err := h.Users.GetProfile(r.Context(), userID)
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(profile)
}

func (h *Handler) handleDeleteMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(string)
	if err := h.Users.HardDelete(r.Context(), userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Clear session
	http.SetCookie(w, &http.Cookie{
		Name:     "leetsync_session",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// Device Handlers (FR-EXT-02, D-12)
func (h *Handler) handlePairDevice(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(string)
	var body struct {
		DeviceName string `json:"device_name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.DeviceName == "" {
		body.DeviceName = "Chrome Extension"
	}

	ip := extractClientIP(r)
	userAgent := r.UserAgent()

	result, err := h.Devices.Pair(r.Context(), userID, body.DeviceName, userAgent, ip)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(result)
}

func (h *Handler) handleRefreshDevice(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DeviceID     string `json:"device_id"`
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.DeviceID == "" || body.RefreshToken == "" {
		http.Error(w, "invalid request: device_id and refresh_token required", http.StatusBadRequest)
		return
	}

	ip := extractClientIP(r)
	result, err := h.Devices.Refresh(r.Context(), body.DeviceID, body.RefreshToken, ip)
	if err != nil {
		if errors.Is(err, devices.ErrTokenReuseDetected) {
			// Reuse revokes entire token family (D-12)
			http.Error(w, "token breach detected; device family revoked", http.StatusForbidden)
			return
		}
		if errors.Is(err, devices.ErrDeviceRevoked) || errors.Is(err, devices.ErrInvalidToken) || errors.Is(err, devices.ErrDeviceNotFound) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (h *Handler) handleListDevices(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(string)
	devs, err := h.Devices.List(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(devs)
}

func (h *Handler) handleRevokeDevice(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(string)
	deviceID := r.PathValue("deviceId")
	if deviceID == "" {
		http.Error(w, "missing device id", http.StatusBadRequest)
		return
	}

	if err := h.Devices.Revoke(r.Context(), userID, deviceID); err != nil {
		if errors.Is(err, devices.ErrDeviceNotFound) {
			http.Error(w, "device not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "revoked"})
}

// Repositories Handlers (FR-GH-01, FR-GH-02, D-14)
func (h *Handler) handleListGitHubRepos(w http.ResponseWriter, r *http.Request) {
	if h.Repositories == nil {
		http.Error(w, "repository service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	repos, err := h.Repositories.ListAvailable(r.Context(), userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNoConnection) {
			http.Error(w, "github app not connected", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(repos)
}

func (h *Handler) handleSelectRepository(w http.ResponseWriter, r *http.Request) {
	if h.Repositories == nil {
		http.Error(w, "repository service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	var req repositories.SelectRepoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	repo, err := h.Repositories.SelectRepository(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, github.ErrPermissionDenied) {
			http.Error(w, "write permission denied for repository", http.StatusForbidden)
			return
		}
		if errors.Is(err, repositories.ErrNoConnection) {
			http.Error(w, "github app not connected", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(repo)
}

func (h *Handler) handleGetSelectedRepository(w http.ResponseWriter, r *http.Request) {
	if h.Repositories == nil {
		http.Error(w, "repository service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	repo, err := h.Repositories.GetSelected(r.Context(), userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNoSelectedRepo) {
			http.Error(w, "no active repository selected", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(repo)
}

func (h *Handler) handleUpdateSelectedRepository(w http.ResponseWriter, r *http.Request) {
	if h.Repositories == nil {
		http.Error(w, "repository service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	var body struct {
		DefaultBranch string `json:"default_branch"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.DefaultBranch == "" {
		http.Error(w, "default_branch is required", http.StatusBadRequest)
		return
	}

	repo, err := h.Repositories.UpdateSelected(r.Context(), userID, body.DefaultBranch)
	if err != nil {
		if errors.Is(err, repositories.ErrNoSelectedRepo) {
			http.Error(w, "no active repository selected", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(repo)
}

func (h *Handler) handleVerifyRepository(w http.ResponseWriter, r *http.Request) {
	if h.Repositories == nil {
		http.Error(w, "repository service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	if err := h.Repositories.VerifySelected(r.Context(), userID); err != nil {
		if errors.Is(err, github.ErrPermissionDenied) {
			http.Error(w, "permission denied: write access required", http.StatusForbidden)
			return
		}
		if errors.Is(err, repositories.ErrNoSelectedRepo) {
			http.Error(w, "no active repository selected", http.StatusNotFound)
			return
		}
		http.Error(w, "verification failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "verified"})
}

// Ingestion & Backfill Handlers (FR-ING-01, FR-ING-05)
func (h *Handler) handleSyncSubmissions(w http.ResponseWriter, r *http.Request) {
	if h.Submissions == nil {
		http.Error(w, "submission service unavailable", http.StatusServiceUnavailable)
		return
	}

	userID, _ := r.Context().Value(userIDKey).(string)
	deviceID, _ := r.Context().Value(deviceIDKey).(string)

	var req submissions.IngestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	result, err := h.Submissions.Ingest(r.Context(), userID, deviceID, &req)
	if err != nil {
		if errors.Is(err, submissions.ErrNotAccepted) ||
			errors.Is(err, submissions.ErrUnsupportedLanguage) ||
			errors.Is(err, submissions.ErrMissingProblemInfo) ||
			errors.Is(err, submissions.ErrInvalidSubmissionID) {
			http.Error(w, err.Error(), http.StatusUnprocessableEntity)
			return
		}
		if errors.Is(err, submissions.ErrPayloadTooLarge) {
			http.Error(w, err.Error(), http.StatusRequestEntityTooLarge)
			return
		}
		if errors.Is(err, submissions.ErrEmptyCode) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if strings.Contains(err.Error(), "kafka") {
			http.Error(w, "temporary ingestion failure: "+err.Error(), http.StatusServiceUnavailable)
			return
		}
		http.Error(w, "ingestion failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(result)
}

func (h *Handler) handleSyncBackfill(w http.ResponseWriter, r *http.Request) {
	if h.Submissions == nil {
		http.Error(w, "submission service unavailable", http.StatusServiceUnavailable)
		return
	}

	userID, _ := r.Context().Value(userIDKey).(string)

	var req submissions.BackfillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	res, err := h.Submissions.FindMissingSubmissions(r.Context(), userID, req.SubmissionIDs)
	if err != nil {
		http.Error(w, "backfill query failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) handleSyncStatus(w http.ResponseWriter, r *http.Request) {
	if h.Submissions == nil {
		http.Error(w, "submission service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	status, err := h.Submissions.GetSyncStatus(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(status)
}

func (h *Handler) handleListSubmissions(w http.ResponseWriter, r *http.Request) {
	if h.Submissions == nil {
		http.Error(w, "submission service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	list, err := h.Submissions.ListSubmissions(r.Context(), userID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}

func (h *Handler) handleRetrySubmission(w http.ResponseWriter, r *http.Request) {
	if h.Submissions == nil {
		http.Error(w, "submission service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)
	subID := r.PathValue("id")
	if subID == "" {
		http.Error(w, "missing submission id", http.StatusBadRequest)
		return
	}

	if err := h.Submissions.RetrySubmission(r.Context(), userID, subID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "queued", "id": subID})
}

func (h *Handler) handlePauseSync(w http.ResponseWriter, r *http.Request) {
	if h.Submissions == nil {
		http.Error(w, "submission service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	if err := h.Submissions.PauseSync(r.Context(), userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"status": "paused", "is_paused": true})
}

func (h *Handler) handleResumeSync(w http.ResponseWriter, r *http.Request) {
	if h.Submissions == nil {
		http.Error(w, "submission service unavailable", http.StatusServiceUnavailable)
		return
	}
	userID := r.Context().Value(userIDKey).(string)

	if err := h.Submissions.ResumeSync(r.Context(), userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"status": "active", "is_paused": false})
}

// Middleware: Require Web Session (FR-AUTH-03)
func (h *Handler) requireUserSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("leetsync_session")
		if err != nil || cookie.Value == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		payload, err := auth.VerifySessionCookie(h.SessionSecret, cookie.Value)
		if err != nil {
			http.Error(w, "invalid or expired session", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, payload.UserID)
		next(w, r.WithContext(ctx))
	}
}

// Middleware: Require Device Bearer Token
func (h *Handler) RequireDeviceToken(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "unauthorized: missing bearer token", http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		payload, err := auth.VerifyDeviceAccessToken(h.SessionSecret, tokenStr)
		if err != nil {
			http.Error(w, "unauthorized: "+err.Error(), http.StatusUnauthorized)
			return
		}

		// Ensure device is active and not revoked
		if h.Devices != nil {
			if err := h.Devices.ValidateDeviceActive(r.Context(), payload.DeviceID); err != nil {
				http.Error(w, "unauthorized: device revoked", http.StatusUnauthorized)
				return
			}
		}

		ctx := context.WithValue(r.Context(), userIDKey, payload.UserID)
		ctx = context.WithValue(ctx, deviceIDKey, payload.DeviceID)
		next(w, r.WithContext(ctx))
	}
}

// Helper: Extract client IP (D-13)
func extractClientIP(r *http.Request) string {
	// If forwarded header exists from trusted reverse proxy
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func getFullURL(r *http.Request, path string) string {
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + r.Host + path
}
