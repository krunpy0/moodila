-- Users: accounts for MoodShare.
-- password_hash is nullable so OAuth-only accounts can be added later without
-- schema changes (BRIEF §4). gen_random_uuid() is built into Postgres 13+
-- (Supabase runs 15+), so no extension is required.
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    username      TEXT UNIQUE NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
