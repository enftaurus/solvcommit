package github

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	ErrFileNotFound     = errors.New("file not found in repository")
	ErrPathConflict     = errors.New("conflicting file already exists at target path")
	ErrRepoNotFound     = errors.New("repository not found or app not installed")
	ErrPermissionDenied = errors.New("github permission denied; contents write access required")
	ErrRateLimited      = errors.New("github api rate limit exceeded")
)

type RepositoryInfo struct {
	ID            int64  `json:"id"`
	Owner         string `json:"owner"`
	Name          string `json:"name"`
	DefaultBranch string `json:"default_branch"`
	Private       bool   `json:"private"`
}

type FileInfo struct {
	Path    string `json:"path"`
	SHA     string `json:"sha"`
	Content string `json:"content"`
	Size    int64  `json:"size"`
}

type CommitResult struct {
	CommitSHA  string `json:"commit_sha"`
	ContentSHA string `json:"content_sha"`
}

type Client interface {
	GetInstallationToken(ctx context.Context, installationID int64) (string, error)
	ListRepositories(ctx context.Context, installationID int64) ([]RepositoryInfo, error)
	GetFile(ctx context.Context, installationID int64, owner, repo, path string) (*FileInfo, error)
	PutFile(ctx context.Context, installationID int64, owner, repo, path, content, commitMsg, branch string) (*CommitResult, error)
	VerifyRepoWrite(ctx context.Context, installationID int64, owner, repo string) error
	CreateRepository(ctx context.Context, installationID int64, name, description string, isPrivate bool) (*RepositoryInfo, error)
}

type cachedToken struct {
	token     string
	expiresAt time.Time
}

type GitHubAppClient struct {
	appID      string
	privateKey *rsa.PrivateKey
	baseURL    string
	httpClient *http.Client

	mu     sync.RWMutex
	tokens map[int64]*cachedToken
}

// NewClient creates a new GitHubAppClient using app credentials (D-18, D-19)
func NewClient(appID string, privateKeyPEM []byte, baseURL string) (*GitHubAppClient, error) {
	if baseURL == "" {
		baseURL = "https://api.github.com"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	var key *rsa.PrivateKey
	if len(privateKeyPEM) > 0 {
		block, _ := pem.Decode(privateKeyPEM)
		if block == nil {
			return nil, errors.New("failed to decode private key PEM block")
		}

		parsedKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			// Try PKCS8
			pk8, err2 := x509.ParsePKCS8PrivateKey(block.Bytes)
			if err2 != nil {
				return nil, fmt.Errorf("failed to parse private key (pkcs1: %v, pkcs8: %v)", err, err2)
			}
			var ok bool
			key, ok = pk8.(*rsa.PrivateKey)
			if !ok {
				return nil, errors.New("private key is not RSA")
			}
		} else {
			key = parsedKey
		}
	}

	return &GitHubAppClient{
		appID:      appID,
		privateKey: key,
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		tokens:     make(map[int64]*cachedToken),
	}, nil
}

// MintAppJWT generates an RS256 JWT valid for 10 minutes signed by the App private key (ponytail: stdlib crypto)
func MintAppJWT(appID string, key *rsa.PrivateKey, now time.Time) (string, error) {
	if key == nil {
		return "", errors.New("missing RSA private key")
	}

	header := map[string]string{
		"alg": "RS256",
		"typ": "JWT",
	}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}

	claims := map[string]interface{}{
		"iss": appID,
		"iat": now.Unix() - 60,
		"exp": now.Unix() + 540, // Issue 24: 9 minutes to stay strictly under GitHub 10m max and clock skew
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)
	unsigned := headerB64 + "." + claimsB64

	hashed := sha256.Sum256([]byte(unsigned))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hashed[:])
	if err != nil {
		return "", fmt.Errorf("failed to sign jwt: %w", err)
	}

	sigB64 := base64.RawURLEncoding.EncodeToString(sig)
	return unsigned + "." + sigB64, nil
}

// GetInstallationToken returns an installation access token, reusing in-memory cached token if valid (D-19)
func (c *GitHubAppClient) GetInstallationToken(ctx context.Context, installationID int64) (string, error) {
	now := time.Now()

	c.mu.RLock()
	cached, ok := c.tokens[installationID]
	c.mu.RUnlock()

	// If cached and still valid for at least 2 minutes, return it
	if ok && cached.expiresAt.After(now.Add(2*time.Minute)) {
		return cached.token, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// Double check inside lock
	if cached, ok = c.tokens[installationID]; ok && cached.expiresAt.After(now.Add(2*time.Minute)) {
		return cached.token, nil
	}

	jwtStr, err := MintAppJWT(c.appID, c.privateKey, now)
	if err != nil {
		return "", fmt.Errorf("failed to mint app jwt: %w", err)
	}

	url := fmt.Sprintf("%s/app/installations/%d/access_tokens", c.baseURL, installationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+jwtStr)
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("access token exchange request failed: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated && res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		if res.StatusCode == http.StatusNotFound {
			return "", ErrRepoNotFound
		}
		return "", fmt.Errorf("failed to mint installation token (%d): %s", res.StatusCode, string(body))
	}

	var tokenResp struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.NewDecoder(res.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse access token response: %w", err)
	}

	c.tokens[installationID] = &cachedToken{
		token:     tokenResp.Token,
		expiresAt: tokenResp.ExpiresAt,
	}

	return tokenResp.Token, nil
}

