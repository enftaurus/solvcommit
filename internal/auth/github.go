package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// GitHubUserInfo contains verified identity from GitHub
type GitHubUserInfo struct {
	GitHubUserID   int64  `json:"id"`
	Login          string `json:"login"`
	InstallationID int64  `json:"installation_id"`
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

	var userInfo struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	// 3. Query installation ID for user (optional fallback in dev/test)
	var installationID int64
	instReq, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/installations", nil)
	if err == nil {
		instReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
		instReq.Header.Set("Accept", "application/vnd.github+json")
		if instResp, err := c.HTTPClient.Do(instReq); err == nil {
			var instData struct {
				Installations []struct {
					ID int64 `json:"id"`
				} `json:"installations"`
			}
			if json.NewDecoder(instResp.Body).Decode(&instData) == nil && len(instData.Installations) > 0 {
				installationID = instData.Installations[0].ID
			}
			instResp.Body.Close()
		}
	}

	// D-19: Discard the access token immediately after obtaining user identity
	return &GitHubUserInfo{
		GitHubUserID:   userInfo.ID,
		Login:          userInfo.Login,
		InstallationID: installationID,
	}, nil
}
