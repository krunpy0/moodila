package repository

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Feed struct {
	Pool *pgxpool.Pool
}

func (r Feed) List(ctx context.Context, viewerID string, limit int, cursor string, includeSelf bool) ([]models.FeedEntry, string, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	var cursorDate string
	var cursorCreatedAt time.Time
	var cursorID string
	var hasCursor bool

	if cursor != "" {
		decoded, err := base64.StdEncoding.DecodeString(cursor)
		if err == nil {
			parts := strings.Split(string(decoded), "|")
			if len(parts) == 3 {
				cursorDate = parts[0]
				t, err := time.Parse(time.RFC3339Nano, parts[1])
				if err == nil {
					cursorCreatedAt = t
					cursorID = parts[2]
					hasCursor = true
				}
			}
		}
	}

	query := `
		SELECT e.id, e.date::text, e.mood, e.tags, e.text, e.photo_url, e.audio_url, e.audio_duration, e.created_at,
		       u.id, u.username, u.display_name, u.avatar_url,
		       (SELECT COUNT(*)::int FROM likes l WHERE l.entry_id = e.id) AS like_count,
		       EXISTS(SELECT 1 FROM likes l WHERE l.entry_id = e.id AND l.user_id = $1) AS liked_by_me,
		       COALESCE((SELECT reaction FROM likes l WHERE l.entry_id = e.id AND l.user_id = $1 LIMIT 1), '') AS my_reaction,
		       (SELECT COUNT(*)::int FROM comments c WHERE c.entry_id = e.id) AS comment_count
		FROM entries e
		JOIN users u ON u.id = e.user_id`

	if includeSelf {
		query += `
		LEFT JOIN friendships f ON f.status = 'accepted'
			AND ((f.requester_id = $2 AND f.addressee_id = e.user_id)
				OR (f.addressee_id = $2 AND f.requester_id = e.user_id))
		WHERE (e.user_id = $2 OR (f.id IS NOT NULL AND e.is_hidden = false))`
	} else {
		query += `
		JOIN friendships f ON f.status = 'accepted'
			AND ((f.requester_id = $2 AND f.addressee_id = e.user_id)
				OR (f.addressee_id = $2 AND f.requester_id = e.user_id))
		WHERE e.is_hidden = false`
	}

	var args []any
	args = append(args, viewerID, viewerID)

	if hasCursor {
		query += ` AND (e.date, e.created_at, e.id) < ($3, $4, $5)`
		args = append(args, cursorDate, cursorCreatedAt, cursorID)
		query += ` ORDER BY e.date DESC, e.created_at DESC, e.id DESC LIMIT $6`
		args = append(args, limit+1)
	} else {
		query += ` ORDER BY e.date DESC, e.created_at DESC, e.id DESC LIMIT $3`
		args = append(args, limit+1)
	}

	rows, err := r.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	entries := make([]models.FeedEntry, 0)
	for rows.Next() {
		entry, err := scanFeedEntry(rows)
		if err != nil {
			return nil, "", err
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}

	var nextCursor string
	if len(entries) > limit {
		last := entries[limit-1]
		nextCursor = base64.StdEncoding.EncodeToString([]byte(last.Date + "|" + last.CreatedAt.Format(time.RFC3339Nano) + "|" + last.ID))
		entries = entries[:limit]
	}

	return entries, nextCursor, nil
}


func (r Feed) React(ctx context.Context, viewerID, entryID, reaction string) (models.LikeResult, error) {
	if reaction == "" {
		reaction = "❤️"
	}

	var result models.LikeResult
	result.EntryID = entryID

	accessible, err := r.canAccessEntry(ctx, viewerID, entryID)
	if err != nil {
		return result, err
	}
	if !accessible {
		return result, pgx.ErrNoRows
	}

	// Toggle or update reaction
	var existingReaction string
	err = r.Pool.QueryRow(ctx, `SELECT reaction FROM likes WHERE entry_id = $1 AND user_id = $2`, entryID, viewerID).Scan(&existingReaction)

	if errors.Is(err, pgx.ErrNoRows) {
		// Insert new reaction
		_, err = r.Pool.Exec(ctx, `INSERT INTO likes (entry_id, user_id, reaction) VALUES ($1, $2, $3)`, entryID, viewerID, reaction)
	} else if err == nil {
		if existingReaction == reaction {
			// Toggle off if same reaction
			_, err = r.Pool.Exec(ctx, `DELETE FROM likes WHERE entry_id = $1 AND user_id = $2`, entryID, viewerID)
		} else {
			// Update reaction if different
			_, err = r.Pool.Exec(ctx, `UPDATE likes SET reaction = $3 WHERE entry_id = $1 AND user_id = $2`, entryID, viewerID, reaction)
		}
	}
	if err != nil {
		return result, err
	}

	// Get updated stats
	err = r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int,
		       COALESCE(BOOL_OR(user_id = $1), false),
		       COALESCE(MAX(CASE WHEN user_id = $1 THEN reaction END), '')
		FROM likes
		WHERE entry_id = $2`, viewerID, entryID).Scan(&result.LikeCount, &result.LikedByMe, &result.MyReaction)

	return result, err
}

func (r Feed) GetComments(ctx context.Context, viewerID, entryID string) ([]models.Comment, error) {
	accessible, err := r.canAccessEntry(ctx, viewerID, entryID)
	if err != nil || !accessible {
		return nil, pgx.ErrNoRows
	}

	rows, err := r.Pool.Query(ctx, `
		SELECT c.id, c.entry_id, c.user_id, c.text, c.created_at,
		       u.id, u.username, u.display_name, u.avatar_url
		FROM comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.entry_id = $1
		ORDER BY c.created_at ASC`, entryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := make([]models.Comment, 0)
	for rows.Next() {
		var comment models.Comment
		if err := rows.Scan(
			&comment.ID, &comment.EntryID, &comment.UserID, &comment.Text, &comment.CreatedAt,
			&comment.Author.ID, &comment.Author.Username, &comment.Author.DisplayName, &comment.Author.AvatarURL,
		); err != nil {
			return nil, err
		}
		comments = append(comments, comment)
	}
	return comments, rows.Err()
}

func (r Feed) AddComment(ctx context.Context, viewerID, entryID, text string) (models.Comment, error) {
	var comment models.Comment

	accessible, err := r.canAccessEntry(ctx, viewerID, entryID)
	if err != nil || !accessible {
		return comment, pgx.ErrNoRows
	}

	err = r.Pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO comments (entry_id, user_id, text)
			VALUES ($1, $2, $3)
			RETURNING id, entry_id, user_id, text, created_at
		)
		SELECT i.id, i.entry_id, i.user_id, i.text, i.created_at,
		       u.id, u.username, u.display_name, u.avatar_url
		FROM inserted i
		JOIN users u ON u.id = i.user_id`, entryID, viewerID, text).Scan(
		&comment.ID, &comment.EntryID, &comment.UserID, &comment.Text, &comment.CreatedAt,
		&comment.Author.ID, &comment.Author.Username, &comment.Author.DisplayName, &comment.Author.AvatarURL,
	)

	return comment, err
}

