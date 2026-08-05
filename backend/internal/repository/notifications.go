package repository

import (
	"context"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PushSender interface {
	SendToUser(ctx context.Context, userID string, payload models.PushPayload) error
}

type Notifications struct {
	Pool       *pgxpool.Pool
	PushSender PushSender
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
	if err != nil {
		return err
	}

	if r.PushSender != nil {
		var actorName string
		_ = r.Pool.QueryRow(ctx, `SELECT COALESCE(NULLIF(display_name, ''), username) FROM users WHERE id = $1`, actorID).Scan(&actorName)
		if actorName == "" {
			actorName = "Друг"
		}

		payload := models.PushPayload{
			Title: "Moodila",
			URL:   "/feed",
		}

		cnt := ""
		if content != nil {
			cnt = *content
		}

		switch notifType {
		case "like":
			payload.Body = actorName + " поставил(а) реакцию " + cnt
			payload.Tag = "reaction"
			payload.URL = "/feed"
		case "comment":
			payload.Body = actorName + " оставил(а) комментарий: " + cnt
			payload.Tag = "comment"
			payload.URL = "/feed"
		case "friend_request":
			payload.Body = actorName + " отправил(а) вам заявку в друзья"
			payload.Tag = "friend_request"
			payload.URL = "/friends"
		case "friend_accept":
			payload.Body = actorName + " принял(а) вашу заявку в друзья"
			payload.Tag = "friend_accept"
			payload.URL = "/friends"
		default:
			payload.Body = actorName + " отправил(а) вам уведомление"
		}

		_ = r.PushSender.SendToUser(ctx, userID, payload)
	}

	return nil
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
