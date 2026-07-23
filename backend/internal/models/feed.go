package models

import "time"

// FeedEntry is a public, friend-visible journal entry together with its author
// and the current viewer's like state.
type FeedEntry struct {
	ID        string     `json:"id"`
	Date      string     `json:"date"`
	Mood      int        `json:"mood"`
	Tags      []string   `json:"tags"`
	Text      string     `json:"text"`
	PhotoURL  *string    `json:"photo_url"`
	CreatedAt time.Time  `json:"created_at"`
	Author    FeedAuthor `json:"author"`
	LikeCount int        `json:"like_count"`
	LikedByMe bool       `json:"liked_by_me"`
}

type FeedAuthor struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type LikeResult struct {
	EntryID   string `json:"entry_id"`
	LikeCount int    `json:"like_count"`
	LikedByMe bool   `json:"liked_by_me"`
}
