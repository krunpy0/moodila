package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type MoodReminder struct {
	UserID string
	Locale string
}

func (r NotificationSettings) ClaimMoodReminders(ctx context.Context, now time.Time) ([]MoodReminder, error) {
	rows, err := r.Pool.Query(ctx, `
		WITH local_times AS (
			SELECT s.user_id, s.time_zone, $1::timestamptz AT TIME ZONE s.time_zone AS local_now
			FROM notification_settings s
			WHERE s.time_zone IS NOT NULL
		)
		UPDATE notification_settings s
		SET last_mood_reminder_date = t.local_now::date
		FROM local_times t
		WHERE s.user_id = t.user_id AND s.time_zone = t.time_zone
		  AND s.notify_mood_reminders
		  AND t.local_now::time >= TIME '20:00' AND t.local_now::time < TIME '20:05'
		  AND (s.last_mood_reminder_date IS NULL OR s.last_mood_reminder_date < t.local_now::date)
		  AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = s.user_id)
		  AND NOT EXISTS (
			SELECT 1 FROM entries e WHERE e.user_id = s.user_id AND e.date = t.local_now::date
		  )
		RETURNING s.user_id::text, s.locale`, now)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[MoodReminder])
}
