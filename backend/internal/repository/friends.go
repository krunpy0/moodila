package repository

import (
	"context"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Friends struct {
	Pool *pgxpool.Pool
}

func (r Friends) Search(ctx context.Context, userID, query string) ([]models.FriendUser, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT u.id, u.username, u.display_name, u.avatar_url,
		       f.id, f.status,
		       CASE WHEN f.id IS NULL THEN NULL ELSE f.requester_id = $1 END
		FROM users u
		LEFT JOIN friendships f ON
			LEAST(f.requester_id, f.addressee_id) = LEAST($1::uuid, u.id)
			AND GREATEST(f.requester_id, f.addressee_id) = GREATEST($1::uuid, u.id)
		WHERE u.id <> $1
		  AND u.username ILIKE $2 || '%'
		ORDER BY u.username
		LIMIT 20`,
		userID, query,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.FriendUser, 0)
	for rows.Next() {
		var user models.FriendUser
		if err := rows.Scan(
			&user.ID, &user.Username, &user.DisplayName, &user.AvatarURL,
			&user.FriendshipID, &user.Status, &user.RequesterIsMe,
		); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (r Friends) Request(ctx context.Context, requesterID, addresseeID string) (models.Friendship, error) {
	var friendship models.Friendship
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO friendships (requester_id, addressee_id)
		VALUES ($1, $2)
		ON CONFLICT (
			LEAST(requester_id, addressee_id),
			GREATEST(requester_id, addressee_id)
		) DO UPDATE
		SET requester_id = EXCLUDED.requester_id,
		    addressee_id = EXCLUDED.addressee_id,
		    status = 'pending',
		    updated_at = now()
		WHERE friendships.status = 'declined'
		RETURNING id, requester_id, addressee_id, status, created_at, updated_at`,
		requesterID, addresseeID,
	).Scan(
		&friendship.ID, &friendship.RequesterID, &friendship.AddresseeID,
		&friendship.Status, &friendship.CreatedAt, &friendship.UpdatedAt,
	)
	return friendship, err
}

func (r Friends) Respond(ctx context.Context, friendshipID, addresseeID, status string) (models.Friendship, error) {
	var friendship models.Friendship
	err := r.Pool.QueryRow(ctx, `
		UPDATE friendships
		SET status = $3, updated_at = now()
		WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
		RETURNING id, requester_id, addressee_id, status, created_at, updated_at`,
		friendshipID, addresseeID, status,
	).Scan(
		&friendship.ID, &friendship.RequesterID, &friendship.AddresseeID,
		&friendship.Status, &friendship.CreatedAt, &friendship.UpdatedAt,
	)
	return friendship, err
}

func (r Friends) Pending(ctx context.Context, userID string) ([]models.FriendUser, error) {
	return r.list(ctx, `
		SELECT u.id, u.username, u.display_name, u.avatar_url, f.id, f.status
		FROM friendships f
		JOIN users u ON u.id = f.requester_id
		WHERE f.addressee_id = $1 AND f.status = 'pending'
		ORDER BY f.created_at DESC`, userID)
}

func (r Friends) Accepted(ctx context.Context, userID string) ([]models.FriendUser, error) {
	return r.list(ctx, `
		SELECT u.id, u.username, u.display_name, u.avatar_url, f.id, f.status
		FROM friendships f
		JOIN users u ON u.id = CASE
			WHEN f.requester_id = $1 THEN f.addressee_id
			ELSE f.requester_id
		END
		WHERE (f.requester_id = $1 OR f.addressee_id = $1)
		  AND f.status = 'accepted'
		ORDER BY LOWER(u.display_name), u.username`, userID)
}

func (r Friends) list(ctx context.Context, query, userID string) ([]models.FriendUser, error) {
	rows, err := r.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.FriendUser, 0)
	for rows.Next() {
		var user models.FriendUser
		if err := rows.Scan(
			&user.ID, &user.Username, &user.DisplayName, &user.AvatarURL,
			&user.FriendshipID, &user.Status,
		); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}
