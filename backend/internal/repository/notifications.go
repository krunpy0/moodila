package repository

import (
	"context"
	"fmt"

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
		var notifyReactions, notifyComments, notifyFriendRequests bool
		notifyReactions = true
		notifyComments = true
		notifyFriendRequests = true

		err := r.Pool.QueryRow(ctx, `
			SELECT COALESCE(NULLIF(u.display_name, ''), u.username),
			       COALESCE(ns.notify_reactions, true),
			       COALESCE(ns.notify_comments, true),
			       COALESCE(ns.notify_friend_requests, true)
			FROM users u
			LEFT JOIN notification_settings ns ON ns.user_id = $2
			WHERE u.id = $1`,
			actorID, userID,
		).Scan(&actorName, &notifyReactions, &notifyComments, &notifyFriendRequests)
		if err != nil && actorName == "" {
			_ = r.Pool.QueryRow(ctx, `SELECT COALESCE(NULLIF(display_name, ''), username) FROM users WHERE id = $1`, actorID).Scan(&actorName)
		}
		if actorName == "" {
			actorName = "Друг"
		}

		shouldPush := true
		switch notifType {
		case "like":
			shouldPush = notifyReactions
		case "comment":
			shouldPush = notifyComments
		case "friend_request", "friend_accept":
			shouldPush = notifyFriendRequests
		}

		if shouldPush {
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
	}

	return nil
}

func (r Notifications) NotifyNewPost(ctx context.Context, authorID string, entry models.Entry) error {
	if r.Pool == nil || r.PushSender == nil {
		return nil
	}

	var authorName string
	err := r.Pool.QueryRow(ctx, `SELECT COALESCE(NULLIF(display_name, ''), username) FROM users WHERE id = $1`, authorID).Scan(&authorName)
	if err != nil {
		return err
	}
	if authorName == "" {
		authorName = "Друг"
	}

	rows, err := r.Pool.Query(ctx, `
		SELECT f_user.id
		FROM (
			SELECT CASE 
				WHEN requester_id = $1 THEN addressee_id 
				ELSE requester_id 
			END AS friend_id
			FROM friendships
			WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
		) friends
		JOIN users f_user ON f_user.id = friends.friend_id
		LEFT JOIN entry_friend_visibility efv ON efv.entry_id = $2 AND efv.friend_id = f_user.id
		LEFT JOIN user_friend_visibility ufv ON ufv.user_id = $1 AND ufv.friend_id = f_user.id
		LEFT JOIN notification_settings ns ON ns.user_id = f_user.id
		WHERE COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
		  AND COALESCE(ns.notify_new_posts, true) = true
		  AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = f_user.id)
	`, authorID, entry.ID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var friendIDs []string
	for rows.Next() {
		var fID string
		if err := rows.Scan(&fID); err == nil {
			friendIDs = append(friendIDs, fID)
		}
	}

	if len(friendIDs) == 0 {
		return nil
	}

	var recentCount int
	_ = r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM entries
		WHERE user_id = $1
		  AND is_hidden = false
		  AND created_at >= NOW() - INTERVAL '2 hours'
	`, authorID).Scan(&recentCount)
	if recentCount <= 0 {
		recentCount = 1
	}

	body := authorName + " поделился(ась) новой записью"
	if recentCount > 1 {
		body = fmt.Sprintf("%s опубликовал(а) %s", authorName, formatPostsCountRu(recentCount))
	}

	payload := models.PushPayload{
		Title: "Moodila",
		Body:  body,
		Tag:   "new_post_" + authorID,
		URL:   "/feed",
	}

	for _, fID := range friendIDs {
		_ = r.PushSender.SendToUser(ctx, fID, payload)
	}

	return nil
}

func formatPostsCountRu(count int) string {
	rem10 := count % 10
	rem100 := count % 100
	if rem100 >= 11 && rem100 <= 14 {
		return fmt.Sprintf("%d новых записей", count)
	}
	if rem10 == 1 {
		return fmt.Sprintf("%d новую запись", count)
	}
	if rem10 >= 2 && rem10 <= 4 {
		return fmt.Sprintf("%d новые записи", count)
	}
	return fmt.Sprintf("%d новых записей", count)
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

// DeleteOlderThanBatch deletes up to batchSize notifications older than the given number of days.
func (r Notifications) DeleteOlderThanBatch(ctx context.Context, days int, batchSize int) (int64, error) {
	if r.Pool == nil {
		return 0, nil
	}
	if days <= 0 {
		days = 30
	}
	if batchSize <= 0 {
		batchSize = 5000
	}

	tag, err := r.Pool.Exec(ctx, `
		WITH to_delete AS (
			SELECT id FROM notifications
			WHERE created_at < NOW() - ($1 * INTERVAL '1 day')
			LIMIT $2
		)
		DELETE FROM notifications
		WHERE id IN (SELECT id FROM to_delete)`,
		days, batchSize,
	)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// PurgeOld deletes all notifications older than days in batches of batchSize.
func (r Notifications) PurgeOld(ctx context.Context, days int, batchSize int) (int64, error) {
	if r.Pool == nil {
		return 0, nil
	}
	var total int64
	for {
		deleted, err := r.DeleteOlderThanBatch(ctx, days, batchSize)
		if err != nil {
			return total, err
		}
		total += deleted
		if deleted == 0 {
			break
		}
	}
	return total, nil
}

