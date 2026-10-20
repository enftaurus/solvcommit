import {
  UserProfile,
  SyncStatus,
  SubmissionsListResponse,
  Repository,
  GitHubRepoInfo,
  Device,
} from "./types";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error || parsed.message) msg = parsed.error || parsed.message;
    } catch {
      // ignore
    }
    const err = new Error(msg || `Request failed with status ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  return res.json();
}

export const api = {
  getMe: () => request<UserProfile>("/api/v1/me"),
  deleteMe: () => request<{ status: string }>("/api/v1/me", { method: "DELETE" }),
  logout: () => request<{ status: string }>("/api/v1/auth/logout", { method: "POST" }),
  getLoginURL: () => request<{ url: string }>("/api/v1/auth/github/start"),
  acceptTerms: (data: { terms_version?: string; privacy_version?: string; marketing_consent?: boolean; channel?: string } = {}) =>
    request<{ status: string; terms_version: string; privacy_version: string }>("/api/v1/auth/accept-terms", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Sync Pipeline
  getSyncStatus: () => request<SyncStatus>("/api/v1/sync/status"),
  getSubmissions: (limit = 20, offset = 0) =>
    request<SubmissionsListResponse>(`/api/v1/sync/submissions?limit=${limit}&offset=${offset}`),
  retrySubmission: (id: string) =>
    request<{ status: string; id: string }>(`/api/v1/sync/submissions/${id}/retry`, { method: "POST" }),
  pauseSync: () => request<{ status: string; is_paused: boolean }>("/api/v1/sync/pause", { method: "POST" }),
  resumeSync: () => request<{ status: string; is_paused: boolean }>("/api/v1/sync/resume", { method: "POST" }),

  // Repositories
  listGitHubRepos: () => request<GitHubRepoInfo[]>("/api/v1/github/repositories"),
  getSelectedRepo: () => request<Repository>("/api/v1/repositories/selected"),
  selectRepo: (data: { github_repo_id: number; owner: string; name: string; default_branch: string }) =>
    request<Repository>("/api/v1/repositories", { method: "POST", body: JSON.stringify(data) }),
  updateRepoBranch: (defaultBranch: string) =>
    request<Repository>("/api/v1/repositories/selected", {
      method: "PUT",
      body: JSON.stringify({ default_branch: defaultBranch }),
    }),
  verifyRepo: () => request<{ status: string }>("/api/v1/repositories/verify", { method: "POST" }),

  // Devices & Sessions
  listDevices: () => request<Device[]>("/api/v1/devices"),
  revokeDevice: (deviceId: string) => request<{ status: string }>(`/api/v1/devices/${deviceId}`, { method: "DELETE" }),
  pairDevice: (deviceName: string) =>
    request<{ device_id: string; access_token: string; refresh_token: string; expires_in: number }>(
      "/api/v1/devices/pair",
      { method: "POST", body: JSON.stringify({ device_name: deviceName }) }
    ),

  // Health
  checkHealth: async () => {
    try {
      const res = await fetch("/api/v1/health/live");
      return res.ok;
    } catch {
      return false;
    }
  },
};
