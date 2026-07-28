package repository

import (
	"context"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Users struct {
	Pool *pgxpool.Pool
}

func (r Users) Create(ctx context.Context, email, username, displayName, passwordHash string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO users (email, username, display_name, password_hash)
		VALUES ($1, $2, $3, $4)
		RETURNING id, email, password_hash, username, display_name, avatar_url, created_at`,
		email, username, displayName, passwordHash,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.CreatedAt)
	return user, err
}

func (r Users) ByEmail(ctx context.Context, email string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, username, display_name, avatar_url, created_at
		FROM users WHERE email = $1 OR username = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.CreatedAt)
	return user, err
}

func (r Users) ByID(ctx context.Context, id string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, username, display_name, avatar_url, created_at
		FROM users WHERE id = $1`, id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.CreatedAt)
	return user, err
}

func (r Users) UpdateProfile(ctx context.Context, id string, displayName, avatarURL *string) (models.User, error) {
	var user models.User
	err := r.Pool.QueryRow(ctx, `
		UPDATE users
		SET display_name = COALESCE($2, display_name),
		    avatar_url = CASE WHEN $3::text IS NULL THEN avatar_url ELSE NULLIF($3, '') END
		WHERE id = $1
		RETURNING id, email, password_hash, username, display_name, avatar_url, created_at`,
		id, displayName, avatarURL,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Username, &user.DisplayName, &user.AvatarURL, &user.CreatedAt)
	return user, err
}
