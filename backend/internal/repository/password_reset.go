package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidOrExpiredToken = errors.New("invalid or expired reset token")
)

type PasswordReset struct {
	Pool *pgxpool.Pool
}

// Create invalidates any existing active reset tokens for userID, then inserts a new token.
func (r PasswordReset) Create(ctx context.Context, userID string, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error) {
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
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("invalidate old tokens: %w", err)
	}

	var token models.PasswordResetToken
	err = tx.QueryRow(ctx, `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, token_hash, created_at, expires_at, used_at`,
		userID, tokenHash, expiresAt,
	).Scan(&token.ID, &token.UserID, &token.TokenHash, &token.CreatedAt, &token.ExpiresAt, &token.UsedAt)
	if err != nil {
		return nil, fmt.Errorf("insert token: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return &token, nil
}

// ResetPassword atomically checks and consumes the token hash, updates the user's password_hash,
// and invalidates any remaining unused tokens for the user within a single transaction.
func (r PasswordReset) ResetPassword(ctx context.Context, tokenHash string, newPassword string) error {
	if r.Pool == nil {
		return errors.New("database pool unavailable")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Atomically mark token as used if it's currently valid (used_at IS NULL AND expires_at > now())
	var userID string
	err = tx.QueryRow(ctx, `
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
		RETURNING user_id`,
		tokenHash,
	).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidOrExpiredToken
		}
		return fmt.Errorf("consume token: %w", err)
	}

	// Update user's password_hash
	cmd, err := tx.Exec(ctx, `
		UPDATE users
		SET password_hash = $2
		WHERE id = $1`,
		userID, string(hash),
	)
	if err != nil {
		return fmt.Errorf("update user password: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("user not found")
	}

	// Invalidate any remaining active tokens for this user
	_, err = tx.Exec(ctx, `
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("invalidate remaining tokens: %w", err)
	}

	return tx.Commit(ctx)
}

// GetValidByHash retrieves a active token record for checking without modifying state.
func (r PasswordReset) GetValidByHash(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error) {
	if r.Pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	var token models.PasswordResetToken
	err := r.Pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, created_at, expires_at, used_at
		FROM password_reset_tokens
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
		tokenHash,
	).Scan(&token.ID, &token.UserID, &token.TokenHash, &token.CreatedAt, &token.ExpiresAt, &token.UsedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidOrExpiredToken
		}
		return nil, err
	}
	return &token, nil
}
