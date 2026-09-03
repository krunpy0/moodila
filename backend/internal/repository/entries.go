package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"moodshare/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound  = errors.New("entry not found")
	ErrForbidden = errors.New("forbidden")
)

// SummaryCache provides thread-safe in-memory caching for month summaries.
// Assumes single-instance deployment.
type SummaryCache struct {
	mu       sync.RWMutex
	items    map[string]summaryCacheItem
	ttl      time.Duration
	maxItems int
	stopChan chan struct{}
}

type summaryCacheItem struct {
	summary   models.EntrySummary
	expiresAt time.Time
}

func NewSummaryCache(ttl time.Duration) *SummaryCache {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	c := &SummaryCache{
		items:    make(map[string]summaryCacheItem),
		ttl:      ttl,
		maxItems: 5000,
		stopChan: make(chan struct{}),
	}
	go c.startCleanup()
	return c
}

func (c *SummaryCache) startCleanup() {
	ticker := time.NewTicker(c.ttl / 2)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			c.cleanupExpired()
		case <-c.stopChan:
			return
		}
	}
}

func (c *SummaryCache) cleanupExpired() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for k, item := range c.items {
		if now.After(item.expiresAt) {
			delete(c.items, k)
		}
	}
}

func (c *SummaryCache) Stop() {
	if c == nil || c.stopChan == nil {
		return
	}
	select {
	case <-c.stopChan:
		// already closed
	default:
		close(c.stopChan)
	}
}

func (c *SummaryCache) Get(key string) (models.EntrySummary, bool) {
	if c == nil {
		return models.EntrySummary{}, false
	}
	c.mu.RLock()
	item, ok := c.items[key]
	c.mu.RUnlock()

	if !ok || time.Now().After(item.expiresAt) {
		return models.EntrySummary{}, false
	}
	return item.summary, true
}

func (c *SummaryCache) Set(key string, summary models.EntrySummary) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	c.items[key] = summaryCacheItem{
		summary:   summary,
		expiresAt: now.Add(c.ttl),
	}
	if len(c.items) > c.maxItems {
		for k, item := range c.items {
			if now.After(item.expiresAt) {
				delete(c.items, k)
			}
		}
	}
}

func (c *SummaryCache) InvalidateUser(userID string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	prefix := userID + ":"
	for k := range c.items {
		if strings.HasPrefix(k, prefix) {
			delete(c.items, k)
		}
	}
	c.mu.Unlock()
}

var defaultSummaryCache = NewSummaryCache(5 * time.Minute)

type Entries struct {
	Pool  *pgxpool.Pool
	Cache *SummaryCache
}

func (r Entries) getCache() *SummaryCache {
	if r.Cache != nil {
		return r.Cache
	}
	return defaultSummaryCache
}

func (r Entries) InvalidateUserCache(userID string) {
	r.getCache().InvalidateUser(userID)
}

