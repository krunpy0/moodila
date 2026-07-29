package repository

import (
	"context"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Announcements struct {
	Pool *pgxpool.Pool
}

func (r Announcements) UnreadForUser(ctx context.Context, userID string) ([]models.Announcement, error) {
	if r.Pool == nil {
		return []models.Announcement{}, nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT a.id, a.title, a.body, a.severity, a.status, a.created_at, a.published_at, a.updated_at
		FROM announcements a
		LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
		WHERE a.status = 'published' AND ar.id IS NULL
		ORDER BY a.published_at ASC, a.created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Announcement, 0)
	for rows.Next() {
		var item models.Announcement
		if err := rows.Scan(&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r Announcements) MarkAsRead(ctx context.Context, announcementID, userID string) error {
	if r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO announcement_reads (announcement_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (announcement_id, user_id) DO NOTHING`,
		announcementID, userID,
	)
	return err
}

func (r Announcements) ListAll(ctx context.Context) ([]models.Announcement, error) {
	if r.Pool == nil {
		return []models.Announcement{}, nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT id, title, body, severity, status, created_at, published_at, updated_at
		FROM announcements
		ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Announcement, 0)
	for rows.Next() {
		var item models.Announcement
		if err := rows.Scan(&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r Announcements) Create(ctx context.Context, title, body, severity string) (models.Announcement, error) {
	var item models.Announcement
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO announcements (title, body, severity, status)
		VALUES ($1, $2, $3, 'draft')
		RETURNING id, title, body, severity, status, created_at, published_at, updated_at`,
		title, body, severity,
	).Scan(&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt)
	return item, err
}

func (r Announcements) Update(ctx context.Context, id, title, body, severity string) (models.Announcement, error) {
	var item models.Announcement
	err := r.Pool.QueryRow(ctx, `
		UPDATE announcements
		SET title = $2, body = $3, severity = $4, updated_at = now()
		WHERE id = $1
		RETURNING id, title, body, severity, status, created_at, published_at, updated_at`,
		id, title, body, severity,
	).Scan(&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt)
	return item, err
}

func (r Announcements) Publish(ctx context.Context, id string) (models.Announcement, error) {
	var item models.Announcement
	err := r.Pool.QueryRow(ctx, `
		UPDATE announcements
		SET status = 'published', published_at = now(), updated_at = now()
		WHERE id = $1
		RETURNING id, title, body, severity, status, created_at, published_at, updated_at`,
		id,
	).Scan(&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt)
	return item, err
}

func (r Announcements) Archive(ctx context.Context, id string) (models.Announcement, error) {
	var item models.Announcement
	err := r.Pool.QueryRow(ctx, `
		UPDATE announcements
		SET status = 'archived', updated_at = now()
		WHERE id = $1
		RETURNING id, title, body, severity, status, created_at, published_at, updated_at`,
		id,
	).Scan(&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt)
	return item, err
}
