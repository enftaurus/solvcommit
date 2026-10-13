package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Installation represents an authorized installation returned by GitHub
type Installation struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
}

// GitHubUserInfo contains verified identity and accessible installations from GitHub
type GitHubUserInfo struct {
	GitHubUserID  int64          `json:"id"`
	Login         string         `json:"login"`
	Installations []Installation `json:"installations"`
}

// PickInstallation selects the most appropriate installation ID:
// returns wanted if it is in info.Installations;
// otherwise the installation whose Login equals the user's login (case-insensitive);
// otherwise the first one;
// otherwise 0.
func PickInstallation(info *GitHubUserInfo, wanted int64) int64 {
	if info == nil {
		return 0
	}
	if wanted > 0 {
		for _, inst := range info.Installations {
			if inst.ID == wanted {
				return wanted
			}
		}
	}
	for _, inst := range info.Installations {
		if strings.EqualFold(inst.Login, info.Login) && inst.ID > 0 {
			return inst.ID
		}
	}
	if len(info.Installations) > 0 {
		return info.Installations[0].ID
	}
	return 0
}

// GitHubClient defines interface for GitHub App OAuth interactions (ponytail: mockable interface)
type GitHubClient interface {
	GetAuthURL(state, redirectURI string) string
	ExchangeCode(ctx context.Context, code string) (*GitHubUserInfo, error)
}

// RealGitHubClient implements GitHub App OAuth using standard HTTP client
type RealGitHubClient struct {
	ClientID     string
	ClientSecret string
	HTTPClient   *http.Client
}

func NewRealGitHubClient(clientID, clientSecret string) *RealGitHubClient {
	return &RealGitHubClient{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		HTTPClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *RealGitHubClient) GetAuthURL(state, redirectURI string) string {
	vals := url.Values{}
	vals.Set("client_id", c.ClientID)
	vals.Set("state", state)
	vals.Set("redirect_uri", redirectURI)
	return fmt.Sprintf("https://github.com/login/oauth/authorize?%s", vals.Encode())
}

func (c *RealGitHubClient) ExchangeCode(ctx context.Context, code string) (*GitHubUserInfo, error) {
	// 1. Exchange code for temporary token
	tokenURL := "https://github.com/login/oauth/access_token"
	form := url.Values{}
	form.Set("client_id", c.ClientID)
	form.Set("client_secret", c.ClientSecret)
	form.Set("code", code)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}
	if tokenResp.Error != "" || tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("github oauth error: %s", tokenResp.Error)
	}

	// 2. Fetch authenticated user profile
	userReq, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
	userReq.Header.Set("Accept", "application/vnd.github+json")

	userResp, err := c.HTTPClient.Do(userReq)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user info: %w", err)
	}
	defer userResp.Body.Close()

	if userResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(userResp.Body)
		return nil, fmt.Errorf("failed to fetch user profile (%d): %s", userResp.StatusCode, string(body))
	}

	var userInfo struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	// 3. Query all user installations from GET /user/installations
	instReq, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/installations", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create installations request: %w", err)
	}
	instReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
	instReq.Header.Set("Accept", "application/vnd.github+json")

	instResp, err := c.HTTPClient.Do(instReq)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user installations: %w", err)
	}
	defer instResp.Body.Close()

	if instResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(instResp.Body)
		return nil, fmt.Errorf("failed to fetch user installations (%d): %s", instResp.StatusCode, string(body))
	}

	var instData struct {
		Installations []struct {
			ID      int64 `json:"id"`
			Account struct {
				Login string `json:"login"`
			} `json:"account"`
		} `json:"installations"`
	}
	if err := json.NewDecoder(instResp.Body).Decode(&instData); err != nil {
		return nil, fmt.Errorf("failed to decode user installations: %w", err)
	}

	var installations []Installation
	for _, inst := range instData.Installations {
		installations = append(installations, Installation{
			ID:    inst.ID,
			Login: inst.Account.Login,
		})
	}

	// D-19: Discard the access token immediately after obtaining user identity and installations
	return &GitHubUserInfo{
		GitHubUserID:  userInfo.ID,
		Login:         userInfo.Login,
		Installations: installations,
	}, nil
}