func (r Entries) Save(ctx context.Context, userID, date string, mood int, tags []string, text string, photoURL, audioURL *string, audioDuration *int, isHidden *bool, overrides []models.EntryFriendOverride) (models.Entry, bool, []AttachmentURLs, error) {
	var oldAtt AttachmentURLs
	err := r.Pool.QueryRow(ctx, `SELECT photo_url, audio_url FROM entries WHERE user_id = $1 AND date = $2`, userID, date).Scan(&oldAtt.PhotoURL, &oldAtt.AudioURL)
	isNew := errors.Is(err, pgx.ErrNoRows)

	var entry models.Entry
	err = r.Pool.QueryRow(ctx, `
		INSERT INTO entries (user_id, date, mood, tags, text, photo_url, audio_url, audio_duration, is_hidden)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, false))
		ON CONFLICT (user_id, date) DO UPDATE
		SET mood = EXCLUDED.mood,
		    tags = EXCLUDED.tags,
		    text = EXCLUDED.text,
		    photo_url = EXCLUDED.photo_url,
		    audio_url = EXCLUDED.audio_url,
		    audio_duration = EXCLUDED.audio_duration,
		    is_hidden = COALESCE($9, entries.is_hidden)
		RETURNING id, user_id, date::text, mood, tags, text, photo_url, audio_url, audio_duration, is_hidden, created_at`,
		userID, date, mood, tags, text, photoURL, audioURL, audioDuration, isHidden,
	).Scan(
		&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags,
		&entry.Text, &entry.PhotoURL, &entry.AudioURL, &entry.AudioDuration, &entry.IsHidden, &entry.CreatedAt,
	)
	if err != nil {
		return models.Entry{}, false, nil, err
	}

	if overrides != nil {
		_, err = r.Pool.Exec(ctx, `DELETE FROM entry_friend_visibility WHERE entry_id = $1`, entry.ID)
		if err != nil {
			return models.Entry{}, false, nil, err
		}
		for _, ov := range overrides {
			_, err = r.Pool.Exec(ctx, `
				INSERT INTO entry_friend_visibility (entry_id, friend_id, is_hidden)
				VALUES ($1, $2, $3)
				ON CONFLICT (entry_id, friend_id) DO UPDATE SET is_hidden = EXCLUDED.is_hidden`,
				entry.ID, ov.FriendID, ov.IsHidden,
			)
			if err != nil {
				return models.Entry{}, false, nil, err
			}
		}
	}

	ovRows, err := r.Pool.Query(ctx, `SELECT friend_id, is_hidden FROM entry_friend_visibility WHERE entry_id = $1`, entry.ID)
	if err != nil {
		return models.Entry{}, false, nil, err
	}
	defer ovRows.Close()
	entry.FriendOverrides = make([]models.EntryFriendOverride, 0)
	for ovRows.Next() {
		var ov models.EntryFriendOverride
		if err := ovRows.Scan(&ov.FriendID, &ov.IsHidden); err != nil {
			return models.Entry{}, false, nil, err
		}
		entry.FriendOverrides = append(entry.FriendOverrides, ov)
	}
	entry.HasCustomVisibility = len(entry.FriendOverrides) > 0

	r.getCache().InvalidateUser(userID)

	var replaced []AttachmentURLs
	if oldAtt.PhotoURL != nil && *oldAtt.PhotoURL != "" {
		if entry.PhotoURL == nil || *entry.PhotoURL != *oldAtt.PhotoURL {
			replaced = append(replaced, AttachmentURLs{PhotoURL: oldAtt.PhotoURL})
		}
	}
	if oldAtt.AudioURL != nil && *oldAtt.AudioURL != "" {
		if entry.AudioURL == nil || *entry.AudioURL != *oldAtt.AudioURL {
			replaced = append(replaced, AttachmentURLs{AudioURL: oldAtt.AudioURL})
		}
	}

	return entry, isNew, replaced, nil
}

func (r Entries) ByDate(ctx context.Context, userID, date string) (models.Entry, error) {
	var entry models.Entry
	err := r.Pool.QueryRow(ctx, `
		SELECT id, user_id, date::text, mood, tags, text, photo_url, audio_url, audio_duration, is_hidden,
		       EXISTS(SELECT 1 FROM entry_friend_visibility efv WHERE efv.entry_id = entries.id) AS has_custom_visibility,
		       created_at
		FROM entries
		WHERE user_id = $1 AND date = $2`,
		userID, date,
	).Scan(
		&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags,
		&entry.Text, &entry.PhotoURL, &entry.AudioURL, &entry.AudioDuration, &entry.IsHidden, &entry.HasCustomVisibility, &entry.CreatedAt,
	)
	if err != nil {
		return models.Entry{}, err
	}

	rows, err := r.Pool.Query(ctx, `SELECT friend_id, is_hidden FROM entry_friend_visibility WHERE entry_id = $1`, entry.ID)
	if err != nil {
		return entry, err
	}
	defer rows.Close()

	entry.FriendOverrides = make([]models.EntryFriendOverride, 0)
	for rows.Next() {
		var ov models.EntryFriendOverride
		if err := rows.Scan(&ov.FriendID, &ov.IsHidden); err != nil {
			return entry, err
		}
		entry.FriendOverrides = append(entry.FriendOverrides, ov)
	}
	entry.HasCustomVisibility = len(entry.FriendOverrides) > 0
	return entry, rows.Err()
}

