package repository

import (
	"context"
	"errors"
	"fmt"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Users struct {
	Pool *pgxpool.Pool
}

func (r Users) SetPassword(ctx context.Context, userID string, newPassword string) error {
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

func (r Users) Create(ctx context.Context, email, username, displayName, passwordHash string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO users (email, username, display_name, password_hash)
		VALUES ($1, $2, $3, $4)
		RETURNING id, email, password_hash, username, display_name, avatar_url, is_admin, created_at`,
		email, username, displayName, passwordHash,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.IsAdmin, &user.CreatedAt)
	return user, err
}

func (r Users) ByEmail(ctx context.Context, email string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, username, display_name, avatar_url, is_admin, created_at
		FROM users WHERE email = $1 OR username = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.IsAdmin, &user.CreatedAt)
	return user, err
}

func (r Users) ByExactEmail(ctx context.Context, email string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, username, display_name, avatar_url, is_admin, created_at
		FROM users WHERE LOWER(email) = LOWER($1)`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.IsAdmin, &user.CreatedAt)
	return user, err
}

func (r Users) ByID(ctx context.Context, id string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, username, display_name, avatar_url, is_admin, created_at
		FROM users WHERE id = $1`, id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.IsAdmin, &user.CreatedAt)
	return user, err
}

func (r Users) UpdateProfile(ctx context.Context, id string, displayName, avatarURL *string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		UPDATE users
		SET display_name = COALESCE($2, display_name),
		    avatar_url = CASE WHEN $3::text IS NULL THEN avatar_url ELSE NULLIF($3, '') END
		WHERE id = $1
		RETURNING id, email, password_hash, username, display_name, avatar_url, is_admin, created_at`,
		id, displayName, avatarURL,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.IsAdmin, &user.CreatedAt)
	return user, err
}

func (r Users) DeleteAccount(ctx context.Context, userID string) error {
	if r.Pool == nil {
		return errors.New("database pool unavailable")
	}

	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Soft delete and anonymize user record
	cmd, err := tx.Exec(ctx, `
		UPDATE users
		SET email = 'deleted_' || id || '@deleted.local',
		    username = 'deleted_' || id,
		    display_name = 'Deleted User',
		    avatar_url = NULL,
		    password_hash = NULL,
		    deleted_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("anonymize user: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("user not found or already deleted")
	}

	// 2. Hide all entries belonging to the user
	if _, err = tx.Exec(ctx, `UPDATE entries SET is_hidden = true WHERE user_id = $1`, userID); err != nil {
		return fmt.Errorf("hide entries: %w", err)
	}

	// 3. Delete friendships involving the user
	if _, err = tx.Exec(ctx, `DELETE FROM friendships WHERE requester_id = $1 OR addressee_id = $1`, userID); err != nil {
		return fmt.Errorf("delete friendships: %w", err)
	}

	// 4. Delete incoming notifications (where user is recipient)
	if _, err = tx.Exec(ctx, `DELETE FROM notifications WHERE user_id = $1`, userID); err != nil {
		return fmt.Errorf("delete incoming notifications: %w", err)
	}

	// 5. Delete outgoing friend notifications (where user is actor)
	if _, err = tx.Exec(ctx, `DELETE FROM notifications WHERE actor_id = $1 AND type IN ('friend_request', 'friend_accept')`, userID); err != nil {
		return fmt.Errorf("delete outgoing friend notifications: %w", err)
	}

	// 6. Invalidate active password reset tokens
	if _, err = tx.Exec(ctx, `UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, userID); err != nil {
		return fmt.Errorf("invalidate password reset tokens: %w", err)
	}

	// 7. Invalidate active account deletion tokens
	if _, err = tx.Exec(ctx, `UPDATE account_deletion_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, userID); err != nil {
		return fmt.Errorf("invalidate deletion tokens: %w", err)
	}

	return tx.Commit(ctx)
}
