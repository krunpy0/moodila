-- ============================================================================
-- Moodila Scaled Database Seed Script for Real Capacity Load Testing
-- Target: 20,000 users (loadtest_0 .. loadtest_19999)
--         Degree distribution: 30-200 friends each (power-law / scale-free)
--         ~300,000 entries across the last 365 days
--         Reactions, comments, account- & post-level privacy overrides
--         All indexes and constraints preserved
--         Finishes with VACUUM ANALYZE for query planner calibration
-- Password for all bot accounts: Password123!
-- ============================================================================

\timing on

-- Wrap data generation in transaction
BEGIN;

-- 1. Create 20,000 Users (loadtest_0 .. loadtest_19999)
-- Precomputed bcrypt hash for 'Password123!' (cost 10):
-- $2a$10$p4AFnmzWFzxZqZW6I0IguOsJdQnw2/lbN/N9SAh7Z6jrojspMedZa
INSERT INTO users (id, email, username, display_name, password_hash, token_version, created_at)
SELECT 
    gen_random_uuid(),
    'loadtest_' || i || '@moodila.test',
    'loadtest_' || i,
    'Load Bot ' || i,
    '$2a$10$p4AFnmzWFzxZqZW6I0IguOsJdQnw2/lbN/N9SAh7Z6jrojspMedZa',
    0,
    now() - INTERVAL '365 days' + ((i % 1000) || ' minutes')::INTERVAL
FROM generate_series(0, 19999) AS i
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;

-- Temporary indexed lookup mapping bot_idx (0..19999) to user UUID
CREATE TEMP TABLE tmp_load_users ON COMMIT DROP AS
SELECT 
    id, 
    email, 
    (substring(username from 10))::int AS bot_idx
FROM users
WHERE email LIKE 'loadtest_%@moodila.test';

CREATE INDEX ON tmp_load_users (bot_idx);
CREATE INDEX ON tmp_load_users (id);

-- 2. Friendships with Power-Law Degree Distribution (30 to 200 friends per user)
-- A. Base ring lattice: connect i to (i + s) % 20000 for s in 1..15
--    This gives exactly 15 outgoing + 15 incoming = 30 friends to EVERY user!
-- B. Extra edges with power-law preferential attachment:
--    Extra counts sampled via random()^3.5 capped to guarantee degree <= 200.
CREATE TEMP TABLE tmp_edges (
    u1_idx int,
    u2_idx int,
    PRIMARY KEY (u1_idx, u2_idx)
) ON COMMIT DROP;

-- Base 30 mutual friends for every user
INSERT INTO tmp_edges (u1_idx, u2_idx)
SELECT 
    LEAST(i, (i + s) % 20000),
    GREATEST(i, (i + s) % 20000)
FROM generate_series(0, 19999) AS i
CROSS JOIN generate_series(1, 15) AS s
ON CONFLICT DO NOTHING;

-- Extra power-law edges
CREATE TEMP TABLE tmp_extra_candidates ON COMMIT DROP AS
SELECT 
    LEAST(u.i, target) AS u1,
    GREATEST(u.i, target) AS u2
FROM (
    SELECT 
        i,
        -- Skewed extra count: ~70% get 0-10, ~20% get 10-40, ~10% get 40-80
        floor(power(random(), 3.5) * 85)::int AS extra_count
    FROM generate_series(0, 19999) AS i
) u
CROSS JOIN LATERAL (
    SELECT (u.i + 16 + floor(random() * 19900)::int) % 20000 AS target
    FROM generate_series(1, u.extra_count)
) targets
WHERE u.i <> target;

-- Filter candidate edges to strictly cap maximum extra edges per node <= 85 (guaranteeing max degree <= 200)
INSERT INTO tmp_edges (u1_idx, u2_idx)
SELECT c.u1, c.u2
FROM (
    SELECT u1, u2,
           row_number() OVER (PARTITION BY u1 ORDER BY random()) as rn1,
           row_number() OVER (PARTITION BY u2 ORDER BY random()) as rn2
    FROM (SELECT DISTINCT u1, u2 FROM tmp_extra_candidates) dist_c
) c
WHERE c.rn1 <= 85 AND c.rn2 <= 85
ON CONFLICT DO NOTHING;

