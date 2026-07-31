package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidOrExpiredDeleteToken = errors.New("invalid or expired account deletion token")
)

type AccountDeletion struct {
	Pool *pgxpool.Pool
}

// Create invalidates any existing active deletion tokens for userID, then inserts a new token.
func (r AccountDeletion) Create(ctx context.Context, userID string, tokenHash string, expiresAt time.Time) (*models.AccountDeletionToken, error) {
	if r.Pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Invalidate previous active tokens for this user
	_, err = tx.Exec(ctx, `
		UPDATE account_deletion_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("invalidate old deletion tokens: %w", err)
	}

	var token models.AccountDeletionToken
	err = tx.QueryRow(ctx, `
		INSERT INTO account_deletion_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, token_hash, created_at, expires_at, used_at`,
		userID, tokenHash, expiresAt,
	).Scan(&token.ID, &token.UserID, &token.TokenHash, &token.CreatedAt, &token.ExpiresAt, &token.UsedAt)
	if err != nil {
		return nil, fmt.Errorf("insert deletion token: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return &token, nil
}

// GetValidByHash retrieves an active token record for checking.
func (r AccountDeletion) GetValidByHash(ctx context.Context, tokenHash string) (*models.AccountDeletionToken, error) {
	if r.Pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	var token models.AccountDeletionToken
	err := r.Pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, created_at, expires_at, used_at
		FROM account_deletion_tokens
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
		tokenHash,
	).Scan(&token.ID, &token.UserID, &token.TokenHash, &token.CreatedAt, &token.ExpiresAt, &token.UsedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidOrExpiredDeleteToken
		}
		return nil, err
	}
	return &token, nil
}

// MarkUsed marks a deletion token as used.
func (r AccountDeletion) MarkUsed(ctx context.Context, tokenID string) error {
	if r.Pool == nil {
		return errors.New("database pool unavailable")
	}

	_, err := r.Pool.Exec(ctx, `
		UPDATE account_deletion_tokens
		SET used_at = now()
		WHERE id = $1`,
		tokenID,
	)
	return err
}
