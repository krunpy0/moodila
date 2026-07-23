package models

import "time"

type Friendship struct {
	ID          string    `json:"id"`
	RequesterID string    `json:"requester_id"`
	AddresseeID string    `json:"addressee_id"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type FriendUser struct {
	ID            string  `json:"id"`
	Username      string  `json:"username"`
	DisplayName   string  `json:"display_name"`
	AvatarURL     *string `json:"avatar_url"`
	FriendshipID  *string `json:"friendship_id,omitempty"`
	Status        *string `json:"status,omitempty"`
	RequesterIsMe *bool   `json:"requester_is_me,omitempty"`
}
