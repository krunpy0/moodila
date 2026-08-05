package models

import "time"

type PushSubscriptionKeys struct {
	P256dh string `json:"p256dh"`
	Auth   string `json:"auth"`
}

type PushSubscription struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Endpoint  string    `json:"endpoint"`
	P256dh    string    `json:"p256dh"`
	Auth      string    `json:"auth"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PushSubscriptionInput struct {
	Endpoint string               `json:"endpoint"`
	Keys     PushSubscriptionKeys `json:"keys"`
}

type PushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Icon  string `json:"icon,omitempty"`
	Badge string `json:"badge,omitempty"`
	Tag   string `json:"tag,omitempty"`
	URL   string `json:"url,omitempty"`
}

