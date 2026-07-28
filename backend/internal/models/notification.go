package models

import "time"

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ActorID   string    `json:"actor_id"`
	Type      string    `json:"type"` // friend_request, friend_accept, like, comment
	EntityID  *string   `json:"entity_id,omitempty"`
	Content   *string   `json:"content,omitempty"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`

	// Actor user details (joined from users)
	ActorUsername    string  `json:"actor_username"`
	ActorDisplayName string  `json:"actor_display_name"`
	ActorAvatarURL   *string `json:"actor_avatar_url"`
}

type NotificationUnreadCount struct {
	UnreadCount int `json:"unread_count"`
}
