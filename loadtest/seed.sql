-- ============================================================================
-- Moodila Load Test Database Seed Script
-- Target: 50 users, ~20 accepted friends each, ~200 entries each (~10,000 entries),
--         reactions, comments, and visibility overrides.
-- Password for all accounts: Password123!
-- ============================================================================

BEGIN;

-- 1. Create 50 Users (loadtest_0 .. loadtest_49)
INSERT INTO users (id, email, username, display_name, password_hash, token_version, created_at)
SELECT 
    gen_random_uuid(),
    'loadtest_' || i || '@moodila.test',
    'loadtest_' || i,
    'Load Bot ' || i,
    '$2a$10$p4AFnmzWFzxZqZW6I0IguOsJdQnw2/lbN/N9SAh7Z6jrojspMedZa',
    0,
    now() - (INTERVAL '300 days')
FROM generate_series(0, 49) AS i
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;

-- Temporary table to map index 0..49 to UUID
CREATE TEMP TABLE tmp_load_users AS
SELECT 
    id, 
    email, 
    row_number() OVER (ORDER BY email) - 1 AS bot_idx
FROM users
WHERE email LIKE 'loadtest_%@moodila.test';

-- 2. Friendships (~20 mutual accepted friends for each of the 50 bots)
-- For 50 nodes, connecting each node to (i + j) % 50 for j in 1..20 gives an exact 20-regular graph (500 edges)
INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    u1.id,
    u2.id,
    'accepted',
    now() - INTERVAL '250 days',
    now() - INTERVAL '250 days'
FROM tmp_load_users u1
CROSS JOIN tmp_load_users u2
WHERE u1.bot_idx < u2.bot_idx
  AND (
    (u2.bot_idx - u1.bot_idx) <= 10
    OR (u1.bot_idx + 50 - u2.bot_idx) <= 10
  )
ON CONFLICT DO NOTHING;

-- 3. Entries (~200 entries per user over the last 200 days = 10,000 entries)
INSERT INTO entries (id, user_id, date, mood, tags, text, is_hidden, created_at)
SELECT
    gen_random_uuid(),
    u.id,
    (CURRENT_DATE - (d || ' days')::INTERVAL)::date,
    1 + (floor(random() * 5))::int,
    CASE ((d + u.bot_idx) % 5)
        WHEN 0 THEN ARRAY['work', 'productive']
        WHEN 1 THEN ARRAY['rest', 'family']
        WHEN 2 THEN ARRAY['sports', 'energy']
        WHEN 3 THEN ARRAY['creative', 'music']
        ELSE ARRAY['chill', 'reading']
    END,
    'Day log ' || d || ' for bot ' || u.bot_idx || ': feeling good, lots accomplished.',
    (random() < 0.08), -- 8% globally hidden
    now() - (d || ' days')::INTERVAL
FROM tmp_load_users u
CROSS JOIN generate_series(0, 199) AS d
ON CONFLICT (user_id, date) DO NOTHING;

-- 4. Account-level privacy settings (user_friend_visibility)
-- ~10% of friend pairs have hide_by_default enabled
INSERT INTO user_friend_visibility (user_id, friend_id, hide_by_default, created_at, updated_at)
SELECT 
    f.requester_id,
    f.addressee_id,
    true,
    now() - INTERVAL '200 days',
    now() - INTERVAL '200 days'
FROM friendships f
WHERE f.status = 'accepted'
  AND random() < 0.10
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 5. Reactions / Likes (~15,000 reactions across entries)
INSERT INTO likes (entry_id, user_id, reaction, created_at)
SELECT 
    e.id,
    CASE WHEN f.requester_id = e.user_id THEN f.addressee_id ELSE f.requester_id END AS reactor_id,
    (ARRAY['❤️', '🔥', '👏', '😂', '🎉'])[1 + floor(random() * 5)::int],
    e.created_at + INTERVAL '2 hours'
FROM entries e
JOIN friendships f ON (f.requester_id = e.user_id OR f.addressee_id = e.user_id) AND f.status = 'accepted'
WHERE e.is_hidden = false
  AND random() < 0.25
ON CONFLICT (entry_id, user_id, reaction) DO NOTHING;

-- 6. Comments (~5,000 comments across entries)
INSERT INTO comments (id, entry_id, user_id, text, created_at)
SELECT 
    gen_random_uuid(),
    e.id,
    CASE WHEN f.requester_id = e.user_id THEN f.addressee_id ELSE f.requester_id END AS commenter_id,
    (ARRAY[
        'Keep it up!', 
        'Proud of you!', 
        'Nice day!', 
        'Awesome progress 🔥', 
        'Looks fun!'
    ])[1 + floor(random() * 5)::int],
    e.created_at + INTERVAL '3 hours'
FROM entries e
JOIN friendships f ON (f.requester_id = e.user_id OR f.addressee_id = e.user_id) AND f.status = 'accepted'
WHERE e.is_hidden = false
  AND random() < 0.10;

-- 7. Entry-level friend overrides (entry_friend_visibility)
INSERT INTO entry_friend_visibility (entry_id, friend_id, is_hidden, created_at)
SELECT 
    e.id,
    CASE WHEN f.requester_id = e.user_id THEN f.addressee_id ELSE f.requester_id END,
    true,
    e.created_at
FROM entries e
JOIN friendships f ON (f.requester_id = e.user_id OR f.addressee_id = e.user_id) AND f.status = 'accepted'
WHERE e.is_hidden = false
  AND random() < 0.05
ON CONFLICT (entry_id, friend_id) DO NOTHING;

DROP TABLE IF EXISTS tmp_load_users;

COMMIT;

-- Analyze to update PostgreSQL planner statistics
ANALYZE users;
ANALYZE entries;
ANALYZE friendships;
ANALYZE likes;
ANALYZE comments;
ANALYZE user_friend_visibility;
ANALYZE entry_friend_visibility;
