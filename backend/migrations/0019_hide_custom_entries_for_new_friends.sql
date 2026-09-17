-- 0019_hide_custom_entries_for_new_friends.sql

-- Backfill for existing accepted friendships and custom visibility entries:
-- If the friendship was established/updated after the entry was created,
-- hide the custom entry from that friend.
INSERT INTO entry_friend_visibility (entry_id, friend_id, is_hidden)
SELECT DISTINCT efv.entry_id, f.addressee_id AS friend_id, true
FROM entry_friend_visibility efv
JOIN entries e ON e.id = efv.entry_id
JOIN friendships f ON f.requester_id = e.user_id AND f.status = 'accepted'
WHERE GREATEST(f.created_at, f.updated_at) > e.created_at
ON CONFLICT (entry_id, friend_id) DO NOTHING;

INSERT INTO entry_friend_visibility (entry_id, friend_id, is_hidden)
SELECT DISTINCT efv.entry_id, f.requester_id AS friend_id, true
FROM entry_friend_visibility efv
JOIN entries e ON e.id = efv.entry_id
JOIN friendships f ON f.addressee_id = e.user_id AND f.status = 'accepted'
WHERE GREATEST(f.created_at, f.updated_at) > e.created_at
ON CONFLICT (entry_id, friend_id) DO NOTHING;
