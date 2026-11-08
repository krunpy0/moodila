package repository

import (
	"context"
	"strings"
)

type EntrySearchFilters struct {
	Query, From, To, Cursor string
	Moods                   []int
	Tags                    []string
	Photo, Audio            bool
}

type EntrySearchResult struct {
	ID   string   `json:"id"`
	Date string   `json:"date"`
	Mood int      `json:"mood"`
	Text string   `json:"text"`
	Tags []string `json:"tags"`
}

type EntrySearchPage struct {
	Entries    []EntrySearchResult `json:"entries"`
	NextCursor string              `json:"next_cursor"`
}

func searchPattern(query string) string {
	query = strings.ReplaceAll(strings.ToLower(query), "ё", "е")
	return "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(query) + "%"
}

func (r Entries) Search(ctx context.Context, userID string, f EntrySearchFilters) (EntrySearchPage, error) {
	// One entry per user/date makes date a unique, stable keyset cursor.
	rows, err := r.Pool.Query(ctx, `
 SELECT id, date::text, mood, text, tags FROM entries
 WHERE user_id = $1
 AND ($2 = '' OR replace(lower(text), 'ё', 'е') LIKE $3)
 AND ($4 = '' OR date >= NULLIF($4, '')::date)
 AND ($5 = '' OR date <= NULLIF($5, '')::date)
 AND (cardinality($6::int[]) = 0 OR mood = ANY($6::int[]))
 AND tags @> $7::text[]
 AND (NOT $8::boolean OR NULLIF(photo_url, '') IS NOT NULL)
 AND (NOT $9::boolean OR NULLIF(audio_url, '') IS NOT NULL)
 AND ($10 = '' OR date < NULLIF($10, '')::date)
 ORDER BY date DESC LIMIT 21`, userID, f.Query, searchPattern(f.Query), f.From, f.To, f.Moods, f.Tags, f.Photo, f.Audio, f.Cursor)
	if err != nil {
		return EntrySearchPage{}, err
	}
	defer rows.Close()
	page := EntrySearchPage{Entries: make([]EntrySearchResult, 0, 21)}
	for rows.Next() {
		var entry EntrySearchResult
		if err := rows.Scan(&entry.ID, &entry.Date, &entry.Mood, &entry.Text, &entry.Tags); err != nil {
			return page, err
		}
		page.Entries = append(page.Entries, entry)
	}
	if err := rows.Err(); err != nil {
		return page, err
	}
	if len(page.Entries) > 20 {
		page.Entries = page.Entries[:20]
		page.NextCursor = page.Entries[19].Date
	}
	return page, nil
}

func (r Entries) SearchTags(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.Pool.Query(ctx, `SELECT DISTINCT unnest(tags) AS tag FROM entries WHERE user_id = $1 ORDER BY tag`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tags := make([]string, 0)
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}
