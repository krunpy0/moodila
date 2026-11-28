ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS notify_mood_reminders BOOLEAN NOT NULL DEFAULT true;
