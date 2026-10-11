-- Migration: 001_initial_schema.sql
-- Initial schema for LeetSync metadata storage in PostgreSQL
-- Note: Source code is strictly forbidden in PostgreSQL (lives only in Kafka & GitHub)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GitHub Connections Table (GitHub App installation linkage)
CREATE TABLE IF NOT EXISTS github_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    github_user_id BIGINT NOT NULL UNIQUE,
    installation_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'connected',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repositories Table
CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_repo_id BIGINT NOT NULL,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    default_branch VARCHAR(100) NOT NULL DEFAULT 'main',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_repo_user_github UNIQUE (user_id, github_repo_id)
);

-- Devices Table (Paired Chrome Extensions & rotating sessions)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    first_ip VARCHAR(45) NOT NULL DEFAULT '',
    last_ip VARCHAR(45) NOT NULL DEFAULT '',
    token_family_id UUID NOT NULL,
    refresh_token_hash VARCHAR(64) NOT NULL,
    previous_token_hash VARCHAR(64) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ DEFAULT NULL,
    revoked_reason TEXT DEFAULT NULL
);

-- Submissions Table (Thin metadata only)
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leetcode_submission_id BIGINT NOT NULL,
    problem_slug VARCHAR(255) NOT NULL,
    problem_title VARCHAR(255) NOT NULL,
    language VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    content_sha256 CHAR(64) NOT NULL,
    github_path TEXT DEFAULT NULL,
    commit_sha CHAR(40) DEFAULT NULL,
    attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at TIMESTAMPTZ DEFAULT NULL,
    last_error_code VARCHAR(64) DEFAULT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT uq_submissions_user_lc UNIQUE (user_id, leetcode_submission_id),
    CONSTRAINT chk_submissions_status CHECK (status IN ('queued', 'processing', 'published', 'retrying', 'failed', 'expired'))
);

-- Schema Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_next_attempt ON submissions(next_attempt_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_family ON devices(token_family_id);
CREATE INDEX IF NOT EXISTS idx_devices_refresh_hash ON devices(refresh_token_hash);