-- Insert final friendships into real table
INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    u1.id,
    u2.id,
    'accepted',
    now() - INTERVAL '300 days',
    now() - INTERVAL '300 days'
FROM tmp_edges e
JOIN tmp_load_users u1 ON u1.bot_idx = e.u1_idx
JOIN tmp_load_users u2 ON u2.bot_idx = e.u2_idx
ON CONFLICT DO NOTHING;

-- 3. Entries (~300,000 entries across the last 365 days)
-- Average 15 entries per user over the past year
INSERT INTO entries (id, user_id, date, mood, tags, text, is_hidden, created_at)
SELECT
    gen_random_uuid(),
    u.id,
    (CURRENT_DATE - (floor(random() * 365)::int || ' days')::INTERVAL)::date AS d,
    1 + (floor(random() * 5))::int,
    CASE (floor(random() * 5))::int
        WHEN 0 THEN ARRAY['work', 'productive']
        WHEN 1 THEN ARRAY['rest', 'family']
        WHEN 2 THEN ARRAY['sports', 'energy']
        WHEN 3 THEN ARRAY['creative', 'music']
        ELSE ARRAY['chill', 'reading']
    END,
    'Daily diary entry for user ' || u.bot_idx || ': feeling focused, ongoing progress.',
    (random() < 0.08), -- 8% globally hidden
    now() - (floor(random() * 365)::int || ' days')::INTERVAL
FROM tmp_load_users u
CROSS JOIN LATERAL generate_series(1, 15) AS s
ON CONFLICT (user_id, date) DO NOTHING;

-- 4. Account-level friend visibility default settings (user_friend_visibility)
-- ~10% of friend pairs have hide_by_default enabled
INSERT INTO user_friend_visibility (user_id, friend_id, hide_by_default, created_at, updated_at)
SELECT 
    f.requester_id,
    f.addressee_id,
    true,
    now() - INTERVAL '250 days',
    now() - INTERVAL '250 days'
FROM friendships f
WHERE f.status = 'accepted'
  AND random() < 0.10
LIMIT 50000
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- 5. Entry-level friend overrides (entry_friend_visibility)
-- ~5% of visible entries have explicit friend override
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
LIMIT 40000
ON CONFLICT (entry_id, friend_id) DO NOTHING;

-- 6. Reactions / Likes (~60,000 reactions across visible entries)
INSERT INTO likes (entry_id, user_id, reaction, created_at)
SELECT 
    e.id,
    CASE WHEN f.requester_id = e.user_id THEN f.addressee_id ELSE f.requester_id END AS reactor_id,
    (ARRAY['❤️', '🔥', '👏', '😂', '🎉'])[1 + floor(random() * 5)::int],
    e.created_at + INTERVAL '2 hours'
FROM entries e
JOIN friendships f ON (f.requester_id = e.user_id OR f.addressee_id = e.user_id) AND f.status = 'accepted'
WHERE e.is_hidden = false
  AND random() < 0.15
LIMIT 60000
ON CONFLICT (entry_id, user_id, reaction) DO NOTHING;

-- 7. Comments (~25,000 comments across visible entries)
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
  AND random() < 0.08
LIMIT 25000;

COMMIT;

-- 8. Vacuum Analyze to update PostgreSQL query planner stats and clean up dead tuples
VACUUM ANALYZE users;
VACUUM ANALYZE entries;
VACUUM ANALYZE friendships;
VACUUM ANALYZE likes;
VACUUM ANALYZE comments;
VACUUM ANALYZE user_friend_visibility;
VACUUM ANALYZE entry_friend_visibility;
