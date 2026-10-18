package repository

import (
	"context"
	"errors"
	"fmt"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrCannotBlockSelf = errors.New("cannot block yourself")
)

type Blocks struct {
	Pool *pgxpool.Pool
}

func (r Blocks) Block(ctx context.Context, blockerID, blockedID string) error {
	if r.Pool == nil {
		return errors.New("database pool unavailable")
	}
	if blockerID == blockedID {
		return ErrCannotBlockSelf
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Insert into user_blocks
	_, err = tx.Exec(ctx, `
		INSERT INTO user_blocks (blocker_id, blocked_id)
		VALUES ($1, $2)
		ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
		blockerID, blockedID,
	)
	if err != nil {
		return fmt.Errorf("insert block: %w", err)
	}

	// 2. Remove friendship if existed
	_, err = tx.Exec(ctx, `
		DELETE FROM friendships
		WHERE (requester_id = $1 AND addressee_id = $2)
		   OR (requester_id = $2 AND addressee_id = $1)`,
		blockerID, blockedID,
	)
	if err != nil {
		return fmt.Errorf("delete friendship: %w", err)
	}

	// 3. Clear visibility defaults and overrides
	_, err = tx.Exec(ctx, `
		DELETE FROM user_friend_visibility
		WHERE (user_id = $1 AND friend_id = $2)
		   OR (user_id = $2 AND friend_id = $1)`,
		blockerID, blockedID,
	)
	if err != nil {
		return fmt.Errorf("delete visibility defaults: %w", err)
	}

	_, err = tx.Exec(ctx, `
		DELETE FROM entry_friend_visibility
		WHERE (friend_id = $1 AND entry_id IN (SELECT id FROM entries WHERE user_id = $2))
		   OR (friend_id = $2 AND entry_id IN (SELECT id FROM entries WHERE user_id = $1))`,
		blockerID, blockedID,
	)
	if err != nil {
		return fmt.Errorf("delete visibility overrides: %w", err)
	}

	// 4. Remove mutual notifications
	_, err = tx.Exec(ctx, `
		DELETE FROM notifications
		WHERE (user_id = $1 AND actor_id = $2)
		   OR (user_id = $2 AND actor_id = $1)`,
		blockerID, blockedID,
	)
	if err != nil {
		return fmt.Errorf("delete notifications: %w", err)
	}

	return tx.Commit(ctx)
}

func (r Blocks) Unblock(ctx context.Context, blockerID, blockedID string) error {
	if r.Pool == nil {
		return errors.New("database pool unavailable")
	}

	cmd, err := r.Pool.Exec(ctx, `
		DELETE FROM user_blocks
		WHERE blocker_id = $1 AND blocked_id = $2`,
		blockerID, blockedID,
	)
	if err != nil {
		return fmt.Errorf("unblock: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("block not found")
	}
	return nil
}

func (r Blocks) ListBlocked(ctx context.Context, blockerID string) ([]models.BlockedUser, error) {
	if r.Pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	rows, err := r.Pool.Query(ctx, `
		SELECT u.id, u.username, u.display_name, u.avatar_url, b.created_at
		FROM user_blocks b
		JOIN users u ON u.id = b.blocked_id
		WHERE b.blocker_id = $1
		ORDER BY b.created_at DESC`,
		blockerID,
	)
	if err != nil {
		return nil, fmt.Errorf("list blocked: %w", err)
	}
	defer rows.Close()

	var list []models.BlockedUser
	for rows.Next() {
		var u models.BlockedUser
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.AvatarURL, &u.BlockedAt); err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	if list == nil {
		list = []models.BlockedUser{}
	}
	return list, nil
}

func (r Blocks) IsBlockedBetween(ctx context.Context, userA, userB string) (bool, error) {
	if r.Pool == nil {
		return false, errors.New("database pool unavailable")
	}

	var exists bool
	err := r.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM user_blocks
			WHERE (blocker_id = $1 AND blocked_id = $2)
			   OR (blocker_id = $2 AND blocked_id = $1)
		)`, userA, userB,
	).Scan(&exists)
	return exists, err
}
