export interface UserProfile {
  id: string;
  github_user_id: number;
  installation_id: number;
  status: string;
  created_at: string;
}

export interface SyncStatus {
  queued: number;
  processing: number;
  retrying: number;
  published: number;
  failed: number;
  expired: number;
  total: number;
  is_paused: boolean;
}

export interface SubmissionRow {
  id: string;
  user_id: string;
  leetcode_submission_id: number;
  problem_slug: string;
  problem_title: string;
  language: string;
  status: "queued" | "processing" | "published" | "retrying" | "failed" | "expired";
  content_sha256: string;
  github_path?: string;
  commit_sha?: string;
  attempt_count: number;
  last_error_code?: string;
  received_at: string;
  published_at?: string;
}

export interface SubmissionsListResponse {
  submissions: SubmissionRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface Repository {
  id: string;
  user_id: string;
  github_repo_id: number;
  owner: string;
  name: string;
  default_branch: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepoInfo {
  id: number;
  owner: string;
  name: string;
  default_branch: string;
  private: boolean;
}

export interface Device {
  id: string;
  device_name: string;
  user_agent: string;
  first_ip: string;
  last_ip: string;
  created_at: string;
  last_seen_at: string;
  revoked_at?: string;
}
