CREATE TABLE IF NOT EXISTS entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    mood       SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
    tags       TEXT[] NOT NULL DEFAULT '{}',
    text       TEXT NOT NULL DEFAULT '',
    photo_url  TEXT,
    is_hidden  BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, date)
);
