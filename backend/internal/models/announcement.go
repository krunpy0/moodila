package models

import "time"

type Severity string

const (
	SeverityInfo     Severity = "info"
	SeverityWarning  Severity = "warning"
	SeverityCritical Severity = "critical"
)

type Status string

const (
	StatusDraft     Status = "draft"
	StatusPublished Status = "published"
	StatusArchived  Status = "archived"
)

type Announcement struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	Severity    Severity   `json:"severity"`
	Status      Status     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	PublishedAt *time.Time `json:"published_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type AnnouncementRead struct {
	ID             string    `json:"id"`
	AnnouncementID string    `json:"announcement_id"`
	UserID         string    `json:"user_id"`
	ReadAt         time.Time `json:"read_at"`
}