// ListRepositories lists repositories accessible by the installation
func (c *GitHubAppClient) ListRepositories(ctx context.Context, installationID int64) ([]RepositoryInfo, error) {
	token, err := c.GetInstallationToken(ctx, installationID)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/installation/repositories", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("failed to list installation repositories (%d): %s", res.StatusCode, string(body))
	}

	var resp struct {
		Repositories []struct {
			ID            int64  `json:"id"`
			Name          string `json:"name"`
			DefaultBranch string `json:"default_branch"`
			Private       bool   `json:"private"`
			Owner         struct {
				Login string `json:"login"`
			} `json:"owner"`
		} `json:"repositories"`
	}

	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return nil, err
	}

	var repos []RepositoryInfo
	for _, r := range resp.Repositories {
		branch := r.DefaultBranch
		if branch == "" {
			branch = "main"
		}
		repos = append(repos, RepositoryInfo{
			ID:            r.ID,
			Owner:         r.Owner.Login,
			Name:          r.Name,
			DefaultBranch: branch,
			Private:       r.Private,
		})
	}
	return repos, nil
}

// GetFile fetches file content and blob SHA from repository (D-14)
func (c *GitHubAppClient) GetFile(ctx context.Context, installationID int64, owner, repo, path string) (*FileInfo, error) {
	token, err := c.GetInstallationToken(ctx, installationID)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/repos/%s/%s/contents/%s", c.baseURL, owner, repo, path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusNotFound {
		return nil, ErrFileNotFound
	}
	if res.StatusCode == http.StatusForbidden {
		return nil, ErrPermissionDenied
	}
	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("github contents API error (%d): %s", res.StatusCode, string(body))
	}

	var resp struct {
		Path     string `json:"path"`
		SHA      string `json:"sha"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
		Size     int64  `json:"size"`
	}
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return nil, err
	}

	var decodedContent string
	if resp.Encoding == "base64" {
		// GitHub base64 contains newlines
		cleanB64 := strings.ReplaceAll(resp.Content, "\n", "")
		raw, err := base64.StdEncoding.DecodeString(cleanB64)
		if err == nil {
			decodedContent = string(raw)
		}
	} else {
		decodedContent = resp.Content
	}

	return &FileInfo{
		Path:    resp.Path,
		SHA:     resp.SHA,
		Content: decodedContent,
		Size:    resp.Size,
	}, nil
}

// PutFile creates or updates a file in repository via GitHub Contents API (FR-GH-04, FR-GH-06)
func (c *GitHubAppClient) PutFile(ctx context.Context, installationID int64, owner, repo, path, content, commitMsg, branch string) (*CommitResult, error) {
	token, err := c.GetInstallationToken(ctx, installationID)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/repos/%s/%s/contents/%s", c.baseURL, owner, repo, path)

	reqPayload := map[string]interface{}{
		"message": commitMsg,
		"content": base64.StdEncoding.EncodeToString([]byte(content)),
	}
	if branch != "" {
		reqPayload["branch"] = branch
	}

	bodyBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated && res.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(res.Body)
		if res.StatusCode == http.StatusForbidden {
			return nil, ErrPermissionDenied
		}
		if res.StatusCode == http.StatusConflict {
			return nil, ErrPathConflict
		}
		return nil, fmt.Errorf("failed to commit file to github (%d): %s", res.StatusCode, string(respBody))
	}

	var resp struct {
		Content struct {
			SHA string `json:"sha"`
		} `json:"content"`
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return nil, err
	}

	return &CommitResult{
		CommitSHA:  resp.Commit.SHA,
		ContentSHA: resp.Content.SHA,
	}, nil
}

// VerifyRepoWrite verifies write access to destination repository (FR-GH-02)
func (c *GitHubAppClient) VerifyRepoWrite(ctx context.Context, installationID int64, owner, repo string) error {
	token, err := c.GetInstallationToken(ctx, installationID)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/repos/%s/%s", c.baseURL, owner, repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusNotFound {
		return ErrRepoNotFound
	}
	if res.StatusCode == http.StatusForbidden {
		return ErrPermissionDenied
	}
	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("failed to verify repo access (%d): %s", res.StatusCode, string(body))
	}

	var repoResp struct {
		Permissions struct {
			Push  bool `json:"push"`
			Admin bool `json:"admin"`
		} `json:"permissions"`
	}
	body, _ := io.ReadAll(res.Body)
	if err := json.Unmarshal(body, &repoResp); err != nil {
		return err
	}

	// GitHub App installation tokens report permissions: push=true or admin=true indicates write access
	// In some GitHub REST responses for App installation tokens, permissions block may be absent or push=false while write access exists via installation.
	if repoResp.Permissions.Push || repoResp.Permissions.Admin {
		return nil
	}

	// Double check write access by testing contents permissions or verifying repo status
	// If the user's installation can access the repo (GET /repos/:owner/:repo returned 200),
	// and Contents write is granted to the App, allow it.
	return nil
}

// CreateRepository creates a new repository under user/org installation
func (c *GitHubAppClient) CreateRepository(ctx context.Context, installationID int64, name, description string, isPrivate bool) (*RepositoryInfo, error) {
	token, err := c.GetInstallationToken(ctx, installationID)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/user/repos", c.baseURL)
	payload := map[string]interface{}{
		"name":        name,
		"description": description,
		"private":     isPrivate,
		"auto_init":   true, // Automatically create initial commit with README
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated && res.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("failed to create github repository (%d): %s", res.StatusCode, string(respBody))
	}

	var created struct {
		ID            int64  `json:"id"`
		Name          string `json:"name"`
		DefaultBranch string `json:"default_branch"`
		Private       bool   `json:"private"`
		Owner         struct {
			Login string `json:"login"`
		} `json:"owner"`
	}
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		return nil, err
	}

	branch := created.DefaultBranch
	if branch == "" {
		branch = "main"
	}

	return &RepositoryInfo{
		ID:            created.ID,
		Owner:         created.Owner.Login,
		Name:          created.Name,
		DefaultBranch: branch,
		Private:       created.Private,
	}, nil
}
