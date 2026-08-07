-- Migration 0014: Unify storage object keys in users and entries tables.
-- Convert all full Supabase URLs, full Backblaze URLs, and presigned URLs into relative object keys.

BEGIN;

-- Report counts before migration
DO $$
DECLARE
    users_count INT;
    entries_photo_count INT;
    entries_audio_count INT;
BEGIN
    SELECT COUNT(*) INTO users_count FROM users WHERE avatar_url IS NOT NULL AND avatar_url != '' AND avatar_url LIKE 'http%';
    SELECT COUNT(*) INTO entries_photo_count FROM entries WHERE photo_url IS NOT NULL AND photo_url != '' AND photo_url LIKE 'http%';
    SELECT COUNT(*) INTO entries_audio_count FROM entries WHERE audio_url IS NOT NULL AND audio_url != '' AND audio_url LIKE 'http%';
    
    RAISE NOTICE 'Before migration - URLs needing key extraction: users.avatar_url: %, entries.photo_url: %, entries.audio_url: %',
        users_count, entries_photo_count, entries_audio_count;
END $$;

-- 1. Clean users.avatar_url
UPDATE users
SET avatar_url = REGEXP_REPLACE(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    avatar_url,
                    '\?.*$', ''
                ),
                '^https?://[^/]+/storage/v1/object/public/(entry-photos/|entries/)?', ''
            ),
            '^storage/v1/object/public/(entry-photos/|entries/)?', ''
        ),
        '^https?://moodila-uploads\.s3\.[^/]+\.backblazeb2\.com/', ''
    ),
    '^https?://s3\.[^/]+\.backblazeb2\.com/moodila-uploads/', ''
)
WHERE avatar_url IS NOT NULL AND avatar_url != '';

-- 2. Clean entries.photo_url
UPDATE entries
SET photo_url = REGEXP_REPLACE(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    photo_url,
                    '\?.*$', ''
                ),
                '^https?://[^/]+/storage/v1/object/public/(entry-photos/|entries/)?', ''
            ),
            '^storage/v1/object/public/(entry-photos/|entries/)?', ''
        ),
        '^https?://moodila-uploads\.s3\.[^/]+\.backblazeb2\.com/', ''
    ),
    '^https?://s3\.[^/]+\.backblazeb2\.com/moodila-uploads/', ''
)
WHERE photo_url IS NOT NULL AND photo_url != '';

-- 3. Clean entries.audio_url
UPDATE entries
SET audio_url = REGEXP_REPLACE(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    audio_url,
                    '\?.*$', ''
                ),
                '^https?://[^/]+/storage/v1/object/public/(entry-photos/|entries/)?', ''
            ),
            '^storage/v1/object/public/(entry-photos/|entries/)?', ''
        ),
        '^https?://moodila-uploads\.s3\.[^/]+\.backblazeb2\.com/', ''
    ),
    '^https?://s3\.[^/]+\.backblazeb2\.com/moodila-uploads/', ''
)
WHERE audio_url IS NOT NULL AND audio_url != '';

-- Report counts after migration
DO $$
DECLARE
    users_remaining INT;
    entries_photo_remaining INT;
    entries_audio_remaining INT;
BEGIN
    SELECT COUNT(*) INTO users_remaining FROM users WHERE avatar_url IS NOT NULL AND avatar_url != '' AND avatar_url LIKE 'http%';
    SELECT COUNT(*) INTO entries_photo_remaining FROM entries WHERE photo_url IS NOT NULL AND photo_url != '' AND photo_url LIKE 'http%';
    SELECT COUNT(*) INTO entries_audio_remaining FROM entries WHERE audio_url IS NOT NULL AND audio_url != '' AND audio_url LIKE 'http%';
    
    RAISE NOTICE 'After migration - Remaining non-relative URLs: users.avatar_url: %, entries.photo_url: %, entries.audio_url: %',
        users_remaining, entries_photo_remaining, entries_audio_remaining;
END $$;

COMMIT;
