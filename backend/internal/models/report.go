package models

import "time"

type ContentReport struct {
	ID             string    `json:"id"`
	ReporterID     string    `json:"reporter_id"`
	ReportedUserID string    `json:"reported_user_id"`
	EntityType     string    `json:"entity_type"` // 'entry', 'comment', 'user'
	EntityID       *string   `json:"entity_id,omitempty"`
	Reason         string    `json:"reason"`
	Details        string    `json:"details"`
	Status         string    `json:"status"` // 'pending', 'reviewed', 'dismissed'
	CreatedAt      time.Time `json:"created_at"`
}

type AdminReportItem struct {
	ID                  string    `json:"id"`
	ReporterID          string    `json:"reporter_id"`
	ReporterUsername    string    `json:"reporter_username"`
	ReporterDisplayName string    `json:"reporter_display_name"`
	ReportedUserID      string    `json:"reported_user_id"`
	ReportedUsername    string    `json:"reported_username"`
	ReportedDisplayName string    `json:"reported_display_name"`
	EntityType          string    `json:"entity_type"`
	EntityID            *string   `json:"entity_id,omitempty"`
	Reason              string    `json:"reason"`
	Details             string    `json:"details"`
	Status              string    `json:"status"`
	ContentSnippet      string    `json:"content_snippet"`
	CreatedAt           time.Time `json:"created_at"`
}

