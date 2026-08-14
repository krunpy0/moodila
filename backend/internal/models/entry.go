package models

import "time"

type EntryFriendOverride struct {
	FriendID string `json:"friend_id"`
	IsHidden bool   `json:"is_hidden"`
}

type Entry struct {
	ID                  string                `json:"id"`
	UserID              string                `json:"user_id"`
	Date                string                `json:"date"`
	Mood                int                   `json:"mood"`
	Tags                []string              `json:"tags"`
	Text                string                `json:"text"`
	PhotoURL            *string               `json:"photo_url"`
	AudioURL            *string               `json:"audio_url"`
	AudioDuration       *int                  `json:"audio_duration"`
	IsHidden            bool                  `json:"is_hidden"`
	HasCustomVisibility bool                  `json:"has_custom_visibility"`
	FriendOverrides     []EntryFriendOverride `json:"friend_overrides,omitempty"`
	CreatedAt           time.Time             `json:"created_at"`
}

type CalendarEntry struct {
	Date                string    `json:"date"`
	Mood                int       `json:"mood"`
	Tags                []string  `json:"tags"`
	Text                string    `json:"text"`
	PhotoURL            *string   `json:"photo_url"`
	AudioURL            *string   `json:"audio_url"`
	AudioDuration       *int      `json:"audio_duration"`
	IsHidden            bool      `json:"is_hidden"`
	HasCustomVisibility bool      `json:"has_custom_visibility"`
	CreatedAt           time.Time `json:"created_at"`
}


type EntrySummary struct {
	EntryCount   int     `json:"entry_count"`
	DominantMood *int    `json:"dominant_mood"`
	TopTag       *string `json:"top_tag"`
}
