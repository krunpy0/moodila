package repository

import (
	"context"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Notifications struct {
	Pool *pgxpool.Pool
}

func (r Notifications) Create(ctx context.Context, userID, actorID, notifType string, entityID, content *string) error {
	if r.Pool == nil {
		return nil
	}
	// Don't notify self
	if userID == actorID {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO notifications (user_id, actor_id, type, entity_id, content)
		VALUES ($1, $2, $3, $4, $5)`,
		userID, actorID, notifType, entityID, content,
	)
	return err
}

func (r Notifications) List(ctx context.Context, userID string, limit int) ([]models.Notification, error) {
	if r.Pool == nil {
		return []models.Notification{}, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT n.id, n.user_id, n.actor_id, n.type, n.entity_id, n.content, n.is_read, n.created_at,
		       u.username, u.display_name, u.avatar_url
		FROM notifications n
		JOIN users u ON u.id = n.actor_id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC
		LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Notification, 0)
	for rows.Next() {
		var item models.Notification
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.ActorID, &item.Type, &item.EntityID, &item.Content, &item.IsRead, &item.CreatedAt,
			&item.ActorUsername, &item.ActorDisplayName, &item.ActorAvatarURL,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r Notifications) UnreadCount(ctx context.Context, userID string) (int, error) {
	if r.Pool == nil {
		return 0, nil
	}
	var count int
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM notifications
		WHERE user_id = $1 AND is_read = false`,
		userID,
	).Scan(&count)
	return count, err
}

func (r Notifications) MarkAsRead(ctx context.Context, userID string, ids []string) error {
	if r.Pool == nil {
		return nil
	}
	if len(ids) == 0 {
		_, err := r.Pool.Exec(ctx, `
			UPDATE notifications
			SET is_read = true
			WHERE user_id = $1 AND is_read = false`,
			userID,
		)
		return err
	}

	_, err := r.Pool.Exec(ctx, `
		UPDATE notifications
		SET is_read = true
		WHERE user_id = $1 AND id = ANY($2::uuid[])`,
		userID, ids,
	)
	return err
}
