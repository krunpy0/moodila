package repository

import (
	"context"
	"errors"
	"time"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Announcements struct {
	Pool *pgxpool.Pool
}

type CreateAnnouncementParams struct {
	Title       string
	Body        string
	Severity    models.Severity
	Kind        models.Kind
	DisplayType models.DisplayType
	ExpiresAt   *time.Time
	CTALabel    *string
	CTAURL      *string
	IsPinned    bool
}

type UpdateAnnouncementParams struct {
	Title       string
	Body        string
	Severity    models.Severity
	Kind        models.Kind
	DisplayType models.DisplayType
	ExpiresAt   *time.Time
	CTALabel    *string
	CTAURL      *string
	IsPinned    bool
}

// ActivePromptForUser returns at most ONE interruptive announcement prompt (modal or banner)
// for the given user, based on strict deterministic priority:
// critical > warning > info, then published_at DESC, id DESC.
func (r Announcements) ActivePromptForUser(ctx context.Context, userID string) (*models.Announcement, error) {
	if r.Pool == nil {
		return nil, nil
	}

	query := `
		SELECT a.id, a.title, a.body, a.severity, a.status, a.kind, a.display_type,
		       a.expires_at, a.cta_label, a.cta_url, a.is_pinned, a.created_at, a.published_at, a.updated_at
		FROM announcements a
		JOIN users u ON u.id = $1
		LEFT JOIN announcement_user_state aus ON a.id = aus.announcement_id AND aus.user_id = u.id
		WHERE a.status = 'published'
		  AND a.published_at IS NOT NULL AND a.published_at <= now()
		  AND (a.expires_at IS NULL OR a.expires_at > now())
		  AND a.display_type IN ('modal', 'banner')
		  AND (aus.dismissed_at IS NULL)
		  AND (
		      (a.kind = 'standard' AND a.published_at >= u.created_at)
		      OR
		      (a.kind = 'onboarding' AND u.created_at >= now() - interval '7 days')
		  )
		ORDER BY
		  CASE a.severity
		    WHEN 'critical' THEN 3
		    WHEN 'warning' THEN 2
		    WHEN 'info' THEN 1
		    ELSE 0
		  END DESC,
		  a.published_at DESC,
		  a.id DESC
		LIMIT 1`

	var item models.Announcement
	err := r.Pool.QueryRow(ctx, query, userID).Scan(
		&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.Kind, &item.DisplayType,
		&item.ExpiresAt, &item.CTALabel, &item.CTAURL, &item.IsPinned, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// InboxForUser returns the list of published announcements available to the user,
// including their read and dismissed statuses.
func (r Announcements) InboxForUser(ctx context.Context, userID string) ([]models.InboxAnnouncement, error) {
	if r.Pool == nil {
		return []models.InboxAnnouncement{}, nil
	}

	query := `
		SELECT a.id, a.title, a.body, a.severity, a.status, a.kind, a.display_type,
		       a.expires_at, a.cta_label, a.cta_url, a.is_pinned, a.created_at, a.published_at, a.updated_at,
		       (aus.read_at IS NOT NULL) AS is_read,
		       (aus.dismissed_at IS NOT NULL) AS is_dismissed
		FROM announcements a
		JOIN users u ON u.id = $1
		LEFT JOIN announcement_user_state aus ON a.id = aus.announcement_id AND aus.user_id = u.id
		WHERE a.status = 'published'
		  AND a.published_at IS NOT NULL AND a.published_at <= now()
		  AND (
		      (a.kind = 'standard' AND a.published_at >= u.created_at)
		      OR
		      (a.kind = 'onboarding' AND u.created_at >= now() - interval '7 days')
		  )
		ORDER BY a.is_pinned DESC, a.published_at DESC, a.id DESC`

	rows, err := r.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.InboxAnnouncement, 0)
	for rows.Next() {
		var item models.InboxAnnouncement
		if err := rows.Scan(
			&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.Kind, &item.DisplayType,
			&item.ExpiresAt, &item.CTALabel, &item.CTAURL, &item.IsPinned, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt,
			&item.IsRead, &item.IsDismissed,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

// Dismiss records that the user dismissed an interruptive prompt (modal/banner),
// leaving read_at untouched.
func (r Announcements) Dismiss(ctx context.Context, announcementID, userID string) error {
	if r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO announcement_user_state (announcement_id, user_id, dismissed_at)
		VALUES ($1, $2, now())
		ON CONFLICT (announcement_id, user_id)
		DO UPDATE SET dismissed_at = COALESCE(announcement_user_state.dismissed_at, now())`,
		announcementID, userID,
	)
	return err
}

// MarkAsRead records that the user read/opened the announcement in the inbox/feed.
func (r Announcements) MarkAsRead(ctx context.Context, announcementID, userID string) error {
	if r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO announcement_user_state (announcement_id, user_id, read_at)
		VALUES ($1, $2, now())
		ON CONFLICT (announcement_id, user_id)
		DO UPDATE SET read_at = COALESCE(announcement_user_state.read_at, now())`,
		announcementID, userID,
	)
	return err
}

// AcknowledgeModal records that the user acknowledged the modal,
// setting both dismissed_at and read_at simultaneously.
func (r Announcements) AcknowledgeModal(ctx context.Context, announcementID, userID string) error {
	if r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO announcement_user_state (announcement_id, user_id, dismissed_at, read_at)
		VALUES ($1, $2, now(), now())
		ON CONFLICT (announcement_id, user_id)
		DO UPDATE SET
			dismissed_at = COALESCE(announcement_user_state.dismissed_at, now()),
			read_at = COALESCE(announcement_user_state.read_at, now())`,
		announcementID, userID,
	)
	return err
}

// UnreadForUser is kept for backward compatibility and delegates to ActivePromptForUser.
func (r Announcements) UnreadForUser(ctx context.Context, userID string) ([]models.Announcement, error) {
	prompt, err := r.ActivePromptForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if prompt == nil {
		return []models.Announcement{}, nil
	}
	return []models.Announcement{*prompt}, nil
}

// ListAll returns all announcements for the admin view, including read and dismiss metrics.
func (r Announcements) ListAll(ctx context.Context) ([]models.Announcement, error) {
	if r.Pool == nil {
		return []models.Announcement{}, nil
	}
	query := `
		SELECT a.id, a.title, a.body, a.severity, a.status, a.kind, a.display_type,
		       a.expires_at, a.cta_label, a.cta_url, a.is_pinned, a.created_at, a.published_at, a.updated_at,
		       COUNT(aus.read_at)::int AS reads_count,
		       COUNT(aus.dismissed_at)::int AS dismisses_count
		FROM announcements a
		LEFT JOIN announcement_user_state aus ON a.id = aus.announcement_id
		GROUP BY a.id
		ORDER BY a.created_at DESC`

	rows, err := r.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Announcement, 0)
	for rows.Next() {
		var item models.Announcement
		if err := rows.Scan(
			&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.Kind, &item.DisplayType,
			&item.ExpiresAt, &item.CTALabel, &item.CTAURL, &item.IsPinned, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt,
			&item.ReadsCount, &item.DismissesCount,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

// Create inserts a new announcement record in draft status.
func (r Announcements) Create(ctx context.Context, p CreateAnnouncementParams) (models.Announcement, error) {
	var item models.Announcement
	query := `
		INSERT INTO announcements (title, body, severity, kind, display_type, expires_at, cta_label, cta_url, is_pinned, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
		RETURNING id, title, body, severity, status, kind, display_type, expires_at, cta_label, cta_url, is_pinned, created_at, published_at, updated_at`

	err := r.Pool.QueryRow(ctx, query,
		p.Title, p.Body, p.Severity, p.Kind, p.DisplayType, p.ExpiresAt, p.CTALabel, p.CTAURL, p.IsPinned,
	).Scan(
		&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.Kind, &item.DisplayType,
		&item.ExpiresAt, &item.CTALabel, &item.CTAURL, &item.IsPinned, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt,
	)
	return item, err
}

// Update updates an existing announcement.
func (r Announcements) Update(ctx context.Context, id string, p UpdateAnnouncementParams) (models.Announcement, error) {
	var item models.Announcement
	query := `
		UPDATE announcements
		SET title = $2, body = $3, severity = $4, kind = $5, display_type = $6,
		    expires_at = $7, cta_label = $8, cta_url = $9, is_pinned = $10, updated_at = now()
		WHERE id = $1
		RETURNING id, title, body, severity, status, kind, display_type, expires_at, cta_label, cta_url, is_pinned, created_at, published_at, updated_at`

	err := r.Pool.QueryRow(ctx, query,
		id, p.Title, p.Body, p.Severity, p.Kind, p.DisplayType, p.ExpiresAt, p.CTALabel, p.CTAURL, p.IsPinned,
	).Scan(
		&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.Kind, &item.DisplayType,
		&item.ExpiresAt, &item.CTALabel, &item.CTAURL, &item.IsPinned, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt,
	)
	return item, err
}

// Publish marks an announcement as published and sets published_at to now.
func (r Announcements) Publish(ctx context.Context, id string) (models.Announcement, error) {
	var item models.Announcement
	err := r.Pool.QueryRow(ctx, `
		UPDATE announcements
		SET status = 'published', published_at = now(), updated_at = now()
		WHERE id = $1
		RETURNING id, title, body, severity, status, kind, display_type, expires_at, cta_label, cta_url, is_pinned, created_at, published_at, updated_at`,
		id,
	).Scan(
		&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.Kind, &item.DisplayType,
		&item.ExpiresAt, &item.CTALabel, &item.CTAURL, &item.IsPinned, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt,
	)
	return item, err
}

// Unpublish reverts an announcement back to draft status.
func (r Announcements) Unpublish(ctx context.Context, id string) (models.Announcement, error) {
	var item models.Announcement
	err := r.Pool.QueryRow(ctx, `
		UPDATE announcements
		SET status = 'draft', published_at = NULL, updated_at = now()
		WHERE id = $1
		RETURNING id, title, body, severity, status, kind, display_type, expires_at, cta_label, cta_url, is_pinned, created_at, published_at, updated_at`,
		id,
	).Scan(
		&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.Kind, &item.DisplayType,
		&item.ExpiresAt, &item.CTALabel, &item.CTAURL, &item.IsPinned, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt,
	)
	return item, err
}

// Archive marks an announcement as archived.
func (r Announcements) Archive(ctx context.Context, id string) (models.Announcement, error) {
	var item models.Announcement
	err := r.Pool.QueryRow(ctx, `
		UPDATE announcements
		SET status = 'archived', updated_at = now()
		WHERE id = $1
		RETURNING id, title, body, severity, status, kind, display_type, expires_at, cta_label, cta_url, is_pinned, created_at, published_at, updated_at`,
		id,
	).Scan(
		&item.ID, &item.Title, &item.Body, &item.Severity, &item.Status, &item.Kind, &item.DisplayType,
		&item.ExpiresAt, &item.CTALabel, &item.CTAURL, &item.IsPinned, &item.CreatedAt, &item.PublishedAt, &item.UpdatedAt,
	)
	return item, err
}

// Delete permanently removes an announcement and cascades deletion to user states.
func (r Announcements) Delete(ctx context.Context, id string) error {
	if r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `DELETE FROM announcements WHERE id = $1`, id)
	return err
}

// GetStats returns interaction statistics (who read, who dismissed) for a given announcement.
func (r Announcements) GetStats(ctx context.Context, announcementID string) (*models.AnnouncementStatsResponse, error) {
	if r.Pool == nil {
		return &models.AnnouncementStatsResponse{
			AnnouncementID: announcementID,
			Interactions:   []models.AnnouncementUserInteraction{},
		}, nil
	}

	query := `
		SELECT aus.user_id, u.username, u.display_name, u.avatar_url, aus.dismissed_at, aus.read_at
		FROM announcement_user_state aus
		JOIN users u ON aus.user_id = u.id
		WHERE aus.announcement_id = $1
		ORDER BY COALESCE(aus.read_at, aus.dismissed_at) DESC
		LIMIT 500`

	rows, err := r.Pool.Query(ctx, query, announcementID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	resp := &models.AnnouncementStatsResponse{
		AnnouncementID: announcementID,
		Interactions:   make([]models.AnnouncementUserInteraction, 0),
	}

	for rows.Next() {
		var item models.AnnouncementUserInteraction
		if err := rows.Scan(
			&item.UserID, &item.Username, &item.DisplayName, &item.AvatarURL,
			&item.DismissedAt, &item.ReadAt,
		); err != nil {
			return nil, err
		}
		if item.ReadAt != nil {
			resp.ReadsCount++
		}
		if item.DismissedAt != nil {
			resp.DismissesCount++
		}
		resp.Interactions = append(resp.Interactions, item)
	}

	return resp, rows.Err()
}

