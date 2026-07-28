package models

import "time"

type Entry struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Date      string    `json:"date"`
	Mood      int       `json:"mood"`
	Tags      []string  `json:"tags"`
	Text      string    `json:"text"`
	PhotoURL  *string   `json:"photo_url"`
	IsHidden  bool      `json:"is_hidden"`
	CreatedAt time.Time `json:"created_at"`
}

type CalendarEntry struct {
	Date      string    `json:"date"`
	Mood      int       `json:"mood"`
	Tags      []string  `json:"tags"`
	Text      string    `json:"text"`
	PhotoURL  *string   `json:"photo_url"`
	IsHidden  bool      `json:"is_hidden"`
	CreatedAt time.Time `json:"created_at"`
}

type EntrySummary struct {
	EntryCount   int     `json:"entry_count"`
	DominantMood *int    `json:"dominant_mood"`
	TopTag       *string `json:"top_tag"`
}
