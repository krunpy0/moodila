package models

import "time"

// FeedEntry is a public, friend-visible journal entry together with its author
// and the current viewer's like state.
type FeedEntry struct {
	ID            string     `json:"id"`
	Date          string     `json:"date"`
	Mood          int        `json:"mood"`
	Tags          []string   `json:"tags"`
	Text          string     `json:"text"`
	PhotoURL      *string    `json:"photo_url"`
	AudioURL      *string    `json:"audio_url"`
	AudioDuration *int       `json:"audio_duration"`
	CreatedAt     time.Time  `json:"created_at"`
	Author        FeedAuthor `json:"author"`
	LikeCount     int        `json:"like_count"`
	LikedByMe     bool       `json:"liked_by_me"`
	MyReaction    string     `json:"my_reaction"`
	CommentCount  int        `json:"comment_count"`
}

type FeedAuthor struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName string  `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type LikeResult struct {
	EntryID    string `json:"entry_id"`
	LikeCount  int    `json:"like_count"`
	LikedByMe  bool   `json:"liked_by_me"`
	MyReaction string `json:"my_reaction"`
}

type Comment struct {
	ID        string     `json:"id"`
	EntryID   string     `json:"entry_id"`
	UserID    string     `json:"user_id"`
	Text      string     `json:"text"`
	CreatedAt time.Time  `json:"created_at"`
	Author    FeedAuthor `json:"author"`
}

