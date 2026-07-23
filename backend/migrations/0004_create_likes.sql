CREATE TABLE IF NOT EXISTS likes (
    entry_id   UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS likes_entry_id_idx ON likes (entry_id);
CREATE INDEX IF NOT EXISTS entries_feed_idx ON entries (user_id, date DESC, created_at DESC)
    WHERE is_hidden = false;
