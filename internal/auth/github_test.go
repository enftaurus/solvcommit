package auth_test

import (
	"testing"

	"leetsync/internal/auth"
)

func TestPickInstallation(t *testing.T) {
	tests := []struct {
		name     string
		info     *auth.GitHubUserInfo
		wanted   int64
		expected int64
	}{
		{
			name:     "nil info returns 0",
			info:     nil,
			wanted:   123,
			expected: 0,
		},
		{
			name: "wanted is in installations",
			info: &auth.GitHubUserInfo{
				Login: "octocat",
				Installations: []auth.Installation{
					{ID: 100, Login: "octocat"},
					{ID: 200, Login: "org-xyz"},
				},
			},
			wanted:   200,
			expected: 200,
		},
		{
			name: "wanted is not in installations; falls back to matching login case-insensitive",
			info: &auth.GitHubUserInfo{
				Login: "OctoCat",
				Installations: []auth.Installation{
					{ID: 300, Login: "random-org"},
					{ID: 400, Login: "octocat"},
				},
			},
			wanted:   999, // Attacker wanted another installation
			expected: 400, // Matched user's login
		},
		{
			name: "wanted not in list and no matching login; falls back to first installation",
			info: &auth.GitHubUserInfo{
				Login: "alice",
				Installations: []auth.Installation{
					{ID: 500, Login: "some-org"},
					{ID: 600, Login: "other-org"},
				},
			},
			wanted:   0,
			expected: 500,
		},
		{
			name: "wanted not in list and empty installations; returns 0",
			info: &auth.GitHubUserInfo{
				Login:         "bob",
				Installations: []auth.Installation{},
			},
			wanted:   700,
			expected: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := auth.PickInstallation(tc.info, tc.wanted)
			if got != tc.expected {
				t.Errorf("PickInstallation() = %d, expected %d", got, tc.expected)
			}
		})
	}
}
