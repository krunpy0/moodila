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

type Kind string

const (
	KindStandard   Kind = "standard"
	KindOnboarding Kind = "onboarding"
)

type DisplayType string

const (
	DisplayTypeModal    DisplayType = "modal"
	DisplayTypeBanner   DisplayType = "banner"
	DisplayTypeFeedOnly DisplayType = "feed_only"
)

type Announcement struct {
	ID             string      `json:"id"`
	Title          string      `json:"title"`
	Body           string      `json:"body"`
	Severity       Severity    `json:"severity"`
	Status         Status      `json:"status"`
	Kind           Kind        `json:"kind"`
	DisplayType    DisplayType `json:"display_type"`
	ExpiresAt      *time.Time  `json:"expires_at,omitempty"`
	CTALabel       *string     `json:"cta_label,omitempty"`
	CTAURL         *string     `json:"cta_url,omitempty"`
	IsPinned       bool        `json:"is_pinned"`
	CreatedAt      time.Time   `json:"created_at"`
	PublishedAt    *time.Time  `json:"published_at,omitempty"`
	UpdatedAt      time.Time   `json:"updated_at"`
	ReadsCount     int         `json:"reads_count"`
	DismissesCount int         `json:"dismisses_count"`
}

type AnnouncementUserState struct {
	AnnouncementID string     `json:"announcement_id"`
	UserID         string     `json:"user_id"`
	DismissedAt    *time.Time `json:"dismissed_at,omitempty"`
	ReadAt         *time.Time `json:"read_at,omitempty"`
}

type InboxAnnouncement struct {
	Announcement
	IsRead      bool `json:"is_read"`
	IsDismissed bool `json:"is_dismissed"`
}

type AnnouncementUserInteraction struct {
	UserID      string     `json:"user_id"`
	Username    string     `json:"username"`
	DisplayName string     `json:"display_name"`
	AvatarURL   *string    `json:"avatar_url,omitempty"`
	DismissedAt *time.Time `json:"dismissed_at,omitempty"`
	ReadAt      *time.Time `json:"read_at,omitempty"`
}

type AnnouncementStatsResponse struct {
	AnnouncementID string                        `json:"announcement_id"`
	ReadsCount     int                           `json:"reads_count"`
	DismissesCount int                           `json:"dismisses_count"`
	Interactions   []AnnouncementUserInteraction `json:"interactions"`
}

// Legacy struct for backward compatibility
type AnnouncementRead struct {
	ID             string    `json:"id"`
	AnnouncementID string    `json:"announcement_id"`
	UserID         string    `json:"user_id"`
	ReadAt         time.Time `json:"read_at"`
}
