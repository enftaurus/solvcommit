-- Migration: 003_terms_acceptance.sql
-- Records versioned Terms of Service and Privacy Policy acceptances server-side (Phase 3)

CREATE TABLE IF NOT EXISTS terms_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    terms_version VARCHAR(32) NOT NULL,
    privacy_version VARCHAR(32) NOT NULL,
    marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    channel VARCHAR(64) NOT NULL DEFAULT 'web_signup',
    ip_address VARCHAR(45) NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_terms_version UNIQUE (user_id, terms_version)
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user ON terms_acceptances(user_id);
