-- Migration 0021: Notifications enhancements
-- 1. Support 'new_post' notification type
-- 2. Clean duplicate likes and add unique partial index for like deduplication
-- 3. Partial index for fast mark-as-read by (user_id, entity_id) on unread rows

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('friend_request', 'friend_accept', 'like', 'comment', 'new_post'));

DELETE FROM notifications n1
USING notifications n2
WHERE n1.type = 'like'
  AND n2.type = 'like'
  AND n1.user_id = n2.user_id
  AND n1.actor_id = n2.actor_id
  AND n1.entity_id = n2.entity_id
  AND n1.created_at < n2.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_like_unique
    ON notifications (user_id, actor_id, entity_id)
    WHERE type = 'like';

CREATE INDEX IF NOT EXISTS idx_notifications_user_entity_unread
    ON notifications (user_id, entity_id)
    WHERE is_read = false;
