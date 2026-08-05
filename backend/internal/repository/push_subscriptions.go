package repository

import (
	"context"

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
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (endpoint) DO UPDATE SET
			user_id = EXCLUDED.user_id,
			p256dh = EXCLUDED.p256dh,
			auth = EXCLUDED.auth,
			updated_at = NOW()`,
		userID, input.Endpoint, input.Keys.P256dh, input.Keys.Auth,
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

func (r PushSubscriptions) GetByUserID(ctx context.Context, userID string) ([]models.PushSubscription, error) {
	if r.Pool == nil {
		return []models.PushSubscription{}, nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT id, user_id, endpoint, p256dh, auth, created_at, updated_at
		FROM push_subscriptions
		WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subs := make([]models.PushSubscription, 0)
	for rows.Next() {
		var item models.PushSubscription
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Endpoint, &item.P256dh, &item.Auth, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		subs = append(subs, item)
	}
	return subs, rows.Err()
}
