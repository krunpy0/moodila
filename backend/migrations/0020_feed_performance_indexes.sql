-- Migration 0020: Feed query optimization indexes
-- Speeds up feed queries by allowing index scans on user_id with date/created_at ordering,
-- bidirectional friendship lookup by requester_id, and privacy check by friend_id.

CREATE INDEX IF NOT EXISTS idx_entries_user_date 
ON entries (user_id, date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS friendships_requester_status_idx 
ON friendships (requester_id, status);

CREATE INDEX IF NOT EXISTS idx_user_friend_visibility_friend 
ON user_friend_visibility (friend_id, user_id);
