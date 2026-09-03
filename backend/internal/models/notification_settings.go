package models

import "time"

type NotificationSettings struct {
	UserID               string    `json:"user_id,omitempty"`
	NotifyNewPosts       bool      `json:"notify_new_posts"`
	NotifyReactions      bool      `json:"notify_reactions"`
	NotifyComments       bool      `json:"notify_comments"`
	NotifyFriendRequests bool      `json:"notify_friend_requests"`
	UpdatedAt            time.Time `json:"updated_at,omitempty"`
}

type NotificationSettingsInput struct {
	NotifyNewPosts       *bool `json:"notify_new_posts"`
	NotifyReactions      *bool `json:"notify_reactions"`
	NotifyComments       *bool `json:"notify_comments"`
	NotifyFriendRequests *bool `json:"notify_friend_requests"`
}
