package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// AppFeatures provides global feature flags and seasonal capabilities.
type AppFeatures struct{}

// FeaturesResponse contains the feature availability payload.
type FeaturesResponse struct {
	HalloweenEnabled bool      `json:"halloween_enabled"`
	ServerTime       time.Time `json:"server_time"`
}

// IsHalloweenSeasonAvailable determines if the Halloween theme feature is currently active.
// Active throughout October and early November (until Nov 5th at 00:00:00).
// On and after November 5th at 00:00:00, it returns false.
func IsHalloweenSeasonAvailable(t time.Time) bool {
	month := t.Month()
	day := t.Day()

	if month == time.October {
		return true
	}
	if month == time.November && day < 5 {
		return true
	}
	return false
}

// Get handles GET /app/features and GET /features.
func (h AppFeatures) Get(c *gin.Context) {
	now := time.Now()

	// Allow mock date header for integration testing
	if mockHeader := c.GetHeader("X-Mock-Date"); mockHeader != "" {
		if parsed, err := time.Parse(time.RFC3339, mockHeader); err == nil {
			now = parsed
		} else if parsed, err := time.Parse("2006-01-02", mockHeader); err == nil {
			now = parsed
		}
	}

	c.JSON(http.StatusOK, FeaturesResponse{
		HalloweenEnabled: IsHalloweenSeasonAvailable(now),
		ServerTime:       now.UTC(),
	})
}