func (r Entries) Recent(ctx context.Context, userID string, limit int) ([]models.Entry, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, user_id, date::text, mood, tags, text, photo_url, audio_url, audio_duration, is_hidden,
		       EXISTS(SELECT 1 FROM entry_friend_visibility efv WHERE efv.entry_id = entries.id) AS has_custom_visibility,
		       created_at
		FROM entries WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := make([]models.Entry, 0)
	for rows.Next() {
		var entry models.Entry
		if err := rows.Scan(&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.AudioURL, &entry.AudioDuration, &entry.IsHidden, &entry.HasCustomVisibility, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (r Entries) ByMonth(ctx context.Context, userID, month, nextMonth string) ([]models.CalendarEntry, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT date::text, mood, tags, text, photo_url, audio_url, audio_duration, is_hidden,
		       EXISTS(SELECT 1 FROM entry_friend_visibility efv WHERE efv.entry_id = entries.id) AS has_custom_visibility,
		       created_at
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
		if err := rows.Scan(&entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.AudioURL, &entry.AudioDuration, &entry.IsHidden, &entry.HasCustomVisibility, &entry.CreatedAt); err != nil {
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

func (r Entries) VisibleByMonth(ctx context.Context, authorID, viewerID, month, nextMonth string) ([]models.CalendarEntry, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT e.date::text, e.mood, e.tags, e.text, e.photo_url, e.audio_url, e.audio_duration, false AS is_hidden, false AS has_custom_visibility, e.created_at
		FROM entries e
		LEFT JOIN entry_friend_visibility efv ON efv.entry_id = e.id AND efv.friend_id = $2
		LEFT JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = $2
		WHERE e.user_id = $1
		  AND e.is_hidden = false
		  AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
		  AND e.date >= $3 AND e.date < $4
		ORDER BY e.date`,
		authorID, viewerID, month+"-01", nextMonth+"-01",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]models.CalendarEntry, 0)
	for rows.Next() {
		var entry models.CalendarEntry
		if err := rows.Scan(&entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.AudioURL, &entry.AudioDuration, &entry.IsHidden, &entry.HasCustomVisibility, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (r Entries) Summary(ctx context.Context, userID, month, nextMonth string) (models.EntrySummary, error) {
	cacheKey := fmt.Sprintf("%s:%s:all", userID, month)
	if cached, ok := r.getCache().Get(cacheKey); ok {
		return cached, nil
	}

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
	if err == nil {
		r.getCache().Set(cacheKey, summary)
	}
	return summary, err
}

func (r Entries) VisibleRecent(ctx context.Context, authorID, viewerID string, limit int) ([]models.Entry, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT e.id, e.user_id, e.date::text, e.mood, e.tags, e.text, e.photo_url, e.audio_url, e.audio_duration, e.is_hidden,
		       false AS has_custom_visibility, e.created_at
		FROM entries e
		LEFT JOIN entry_friend_visibility efv ON efv.entry_id = e.id AND efv.friend_id = $2
		LEFT JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = $2
		WHERE e.user_id = $1
		  AND e.is_hidden = false
		  AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
		ORDER BY e.date DESC, e.created_at DESC
		LIMIT $3`, authorID, viewerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := make([]models.Entry, 0)
	for rows.Next() {
		var entry models.Entry
		if err := rows.Scan(&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags, &entry.Text, &entry.PhotoURL, &entry.AudioURL, &entry.AudioDuration, &entry.IsHidden, &entry.HasCustomVisibility, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (r Entries) VisibleSummary(ctx context.Context, authorID, viewerID, month, nextMonth string) (models.EntrySummary, error) {
	cacheKey := fmt.Sprintf("%s:visible:%s:%s", authorID, viewerID, month)
	if cached, ok := r.getCache().Get(cacheKey); ok {
		return cached, nil
	}

	var summary models.EntrySummary
	err := r.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			(
				SELECT e2.mood
				FROM entries e2
				LEFT JOIN entry_friend_visibility efv2 ON efv2.entry_id = e2.id AND efv2.friend_id = $2
				LEFT JOIN user_friend_visibility ufv2 ON ufv2.user_id = e2.user_id AND ufv2.friend_id = $2
				WHERE e2.user_id = $1 AND e2.is_hidden = false
				  AND COALESCE(efv2.is_hidden, ufv2.hide_by_default, false) = false
				  AND e2.date >= $3 AND e2.date < $4
				GROUP BY e2.mood
				ORDER BY COUNT(*) DESC, e2.mood DESC
				LIMIT 1
			),
			(
				SELECT tag
				FROM entries e2
				CROSS JOIN LATERAL UNNEST(e2.tags) AS tags(tag)
				LEFT JOIN entry_friend_visibility efv2 ON efv2.entry_id = e2.id AND efv2.friend_id = $2
				LEFT JOIN user_friend_visibility ufv2 ON ufv2.user_id = e2.user_id AND ufv2.friend_id = $2
				WHERE e2.user_id = $1 AND e2.is_hidden = false
				  AND COALESCE(efv2.is_hidden, ufv2.hide_by_default, false) = false
				  AND e2.date >= $3 AND e2.date < $4
				GROUP BY tag
				ORDER BY COUNT(*) DESC, LOWER(tag)
				LIMIT 1
			)
		FROM entries e
		LEFT JOIN entry_friend_visibility efv ON efv.entry_id = e.id AND efv.friend_id = $2
		LEFT JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = $2
		WHERE e.user_id = $1 AND e.is_hidden = false
		  AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
		  AND e.date >= $3 AND e.date < $4`,
		authorID, viewerID, month+"-01", nextMonth+"-01",
	).Scan(&summary.EntryCount, &summary.DominantMood, &summary.TopTag)
	if err == nil {
		r.getCache().Set(cacheKey, summary)
	}
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
		RETURNING id, user_id, date::text, mood, tags, text, photo_url, audio_url, audio_duration, is_hidden,
		          EXISTS(SELECT 1 FROM entry_friend_visibility WHERE entry_id = $2) AS has_custom_visibility,
		          created_at`,
		isHidden, entryID,
	).Scan(
		&entry.ID, &entry.UserID, &entry.Date, &entry.Mood, &entry.Tags,
		&entry.Text, &entry.PhotoURL, &entry.AudioURL, &entry.AudioDuration, &entry.IsHidden, &entry.HasCustomVisibility, &entry.CreatedAt,
	)

	if err == nil {
		r.getCache().InvalidateUser(userID)
	}
	return entry, err
}


type AttachmentURLs struct {
	PhotoURL *string
	AudioURL *string
}

func (r Entries) Delete(ctx context.Context, entryID, userID string) ([]AttachmentURLs, error) {
	rows, err := r.Pool.Query(ctx, `
		DELETE FROM entries WHERE id = $1 AND user_id = $2
		RETURNING photo_url, audio_url`, entryID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []AttachmentURLs
	for rows.Next() {
		var att AttachmentURLs
		if err := rows.Scan(&att.PhotoURL, &att.AudioURL); err != nil {
			return nil, err
		}
		attachments = append(attachments, att)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(attachments) == 0 {
		return nil, ErrNotFound
	}
	r.getCache().InvalidateUser(userID)
	return attachments, nil
}

func (r Entries) DeleteByDate(ctx context.Context, userID, date string) ([]AttachmentURLs, error) {
	rows, err := r.Pool.Query(ctx, `
		DELETE FROM entries WHERE user_id = $1 AND date = $2
		RETURNING photo_url, audio_url`, userID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []AttachmentURLs
	for rows.Next() {
		var att AttachmentURLs
		if err := rows.Scan(&att.PhotoURL, &att.AudioURL); err != nil {
			return nil, err
		}
		attachments = append(attachments, att)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(attachments) == 0 {
		return nil, ErrNotFound
	}
	r.getCache().InvalidateUser(userID)
	return attachments, nil
}


