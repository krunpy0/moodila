-- Create notification_settings table for granular user push preferences
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify_new_posts BOOLEAN NOT NULL DEFAULT true,
    notify_reactions BOOLEAN NOT NULL DEFAULT true,
    notify_comments BOOLEAN NOT NULL DEFAULT true,
    notify_friend_requests BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
