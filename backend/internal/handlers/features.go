package handlers

import (
	"net/http"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// AppFeatures provides global feature flags and seasonal capabilities.
type AppFeatures struct{}

// SeasonalThemeStatus describes the availability of a specific seasonal theme.
type SeasonalThemeStatus struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
}

// FeaturesResponse contains the feature availability payload.
type FeaturesResponse struct {
	ActiveSeasonalThemes []string              `json:"active_seasonal_themes"`
	SeasonalThemes       []SeasonalThemeStatus `json:"seasonal_themes"`
	HalloweenEnabled     bool                  `json:"halloween_enabled"` // Backward compatibility
	ServerTime           time.Time             `json:"server_time"`
}

// SeasonalThemeWindow defines a calendar window for a seasonal theme.
type SeasonalThemeWindow struct {
	ID         string     `json:"id"`
	StartMonth time.Month `json:"-"`
	StartDay   int        `json:"-"`
	EndMonth   time.Month `json:"-"`
	EndDay     int        `json:"-"`
}

// DefaultSeasonalWindows registers the annual seasonal theme windows.
// Adding a new seasonal theme in the future (e.g. new-year, valentines, spring)
// is as simple as adding an entry here.
var DefaultSeasonalWindows = []SeasonalThemeWindow{
	{
		ID:         "halloween",
		StartMonth: time.October,
		StartDay:   21,
		EndMonth:   time.November,
		EndDay:     4, // Active until Nov 4th 00:00:00 (active through Nov 3rd 23:59:59)
	},
	{
		ID:         "new-year",
		StartMonth: time.December,
		StartDay:   15,
		EndMonth:   time.January,
		EndDay:     15, // Active until Jan 15th 00:00:00 (spans across year-end boundary)
	},
}

// IsSeasonalThemeActive checks if a seasonal theme window is currently active for time t.
func IsSeasonalThemeActive(window SeasonalThemeWindow, t time.Time) bool {
	month := t.Month()
	day := t.Day()

	// Normal case: Window within the same calendar year (e.g. Oct 1 -> Nov 5)
	if window.StartMonth < window.EndMonth || (window.StartMonth == window.EndMonth && window.StartDay <= window.EndDay) {
		afterStart := month > window.StartMonth || (month == window.StartMonth && day >= window.StartDay)
		beforeEnd := month < window.EndMonth || (month == window.EndMonth && day < window.EndDay)
		return afterStart && beforeEnd
	}

	// Year wrap-around case: Window spans year boundary (e.g. Dec 15 -> Jan 15)
	afterStart := month > window.StartMonth || (month == window.StartMonth && day >= window.StartDay)
	beforeEnd := month < window.EndMonth || (month == window.EndMonth && day < window.EndDay)
	return afterStart || beforeEnd
}

// GetActiveSeasonalThemeIDs calculates all currently active seasonal theme IDs for time t.
// If SEASONAL_THEMES_OVERRIDE is defined in the environment, it takes precedence.
func GetActiveSeasonalThemeIDs(t time.Time) []string {
	if override := strings.TrimSpace(os.Getenv("SEASONAL_THEMES_OVERRIDE")); override != "" {
		parts := strings.Split(override, ",")
		var list []string
		for _, p := range parts {
			if id := strings.TrimSpace(p); id != "" {
				list = append(list, id)
			}
		}
		if list == nil {
			return []string{}
		}
		return list
	}

	var active []string
	for _, window := range DefaultSeasonalWindows {
		if IsSeasonalThemeActive(window, t) {
			active = append(active, window.ID)
		}
	}
	if active == nil {
		return []string{}
	}
	return active
}

// GetAllSeasonalThemeStatuses returns the statuses for all registered seasonal themes.
func GetAllSeasonalThemeStatuses(t time.Time) []SeasonalThemeStatus {
	active := GetActiveSeasonalThemeIDs(t)
	statuses := make([]SeasonalThemeStatus, 0, len(DefaultSeasonalWindows))
	for _, window := range DefaultSeasonalWindows {
		statuses = append(statuses, SeasonalThemeStatus{
			ID:      window.ID,
			Enabled: slices.Contains(active, window.ID),
		})
	}
	return statuses
}

// IsHalloweenSeasonAvailable determines if the Halloween theme feature is currently active.
// Retained for backwards compatibility with existing code and tests.
func IsHalloweenSeasonAvailable(t time.Time) bool {
	active := GetActiveSeasonalThemeIDs(t)
	return slices.Contains(active, "halloween")
}

// ParseRequestTime parses either normal server time or test X-Mock-Date header.
func ParseRequestTime(c *gin.Context) time.Time {
	now := time.Now()
	if mockHeader := c.GetHeader("X-Mock-Date"); mockHeader != "" {
		if parsed, err := time.Parse(time.RFC3339, mockHeader); err == nil {
			now = parsed
		} else if parsed, err := time.Parse("2006-01-02", mockHeader); err == nil {
			now = parsed
		}
	}
	return now
}

// Get handles GET /app/features and GET /features.
func (h AppFeatures) Get(c *gin.Context) {
	now := ParseRequestTime(c)
	active := GetActiveSeasonalThemeIDs(now)

	c.JSON(http.StatusOK, FeaturesResponse{
		ActiveSeasonalThemes: active,
		SeasonalThemes:       GetAllSeasonalThemeStatuses(now),
		HalloweenEnabled:     slices.Contains(active, "halloween"),
		ServerTime:           now.UTC(),
	})
}

