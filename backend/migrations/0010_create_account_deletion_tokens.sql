-- Account Deletion Tokens for Moodila
CREATE TABLE IF NOT EXISTS account_deletion_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_tokens_hash ON account_deletion_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_account_deletion_tokens_user ON account_deletion_tokens(user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
