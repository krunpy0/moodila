package repository

import (
	"context"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Feed struct {
	Pool *pgxpool.Pool
}

func (r Feed) List(ctx context.Context, viewerID string) ([]models.FeedEntry, error) {
	rows, err := r.Pool.Query(ctx, feedQuery, viewerID, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]models.FeedEntry, 0)
	for rows.Next() {
		entry, err := scanFeedEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

// Like only allows likes on an entry that remains visible to an accepted friend.
// The unique primary key makes repeated POSTs idempotent.
func (r Feed) Like(ctx context.Context, viewerID, entryID string) (models.LikeResult, error) {
	var result models.LikeResult
	err := r.Pool.QueryRow(ctx, `
		WITH visible_entry AS (
			SELECT e.id
			FROM entries e
			JOIN friendships f ON f.status = 'accepted'
				AND ((f.requester_id = $1 AND f.addressee_id = e.user_id)
					OR (f.addressee_id = $1 AND f.requester_id = e.user_id))
			WHERE e.id = $2 AND e.is_hidden = false
		), inserted AS (
			INSERT INTO likes (entry_id, user_id)
			SELECT id, $1 FROM visible_entry
			ON CONFLICT (entry_id, user_id) DO NOTHING
			RETURNING entry_id
		)
		-- A data-modifying CTE is not visible through the statement's table
		-- snapshot. Include inserted explicitly so the response reflects a
		-- freshly-created like immediately.
		SELECT v.id,
		       COUNT(l.user_id)::int + CASE WHEN EXISTS (SELECT 1 FROM inserted) THEN 1 ELSE 0 END,
		       COALESCE(BOOL_OR(l.user_id = $1), false) OR EXISTS (SELECT 1 FROM inserted)
		FROM visible_entry v
		LEFT JOIN likes l ON l.entry_id = v.id
		GROUP BY v.id`, viewerID, entryID,
	).Scan(&result.EntryID, &result.LikeCount, &result.LikedByMe)
	return result, err
}

const feedQuery = `
	SELECT e.id, e.date::text, e.mood, e.tags, e.text, e.created_at,
	       u.id, u.username, u.display_name, u.avatar_url,
	       COUNT(l.user_id)::int, COALESCE(BOOL_OR(l.user_id = $1), false)
	FROM entries e
	JOIN users u ON u.id = e.user_id
	JOIN friendships f ON f.status = 'accepted'
		AND ((f.requester_id = $2 AND f.addressee_id = e.user_id)
			OR (f.addressee_id = $2 AND f.requester_id = e.user_id))
	LEFT JOIN likes l ON l.entry_id = e.id
	WHERE e.is_hidden = false
	GROUP BY e.id, u.id
	ORDER BY e.date DESC, e.created_at DESC`

type feedRow interface {
	Scan(...any) error
}

func scanFeedEntry(row feedRow) (models.FeedEntry, error) {
	var entry models.FeedEntry
	err := row.Scan(
		&entry.ID, &entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.CreatedAt,
		&entry.Author.ID, &entry.Author.Username, &entry.Author.DisplayName, &entry.Author.AvatarURL,
		&entry.LikeCount, &entry.LikedByMe,
	)
	return entry, err
}
