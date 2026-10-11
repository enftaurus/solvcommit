package github_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"leetsync/internal/github"
)

func generateTestRSAKey(t *testing.T) (*rsa.PrivateKey, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}
	keyBytes := x509.MarshalPKCS1PrivateKey(key)
	pemBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: keyBytes,
	})
	return key, pemBytes
}

func TestMintAppJWT(t *testing.T) {
	key, _ := generateTestRSAKey(t)
	now := time.Now()

	jwtStr, err := github.MintAppJWT("app-12345", key, now)
	if err != nil {
		t.Fatalf("failed to mint jwt: %v", err)
	}

	if jwtStr == "" {
		t.Fatal("expected non-empty jwt")
	}
}

func TestGitHubAppClient_TokenCaching(t *testing.T) {
	_, pemBytes := generateTestRSAKey(t)

	serverCallCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/app/installations/123/access_tokens" {
			serverCallCount++
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"token":      "ghs_mock_token_abc",
				"expires_at": time.Now().Add(1 * time.Hour).Format(time.RFC3339),
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client, err := github.NewClient("app-12345", pemBytes, server.URL)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	ctx := context.Background()

	// 1. First call: fetches from server
	tok1, err := client.GetInstallationToken(ctx, 123)
	if err != nil {
		t.Fatalf("failed to get token: %v", err)
	}
	if tok1 != "ghs_mock_token_abc" {
		t.Errorf("expected 'ghs_mock_token_abc', got '%s'", tok1)
	}
	if serverCallCount != 1 {
		t.Errorf("expected 1 server call, got %d", serverCallCount)
	}

	// 2. Second call: should use in-memory cache (D-19)
	tok2, err := client.GetInstallationToken(ctx, 123)
	if err != nil {
		t.Fatalf("failed to get cached token: %v", err)
	}
	if tok2 != tok1 {
		t.Errorf("expected matching cached token")
	}
	if serverCallCount != 1 {
		t.Errorf("expected serverCallCount to still be 1 (cached), got %d", serverCallCount)
	}
}

func TestGitHubAppClient_GetFile(t *testing.T) {
	_, pemBytes := generateTestRSAKey(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/app/installations/123/access_tokens" {
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"token":      "ghs_token",
				"expires_at": time.Now().Add(1 * time.Hour).Format(time.RFC3339),
			})
			return
		}
		if r.URL.Path == "/repos/octocat/leetcode/contents/existing/file.py" {
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"path":     "existing/file.py",
				"sha":      "blob_sha_123",
				"content":  base64.StdEncoding.EncodeToString([]byte("def hello(): pass")),
				"encoding": "base64",
				"size":     18,
			})
			return
		}
		if r.URL.Path == "/repos/octocat/leetcode/contents/missing.py" {
			http.NotFound(w, r)
			return
		}
		http.Error(w, "bad request", http.StatusBadRequest)
	}))
	defer server.Close()

	client, err := github.NewClient("app-12345", pemBytes, server.URL)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	ctx := context.Background()

	// Existing file
	fileInfo, err := client.GetFile(ctx, 123, "octocat", "leetcode", "existing/file.py")
	if err != nil {
		t.Fatalf("failed to get file: %v", err)
	}
	if fileInfo.Content != "def hello(): pass" || fileInfo.SHA != "blob_sha_123" {
		t.Errorf("unexpected file info: %+v", fileInfo)
	}

	// Missing file -> ErrFileNotFound
	_, err = client.GetFile(ctx, 123, "octocat", "leetcode", "missing.py")
	if !errors.Is(err, github.ErrFileNotFound) {
		t.Errorf("expected ErrFileNotFound, got: %v", err)
	}
}

func TestGitHubAppClient_PutFile(t *testing.T) {
	_, pemBytes := generateTestRSAKey(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/app/installations/123/access_tokens" {
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"token":      "ghs_token",
				"expires_at": time.Now().Add(1 * time.Hour).Format(time.RFC3339),
			})
			return
		}
		if r.URL.Path == "/repos/octocat/leetcode/contents/two-sum/submission-1.py" && r.Method == http.MethodPut {
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"content": map[string]string{"sha": "new_blob_sha"},
				"commit":  map[string]string{"sha": "commit_sha_abc"},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client, err := github.NewClient("app-12345", pemBytes, server.URL)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	res, err := client.PutFile(context.Background(), 123, "octocat", "leetcode",
		"two-sum/submission-1.py", "print('hello')", "feat: sync accepted Two Sum submission (1)", "main")
	if err != nil {
		t.Fatalf("failed to put file: %v", err)
	}

	if res.CommitSHA != "commit_sha_abc" || res.ContentSHA != "new_blob_sha" {
		t.Errorf("unexpected commit result: %+v", res)
	}
}
