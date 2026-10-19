package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotificationSettings struct {
	Pool *pgxpool.Pool
}

func (r NotificationSettings) GetByUserID(ctx context.Context, userID string) (models.NotificationSettings, error) {
	defaultSettings := models.NotificationSettings{
		UserID:               userID,
		NotifyNewPosts:       true,
		NotifyReactions:      true,
		NotifyComments:       true,
		NotifyFriendRequests: true,
		Locale:               "ru",
		UpdatedAt:            time.Now(),
	}

	if r.Pool == nil {
		return defaultSettings, nil
	}

	var s models.NotificationSettings
	s.UserID = userID
	err := r.Pool.QueryRow(ctx, `
		SELECT notify_new_posts, notify_reactions, notify_comments, notify_friend_requests, COALESCE(locale, 'ru'), updated_at
		FROM notification_settings
		WHERE user_id = $1`,
		userID,
	).Scan(&s.NotifyNewPosts, &s.NotifyReactions, &s.NotifyComments, &s.NotifyFriendRequests, &s.Locale, &s.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return defaultSettings, nil
		}
		return defaultSettings, err
	}

	return s, nil
}

func (r NotificationSettings) Update(ctx context.Context, userID string, input models.NotificationSettingsInput) (models.NotificationSettings, error) {
	defaultSettings := models.NotificationSettings{
		UserID:               userID,
		NotifyNewPosts:       true,
		NotifyReactions:      true,
		NotifyComments:       true,
		NotifyFriendRequests: true,
		Locale:               "ru",
		UpdatedAt:            time.Now(),
	}

	if r.Pool == nil {
		return defaultSettings, nil
	}

	var cleanLocale *string
	if input.Locale != nil {
		loc := strings.ToLower(strings.TrimSpace(*input.Locale))
		if loc == "en" || loc == "ru" {
			cleanLocale = &loc
		}
	}

	var s models.NotificationSettings
	s.UserID = userID

	err := r.Pool.QueryRow(ctx, `
		INSERT INTO notification_settings (user_id, notify_new_posts, notify_reactions, notify_comments, notify_friend_requests, locale, updated_at)
		VALUES (
			$1,
			COALESCE($2, true),
			COALESCE($3, true),
			COALESCE($4, true),
			COALESCE($5, true),
			COALESCE($6, 'ru'),
			NOW()
		)
		ON CONFLICT (user_id) DO UPDATE SET
			notify_new_posts = COALESCE($2, notification_settings.notify_new_posts),
			notify_reactions = COALESCE($3, notification_settings.notify_reactions),
			notify_comments = COALESCE($4, notification_settings.notify_comments),
			notify_friend_requests = COALESCE($5, notification_settings.notify_friend_requests),
			locale = COALESCE($6, notification_settings.locale),
			updated_at = NOW()
		RETURNING notify_new_posts, notify_reactions, notify_comments, notify_friend_requests, locale, updated_at`,
		userID, input.NotifyNewPosts, input.NotifyReactions, input.NotifyComments, input.NotifyFriendRequests, cleanLocale,
	).Scan(&s.NotifyNewPosts, &s.NotifyReactions, &s.NotifyComments, &s.NotifyFriendRequests, &s.Locale, &s.UpdatedAt)

	if err != nil {
		return defaultSettings, err
	}

	if cleanLocale != nil {
		_, _ = r.Pool.Exec(ctx, `
			UPDATE push_subscriptions
			SET locale = $2, updated_at = NOW()
			WHERE user_id = $1`,
			userID, *cleanLocale,
		)
	}

	return s, nil
}
