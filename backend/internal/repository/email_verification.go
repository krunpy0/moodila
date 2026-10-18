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
	ErrInvalidOrExpiredVerificationToken = errors.New("invalid or expired verification token")
)

type EmailVerification struct {
	Pool *pgxpool.Pool
}

// Create invalidates old tokens for user and creates a new one
func (r EmailVerification) Create(ctx context.Context, userID string, tokenHash string, expiresAt time.Time) (*models.EmailVerificationToken, error) {
	if r.Pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE email_verification_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("invalidate old verification tokens: %w", err)
	}

	var token models.EmailVerificationToken
	err = tx.QueryRow(ctx, `
		INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, token_hash, created_at, expires_at, used_at`,
		userID, tokenHash, expiresAt,
	).Scan(&token.ID, &token.UserID, &token.TokenHash, &token.CreatedAt, &token.ExpiresAt, &token.UsedAt)
	if err != nil {
		return nil, fmt.Errorf("insert verification token: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return &token, nil
}

// Verify consumes the token and updates users.email_verified_at in one transaction
func (r EmailVerification) Verify(ctx context.Context, tokenHash string) (string, error) {
	if r.Pool == nil {
		return "", errors.New("database pool unavailable")
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `
		UPDATE email_verification_tokens
		SET used_at = now()
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
		RETURNING user_id`,
		tokenHash,
	).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInvalidOrExpiredVerificationToken
		}
		return "", fmt.Errorf("consume verification token: %w", err)
	}

	cmd, err := tx.Exec(ctx, `
		UPDATE users
		SET email_verified_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		userID,
	)
	if err != nil {
		return "", fmt.Errorf("mark user email verified: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return "", errors.New("user not found")
	}

	// Invalidate any other tokens for this user
	_, err = tx.Exec(ctx, `
		UPDATE email_verification_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL`,
		userID,
	)
	if err != nil {
		return "", fmt.Errorf("invalidate remaining tokens: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("commit verification tx: %w", err)
	}

	return userID, nil
}
