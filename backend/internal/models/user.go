// Package models holds the domain structs that mirror the database schema.
package models

import "time"

// User mirrors the users table. PasswordHash is a pointer/nullable so that
// OAuth-only accounts can be added later without schema changes (BRIEF §4).
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash *string   `json:"-"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"display_name"`
	AvatarURL    *string   `json:"avatar_url"`
	CreatedAt    time.Time `json:"created_at"`
}
