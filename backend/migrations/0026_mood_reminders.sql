ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS time_zone TEXT,
    ADD COLUMN IF NOT EXISTS last_mood_reminder_date DATE;
