package repository

import (
	"context"
	"strings"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PushSubscriptions struct {
	Pool *pgxpool.Pool
}

func (r PushSubscriptions) Save(ctx context.Context, userID string, input models.PushSubscriptionInput) error {
	if r.Pool == nil {
		return nil
	}
	locale := strings.ToLower(strings.TrimSpace(input.Locale))
	if locale != "en" && locale != "ru" {
		locale = "ru"
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, locale, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (endpoint) DO UPDATE SET
			user_id = EXCLUDED.user_id,
			p256dh = EXCLUDED.p256dh,
			auth = EXCLUDED.auth,
			locale = EXCLUDED.locale,
			updated_at = NOW()`,
		userID, input.Endpoint, input.Keys.P256dh, input.Keys.Auth, locale,
	)
	if err != nil {
		return err
	}

	// Also sync locale to notification_settings for this user
	_, _ = r.Pool.Exec(ctx, `
		INSERT INTO notification_settings (user_id, locale, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			locale = EXCLUDED.locale,
			updated_at = NOW()`,
		userID, locale,
	)
	return nil
}

func (r PushSubscriptions) UpdateLocale(ctx context.Context, userID, locale string) error {
	if r.Pool == nil {
		return nil
	}
	locale = strings.ToLower(strings.TrimSpace(locale))
	if locale != "en" && locale != "ru" {
		locale = "ru"
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE push_subscriptions
		SET locale = $2, updated_at = NOW()
		WHERE user_id = $1`,
		userID, locale,
	)
	return err
}

func (r PushSubscriptions) DeleteByEndpoint(ctx context.Context, userID, endpoint string) error {
	if r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		DELETE FROM push_subscriptions
		WHERE user_id = $1 AND endpoint = $2`,
		userID, endpoint,
	)
	return err
}

func (r PushSubscriptions) DeleteByEndpointGlobal(ctx context.Context, endpoint string) error {
	if r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		DELETE FROM push_subscriptions
		WHERE endpoint = $1`,
		endpoint,
	)
	return err
}

func (r PushSubscriptions) GetByUserIDs(ctx context.Context, userIDs []string) ([]models.PushSubscription, error) {
	if r.Pool == nil || len(userIDs) == 0 {
		return []models.PushSubscription{}, nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT id, user_id, endpoint, p256dh, auth, COALESCE(locale, 'ru'), created_at, updated_at
		FROM push_subscriptions
		WHERE user_id = ANY($1::uuid[])`,
		userIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subs := make([]models.PushSubscription, 0)
	for rows.Next() {
		var item models.PushSubscription
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Endpoint, &item.P256dh, &item.Auth, &item.Locale, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		subs = append(subs, item)
	}
	return subs, rows.Err()
}

func (r PushSubscriptions) GetByUserID(ctx context.Context, userID string) ([]models.PushSubscription, error) {
	return r.GetByUserIDs(ctx, []string{userID})
}