func (r Feed) DeleteComment(ctx context.Context, viewerID, commentID string) error {
	commandTag, err := r.Pool.Exec(ctx, `DELETE FROM comments WHERE id = $1 AND user_id = $2`, commentID, viewerID)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r Feed) GetEntryOwner(ctx context.Context, entryID string) (string, error) {
	var ownerID string
	err := r.Pool.QueryRow(ctx, `SELECT user_id FROM entries WHERE id = $1`, entryID).Scan(&ownerID)
	return ownerID, err
}

func (r Feed) canAccessEntry(ctx context.Context, viewerID, entryID string) (bool, error) {
	var accessible bool
	err := r.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM entries e
			LEFT JOIN friendships f ON f.status = 'accepted'
				AND ((f.requester_id = $1 AND f.addressee_id = e.user_id)
					OR (f.addressee_id = $1 AND f.requester_id = e.user_id))
			WHERE e.id = $2
			  AND (
			      e.user_id = $1
			      OR (f.id IS NOT NULL AND e.is_hidden = false)
			  )
		)`, viewerID, entryID).Scan(&accessible)
	return accessible, err
}

const feedQuery = `
	SELECT e.id, e.date::text, e.mood, e.tags, e.text, e.photo_url, e.created_at,
	       u.id, u.username, u.display_name, u.avatar_url,
	       (SELECT COUNT(*)::int FROM likes l WHERE l.entry_id = e.id) AS like_count,
	       EXISTS(SELECT 1 FROM likes l WHERE l.entry_id = e.id AND l.user_id = $1) AS liked_by_me,
	       COALESCE((SELECT reaction FROM likes l WHERE l.entry_id = e.id AND l.user_id = $1 LIMIT 1), '') AS my_reaction,
	       (SELECT COUNT(*)::int FROM comments c WHERE c.entry_id = e.id) AS comment_count
	FROM entries e
	JOIN users u ON u.id = e.user_id
	JOIN friendships f ON f.status = 'accepted'
		AND ((f.requester_id = $2 AND f.addressee_id = e.user_id)
			OR (f.addressee_id = $2 AND f.requester_id = e.user_id))
	WHERE e.is_hidden = false
	ORDER BY e.date DESC, e.created_at DESC`

type feedRow interface {
	Scan(...any) error
}

func scanFeedEntry(row feedRow) (models.FeedEntry, error) {
	var entry models.FeedEntry
	err := row.Scan(
		&entry.ID, &entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.AudioURL, &entry.AudioDuration, &entry.CreatedAt,
		&entry.Author.ID, &entry.Author.Username, &entry.Author.DisplayName, &entry.Author.AvatarURL,
		&entry.LikeCount, &entry.LikedByMe, &entry.MyReaction, &entry.CommentCount,
	)
	return entry, err
}
