package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidReportEntity = errors.New("invalid entity type: must be 'entry', 'comment', or 'user'")
	ErrInvalidReportReason = errors.New("report reason is required")
)

type Reports struct {
	Pool *pgxpool.Pool
}

func (r Reports) Create(ctx context.Context, reporterID, reportedUserID, entityType string, entityID *string, reason, details string) (*models.ContentReport, error) {
	if r.Pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	entityType = strings.ToLower(strings.TrimSpace(entityType))
	if entityType != "entry" && entityType != "comment" && entityType != "user" {
		return nil, ErrInvalidReportEntity
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, ErrInvalidReportReason
	}
	details = strings.TrimSpace(details)

	var report models.ContentReport
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO content_reports (reporter_id, reported_user_id, entity_type, entity_id, reason, details)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, reporter_id, reported_user_id, entity_type, entity_id, reason, details, status, created_at`,
		reporterID, reportedUserID, entityType, entityID, reason, details,
	).Scan(
		&report.ID, &report.ReporterID, &report.ReportedUserID,
		&report.EntityType, &report.EntityID, &report.Reason,
		&report.Details, &report.Status, &report.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert report: %w", err)
	}

	return &report, nil
}

func (r Reports) ListAdmin(ctx context.Context, status string, limit, offset int) ([]models.AdminReportItem, error) {
	if r.Pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	status = strings.TrimSpace(status)

	query := `
		SELECT 
			r.id,
			r.reporter_id,
			COALESCE(u1.username, ''),
			COALESCE(u1.display_name, ''),
			r.reported_user_id,
			COALESCE(u2.username, ''),
			COALESCE(u2.display_name, ''),
			u2.avatar_url,
			r.entity_type,
			r.entity_id::text,
			r.reason,
			r.details,
			r.status,
			CASE 
				WHEN r.entity_type = 'entry' THEN COALESCE(e.text, '')
				WHEN r.entity_type = 'comment' THEN COALESCE(c.text, '')
				ELSE ''
			END AS content_snippet,
			e.date::text,
			e.mood,
			e.text,
			e.photo_url,
			e.audio_url,
			e.audio_duration,
			COALESCE(e.tags, '{}'::text[]),
			c.text,
			c.entry_id::text,
			CASE
				WHEN r.entity_type = 'entry' AND e.id IS NULL AND r.entity_id IS NOT NULL THEN true
				WHEN r.entity_type = 'comment' AND c.id IS NULL AND r.entity_id IS NOT NULL THEN true
				ELSE false
			END AS is_content_deleted,
			r.created_at
		FROM content_reports r
		JOIN users u1 ON u1.id = r.reporter_id
		JOIN users u2 ON u2.id = r.reported_user_id
		LEFT JOIN entries e ON r.entity_type = 'entry' AND e.id = r.entity_id
		LEFT JOIN comments c ON r.entity_type = 'comment' AND c.id = r.entity_id
		WHERE ($1 = '' OR r.status = $1)
		ORDER BY r.created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.Pool.Query(ctx, query, status, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query reports: %w", err)
	}
	defer rows.Close()

	var reports []models.AdminReportItem
	for rows.Next() {
		var item models.AdminReportItem
		err := rows.Scan(
			&item.ID,
			&item.ReporterID,
			&item.ReporterUsername,
			&item.ReporterDisplayName,
			&item.ReportedUserID,
			&item.ReportedUsername,
			&item.ReportedDisplayName,
			&item.ReportedAvatarURL,
			&item.EntityType,
			&item.EntityID,
			&item.Reason,
			&item.Details,
			&item.Status,
			&item.ContentSnippet,
			&item.EntryDate,
			&item.EntryMood,
			&item.EntryText,
			&item.EntryPhotoURL,
			&item.EntryAudioURL,
			&item.EntryAudioDuration,
			&item.EntryTags,
			&item.CommentText,
			&item.CommentEntryID,
			&item.IsContentDeleted,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan report item: %w", err)
		}
		reports = append(reports, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate reports: %w", err)
	}

	if reports == nil {
		reports = []models.AdminReportItem{}
	}

	return reports, nil
}

func (r Reports) GetReport(ctx context.Context, reportID string) (*models.ContentReport, error) {
	if r.Pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	var report models.ContentReport
	err := r.Pool.QueryRow(ctx, `
		SELECT id, reporter_id, reported_user_id, entity_type, entity_id::text, reason, details, status, created_at
		FROM content_reports
		WHERE id = $1`, reportID,
	).Scan(
		&report.ID, &report.ReporterID, &report.ReportedUserID,
		&report.EntityType, &report.EntityID, &report.Reason,
		&report.Details, &report.Status, &report.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r Reports) DeleteCommentAdmin(ctx context.Context, commentID string) error {
	if r.Pool == nil {
		return errors.New("database pool unavailable")
	}
	_, err := r.Pool.Exec(ctx, `DELETE FROM comments WHERE id = $1`, commentID)
	return err
}

func (r Reports) UpdateStatusAdmin(ctx context.Context, reportID, status string) error {
	if r.Pool == nil {
		return errors.New("database pool unavailable")
	}

	status = strings.TrimSpace(strings.ToLower(status))
	if status != "pending" && status != "reviewed" && status != "dismissed" {
		return errors.New("invalid status: must be 'pending', 'reviewed', or 'dismissed'")
	}

	ct, err := r.Pool.Exec(ctx, `
		UPDATE content_reports
		SET status = $2
		WHERE id = $1
	`, reportID, status)
	if err != nil {
		return fmt.Errorf("update report status: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return errors.New("report not found")
	}

	return nil
}
