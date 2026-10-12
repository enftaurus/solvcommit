-- Ensure at most one repository can be 'active' per user at any time (Issue 11)

-- 1. Deactivate older active repositories per user, keeping the latest updated one active
UPDATE repositories
SET status = 'inactive', updated_at = NOW()
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM repositories
    WHERE status = 'active'
    ORDER BY user_id, updated_at DESC
) AND status = 'active';

-- 2. Create partial unique index enforcing only one active repo per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_repo_per_user
ON repositories(user_id)
WHERE (status = 'active');
