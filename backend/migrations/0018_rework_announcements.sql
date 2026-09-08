-- Migration 0018: Rework Announcements (kind, display_type, expires_at, CTA, announcement_user_state)

-- 1. Extend announcements table
ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'standard'
        CHECK (kind IN ('standard', 'onboarding')),
    ADD COLUMN IF NOT EXISTS display_type TEXT NOT NULL DEFAULT 'modal'
        CHECK (display_type IN ('modal', 'banner', 'feed_only')),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cta_label TEXT,
    ADD COLUMN IF NOT EXISTS cta_url TEXT,
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- 2. Create announcement_user_state table with separate dismissed_at and read_at
CREATE TABLE IF NOT EXISTS announcement_user_state (
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dismissed_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    PRIMARY KEY (announcement_id, user_id)
);

-- 3. Backfill data from legacy announcement_reads if it exists
INSERT INTO announcement_user_state (announcement_id, user_id, dismissed_at, read_at)
SELECT announcement_id, user_id, read_at, read_at
FROM announcement_reads
ON CONFLICT (announcement_id, user_id) DO NOTHING;

-- 4. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_announcements_prompt
    ON announcements (status, kind, published_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_announcements_inbox
    ON announcements (status, is_pinned, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_user_state_user
    ON announcement_user_state (user_id);
