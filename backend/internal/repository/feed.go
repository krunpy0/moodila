package repository

import (
	"context"
	"encoding/base64"
	"sort"
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
		       0 AS like_count,
		       false AS liked_by_me,
		       '' AS my_reaction,
		       (SELECT COUNT(*)::int FROM comments c WHERE c.entry_id = e.id) AS comment_count
		FROM entries e
		JOIN users u ON u.id = e.user_id`

	if includeSelf {
		query += `
		LEFT JOIN friendships f ON f.status = 'accepted'
			AND ((f.requester_id = $1 AND f.addressee_id = e.user_id)
				OR (f.addressee_id = $1 AND f.requester_id = e.user_id))
		WHERE (e.user_id = $1 OR (f.id IS NOT NULL AND e.is_hidden = false))`
	} else {
		query += `
		JOIN friendships f ON f.status = 'accepted'
			AND ((f.requester_id = $1 AND f.addressee_id = e.user_id)
				OR (f.addressee_id = $1 AND f.requester_id = e.user_id))
		WHERE e.is_hidden = false`
	}

	var args []any
	args = append(args, viewerID)

	if hasCursor {
		query += ` AND (e.date, e.created_at, e.id) < ($2, $3, $4)`
		args = append(args, cursorDate, cursorCreatedAt, cursorID)
		query += ` ORDER BY e.date DESC, e.created_at DESC, e.id DESC LIMIT $5`
		args = append(args, limit+1)
	} else {
		query += ` ORDER BY e.date DESC, e.created_at DESC, e.id DESC LIMIT $2`
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

	if err := r.populateReactions(ctx, viewerID, entries); err != nil {
		return nil, "", err
	}

	return entries, nextCursor, nil
}

func (r Feed) populateReactions(ctx context.Context, viewerID string, entries []models.FeedEntry) error {
	if len(entries) == 0 {
		return nil
	}

	entryIDs := make([]string, len(entries))
	entryMap := make(map[string]*models.FeedEntry, len(entries))
	for i := range entries {
		entryIDs[i] = entries[i].ID
		entries[i].MyReactions = make([]string, 0)
		entries[i].Reactions = make([]models.ReactionCount, 0)
		entryMap[entries[i].ID] = &entries[i]
	}

	rows, err := r.Pool.Query(ctx, `
		SELECT entry_id::text, user_id::text, reaction
		FROM likes
		WHERE entry_id = ANY($1::uuid[])
	`, entryIDs)
	if err != nil {
		return err
	}
	defer rows.Close()

	type reactionAgg struct {
		totalCount  int
		likedByMe   bool
		myReactions []string
		counts      map[string]int
		myReaction  map[string]bool
	}

	aggMap := make(map[string]*reactionAgg, len(entries))

	for rows.Next() {
		var eID, uID, reac string
		if err := rows.Scan(&eID, &uID, &reac); err != nil {
			return err
		}
		agg, exists := aggMap[eID]
		if !exists {
			agg = &reactionAgg{
				counts:     make(map[string]int),
				myReaction: make(map[string]bool),
			}
			aggMap[eID] = agg
		}
		agg.totalCount++
		agg.counts[reac]++
		if uID == viewerID {
			agg.likedByMe = true
			if !agg.myReaction[reac] {
				agg.myReaction[reac] = true
				agg.myReactions = append(agg.myReactions, reac)
			}
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for i := range entries {
		ptr := entryMap[entries[i].ID]
		agg, ok := aggMap[entries[i].ID]
		if !ok {
			ptr.LikeCount = 0
			ptr.LikedByMe = false
			ptr.MyReaction = ""
			ptr.MyReactions = []string{}
			ptr.Reactions = []models.ReactionCount{}
			continue
		}

		ptr.LikeCount = agg.totalCount
		ptr.LikedByMe = agg.likedByMe
		ptr.MyReactions = agg.myReactions
		if len(agg.myReactions) > 0 {
			ptr.MyReaction = agg.myReactions[0]
		} else {
			ptr.MyReaction = ""
		}

		reactionCounts := make([]models.ReactionCount, 0, len(agg.counts))
		for reac, count := range agg.counts {
			reactionCounts = append(reactionCounts, models.ReactionCount{
				Reaction:    reac,
				Count:       count,
				ReactedByMe: agg.myReaction[reac],
			})
		}

		sort.Slice(reactionCounts, func(i, j int) bool {
			if reactionCounts[i].Count == reactionCounts[j].Count {
				return reactionCounts[i].Reaction < reactionCounts[j].Reaction
			}
			return reactionCounts[i].Count > reactionCounts[j].Count
		})
		ptr.Reactions = reactionCounts
	}

	return nil
}

func (r Feed) React(ctx context.Context, viewerID, entryID, reaction string) (models.LikeResult, error) {
	if reaction == "" {
		reaction = "❤️"
	}

	var result models.LikeResult
	result.EntryID = entryID
	result.MyReactions = make([]string, 0)
	result.Reactions = make([]models.ReactionCount, 0)

	accessible, err := r.canAccessEntry(ctx, viewerID, entryID)
	if err != nil {
		return result, err
	}
	if !accessible {
		return result, pgx.ErrNoRows
	}

	var exists bool
	err = r.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM likes WHERE entry_id = $1 AND user_id = $2 AND reaction = $3)`, entryID, viewerID, reaction).Scan(&exists)
	if err != nil {
		return result, err
	}

	if exists {
		_, err = r.Pool.Exec(ctx, `DELETE FROM likes WHERE entry_id = $1 AND user_id = $2 AND reaction = $3`, entryID, viewerID, reaction)
	} else {
		_, err = r.Pool.Exec(ctx, `INSERT INTO likes (entry_id, user_id, reaction) VALUES ($1, $2, $3)`, entryID, viewerID, reaction)
	}
	if err != nil {
		return result, err
	}

	dummyEntries := []models.FeedEntry{{ID: entryID}}
	if err := r.populateReactions(ctx, viewerID, dummyEntries); err != nil {
		return result, err
	}

	result.LikeCount = dummyEntries[0].LikeCount
	result.LikedByMe = dummyEntries[0].LikedByMe
	result.MyReaction = dummyEntries[0].MyReaction
	result.MyReactions = dummyEntries[0].MyReactions
	result.Reactions = dummyEntries[0].Reactions

	return result, nil
}

func (r Feed) GetEntryReactions(ctx context.Context, viewerID, entryID string) ([]models.ReactorUser, error) {
	accessible, err := r.canAccessEntry(ctx, viewerID, entryID)
	if err != nil || !accessible {
		return nil, pgx.ErrNoRows
	}

	rows, err := r.Pool.Query(ctx, `
		SELECT u.id, u.username, u.display_name, u.avatar_url, l.reaction, l.created_at
		FROM likes l
		JOIN users u ON u.id = l.user_id
		WHERE l.entry_id = $1
		ORDER BY l.created_at DESC`, entryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reactors := make([]models.ReactorUser, 0)
	for rows.Next() {
		var ru models.ReactorUser
		if err := rows.Scan(&ru.UserID, &ru.Username, &ru.DisplayName, &ru.AvatarURL, &ru.Reaction, &ru.CreatedAt); err != nil {
			return nil, err
		}
		reactors = append(reactors, ru)
	}
	return reactors, rows.Err()
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

