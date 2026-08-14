-- 0015_create_friend_visibility.sql

-- 1. Account-level friend visibility default settings
CREATE TABLE IF NOT EXISTS user_friend_visibility (
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hide_by_default  BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friend_visibility_user
    ON user_friend_visibility (user_id);

-- 2. Post-level friend visibility overrides
CREATE TABLE IF NOT EXISTS entry_friend_visibility (
    entry_id    UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    friend_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_hidden   BOOLEAN NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entry_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_friend_visibility_entry
    ON entry_friend_visibility (entry_id);

CREATE INDEX IF NOT EXISTS idx_entry_friend_visibility_friend
    ON entry_friend_visibility (friend_id);
