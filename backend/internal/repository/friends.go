package repository

import (
	"context"
	"errors"
	"strings"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUserNotFound = errors.New("user not found")

type Friends struct {
	Pool *pgxpool.Pool
}

func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

func (r Friends) Search(ctx context.Context, userID, query string) ([]models.FriendUser, error) {
	escapedQuery := escapeLike(query)
	prefixPattern := escapedQuery + "%"
	containsPattern := "%" + escapedQuery + "%"

	rows, err := r.Pool.Query(ctx, `
		SELECT u.id, u.username, u.display_name, u.avatar_url,
		       f.id, f.status,
		       CASE WHEN f.id IS NULL THEN NULL ELSE f.requester_id = $1 END
		FROM users u
		LEFT JOIN friendships f ON
			LEAST(f.requester_id, f.addressee_id) = LEAST($1::uuid, u.id)
			AND GREATEST(f.requester_id, f.addressee_id) = GREATEST($1::uuid, u.id)
		WHERE u.id <> $1::uuid
		  AND u.deleted_at IS NULL
		  AND (u.username ILIKE $2 OR u.display_name ILIKE $3)
		ORDER BY
			CASE
				WHEN u.username ILIKE $2 THEN 0
				WHEN u.display_name ILIKE $2 THEN 1
				ELSE 2
			END,
			LOWER(u.display_name),
			u.username
		LIMIT 20`,
		userID, prefixPattern, containsPattern,
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

	var exists bool
	err := r.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL)`, addresseeID).Scan(&exists)
	if err != nil {
		return friendship, err
	}
	if !exists {
		return friendship, ErrUserNotFound
	}

	err = r.Pool.QueryRow(ctx, `
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
		  AND u.deleted_at IS NULL
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
		  AND u.deleted_at IS NULL
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

func (r Friends) GetFriendsVisibilityDefaults(ctx context.Context, userID string) ([]models.FriendVisibilityDefault, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT u.id, u.username, u.display_name, u.avatar_url,
		       COALESCE(ufv.hide_by_default, false) AS hide_by_default
		FROM friendships f
		JOIN users u ON u.id = CASE
			WHEN f.requester_id = $1 THEN f.addressee_id
			ELSE f.requester_id
		END
		LEFT JOIN user_friend_visibility ufv ON ufv.user_id = $1 AND ufv.friend_id = u.id
		WHERE (f.requester_id = $1 OR f.addressee_id = $1)
		  AND f.status = 'accepted'
		  AND u.deleted_at IS NULL
		ORDER BY LOWER(u.display_name), u.username`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	friends := make([]models.FriendVisibilityDefault, 0)
	for rows.Next() {
		var f models.FriendVisibilityDefault
		if err := rows.Scan(&f.ID, &f.Username, &f.DisplayName, &f.AvatarURL, &f.HideByDefault); err != nil {
			return nil, err
		}
		friends = append(friends, f)
	}
	return friends, rows.Err()
}

func (r Friends) SetFriendVisibilityDefault(ctx context.Context, userID, friendID string, hideByDefault bool) error {
	var isFriend bool
	err := r.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM friendships
			WHERE status = 'accepted'
			  AND ((requester_id = $1 AND addressee_id = $2)
			    OR (requester_id = $2 AND addressee_id = $1))
		)`, userID, friendID).Scan(&isFriend)
	if err != nil {
		return err
	}
	if !isFriend {
		return pgx.ErrNoRows
	}

	if !hideByDefault {
		_, err = r.Pool.Exec(ctx, `DELETE FROM user_friend_visibility WHERE user_id = $1 AND friend_id = $2`, userID, friendID)
		return err
	}

	_, err = r.Pool.Exec(ctx, `
		INSERT INTO user_friend_visibility (user_id, friend_id, hide_by_default, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (user_id, friend_id) DO UPDATE
		SET hide_by_default = EXCLUDED.hide_by_default,
		    updated_at = now()`, userID, friendID, hideByDefault)
	return err
}

func (r Friends) Delete(ctx context.Context, userID, targetID string) error {
	var reqID, addrID string
	err := r.Pool.QueryRow(ctx, `
		DELETE FROM friendships
		WHERE status = 'accepted' AND (
			(id = $1 AND (requester_id = $2 OR addressee_id = $2))
			OR (
				LEAST(requester_id, addressee_id) = LEAST($2::uuid, $1::uuid)
				AND GREATEST(requester_id, addressee_id) = GREATEST($2::uuid, $1::uuid)
			)
		)
		RETURNING requester_id, addressee_id`, targetID, userID).Scan(&reqID, &addrID)
	if errors.Is(err, pgx.ErrNoRows) {
		return pgx.ErrNoRows
	}
	if err != nil {
		return err
	}

	// Clean up visibility defaults and entry overrides between former friends
	_, _ = r.Pool.Exec(ctx, `
		DELETE FROM user_friend_visibility
		WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`, reqID, addrID)

	_, _ = r.Pool.Exec(ctx, `
		DELETE FROM entry_friend_visibility
		WHERE (friend_id = $1 AND entry_id IN (SELECT id FROM entries WHERE user_id = $2))
		   OR (friend_id = $2 AND entry_id IN (SELECT id FROM entries WHERE user_id = $1))`, reqID, addrID)

	return nil
}

func (r Friends) CancelRequest(ctx context.Context, requesterID, targetID string) error {
	commandTag, err := r.Pool.Exec(ctx, `
		DELETE FROM friendships
		WHERE status = 'pending'
		  AND requester_id = $1
		  AND (addressee_id = $2 OR id = $2)`, requesterID, targetID)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}


