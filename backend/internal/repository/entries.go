package repository

import (
	"context"
	"errors"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound  = errors.New("entry not found")
	ErrForbidden = errors.New("forbidden")
)

type Entries struct {
	Pool *pgxpool.Pool
}

func (r Entries) Save(ctx context.Context, userID, date string, mood int, tags []string, text string, photoURL *string, isHidden *bool) (models.Entry, error) {
	var entry models.Entry
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO entries (user_id, date, mood, tags, text, photo_url, is_hidden)
		VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, false))
		ON CONFLICT (user_id, date) DO UPDATE
		SET mood = EXCLUDED.mood,
		    tags = EXCLUDED.tags,
		    text = EXCLUDED.text,
		    photo_url = EXCLUDED.photo_url,
		    is_hidden = COALESCE($7, entries.is_hidden)
		RETURNING id, user_id, date::text, mood, tags, text, photo_url, is_hidden, created_at`,
		userID, date, mood, tags, text, photoURL, isHidden,
	).Scan(
		&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags,
		&entry.Text, &entry.PhotoURL, &entry.IsHidden, &entry.CreatedAt,
	)
	return entry, err
}

func (r Entries) ByDate(ctx context.Context, userID, date string) (models.Entry, error) {
	var entry models.Entry
	err := r.Pool.QueryRow(ctx, `
		SELECT id, user_id, date::text, mood, tags, text, photo_url, is_hidden, created_at
		FROM entries
		WHERE user_id = $1 AND date = $2`,
		userID, date,
	).Scan(
		&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags,
		&entry.Text, &entry.PhotoURL, &entry.IsHidden, &entry.CreatedAt,
	)
	return entry, err
}

func (r Entries) Recent(ctx context.Context, userID string, limit int) ([]models.Entry, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, user_id, date::text, mood, tags, text, photo_url, is_hidden, created_at
		FROM entries WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := make([]models.Entry, 0)
	for rows.Next() {
		var entry models.Entry
		if err := rows.Scan(&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.IsHidden, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (r Entries) ByMonth(ctx context.Context, userID, month, nextMonth string) ([]models.CalendarEntry, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT date::text, mood, tags, text, photo_url, is_hidden, created_at
		FROM entries
		WHERE user_id = $1 AND date >= $2 AND date < $3
		ORDER BY date`,
		userID, month+"-01", nextMonth+"-01",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]models.CalendarEntry, 0)
	for rows.Next() {
		var entry models.CalendarEntry
		if err := rows.Scan(&entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.IsHidden, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (r Entries) CanViewFriend(ctx context.Context, userID, friendID string) (bool, error) {
	var accepted bool
	err := r.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM friendships
			WHERE status = 'accepted'
			  AND ((requester_id = $1 AND addressee_id = $2)
			    OR (requester_id = $2 AND addressee_id = $1))
		)`, userID, friendID).Scan(&accepted)
	return accepted, err
}

func (r Entries) VisibleByMonth(ctx context.Context, userID, month, nextMonth string) ([]models.CalendarEntry, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT date::text, mood, tags, text, photo_url, created_at
		FROM entries
		WHERE user_id = $1
		  AND is_hidden = false
		  AND date >= $2 AND date < $3
		ORDER BY date`,
		userID, month+"-01", nextMonth+"-01",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]models.CalendarEntry, 0)
	for rows.Next() {
		var entry models.CalendarEntry
		if err := rows.Scan(&entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (r Entries) Summary(ctx context.Context, userID, month, nextMonth string) (models.EntrySummary, error) {
	var summary models.EntrySummary
	err := r.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			(
				SELECT mood
				FROM entries
				WHERE user_id = $1 AND date >= $2 AND date < $3
				GROUP BY mood
				ORDER BY COUNT(*) DESC, mood DESC
				LIMIT 1
			),
			(
				SELECT tag
				FROM entries
				CROSS JOIN LATERAL UNNEST(entries.tags) AS tags(tag)
				WHERE user_id = $1 AND date >= $2 AND date < $3
				GROUP BY tag
				ORDER BY COUNT(*) DESC, LOWER(tag)
				LIMIT 1
			)
		FROM entries
		WHERE user_id = $1 AND date >= $2 AND date < $3`,
		userID, month+"-01", nextMonth+"-01",
	).Scan(&summary.EntryCount, &summary.DominantMood, &summary.TopTag)
	return summary, err
}

func (r Entries) VisibleRecent(ctx context.Context, userID string, limit int) ([]models.Entry, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, user_id, date::text, mood, tags, text, photo_url, is_hidden, created_at
		FROM entries
		WHERE user_id = $1 AND is_hidden = false
		ORDER BY date DESC, created_at DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := make([]models.Entry, 0)
	for rows.Next() {
		var entry models.Entry
		if err := rows.Scan(&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.IsHidden, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (r Entries) VisibleSummary(ctx context.Context, userID, month, nextMonth string) (models.EntrySummary, error) {
	var summary models.EntrySummary
	err := r.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			(
				SELECT mood
				FROM entries
				WHERE user_id = $1 AND is_hidden = false AND date >= $2 AND date < $3
				GROUP BY mood
				ORDER BY COUNT(*) DESC, mood DESC
				LIMIT 1
			),
			(
				SELECT tag
				FROM entries
				CROSS JOIN LATERAL UNNEST(entries.tags) AS tags(tag)
				WHERE user_id = $1 AND is_hidden = false AND date >= $2 AND date < $3
				GROUP BY tag
				ORDER BY COUNT(*) DESC, LOWER(tag)
				LIMIT 1
			)
		FROM entries
		WHERE user_id = $1 AND is_hidden = false AND date >= $2 AND date < $3`,
		userID, month+"-01", nextMonth+"-01",
	).Scan(&summary.EntryCount, &summary.DominantMood, &summary.TopTag)
	return summary, err
}

func (r Entries) UpdateVisibility(ctx context.Context, entryID, userID string, isHidden bool) (models.Entry, error) {
	var ownerID string
	err := r.Pool.QueryRow(ctx, `SELECT user_id FROM entries WHERE id = $1`, entryID).Scan(&ownerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Entry{}, ErrNotFound
	}
	if err != nil {
		return models.Entry{}, err
	}
	if ownerID != userID {
		return models.Entry{}, ErrForbidden
	}

	var entry models.Entry
	err = r.Pool.QueryRow(ctx, `
		UPDATE entries
		SET is_hidden = $1
		WHERE id = $2
		RETURNING id, user_id, date::text, mood, tags, text, photo_url, is_hidden, created_at`,
		isHidden, entryID,
	).Scan(
		&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags,
		&entry.Text, &entry.PhotoURL, &entry.IsHidden, &entry.CreatedAt,
	)
	return entry, err
}

func (r Entries) Delete(ctx context.Context, entryID, userID string) error {
	commandTag, err := r.Pool.Exec(ctx, `DELETE FROM entries WHERE id = $1 AND user_id = $2`, entryID, userID)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r Entries) DeleteByDate(ctx context.Context, userID, date string) error {
	commandTag, err := r.Pool.Exec(ctx, `DELETE FROM entries WHERE user_id = $1 AND date = $2`, userID, date)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

