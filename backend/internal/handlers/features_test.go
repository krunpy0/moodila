package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestIsHalloweenSeasonAvailable(t *testing.T) {
	tests := []struct {
		name     string
		date     time.Time
		expected bool
	}{
		{
			name:     "October 20th day before season",
			date:     time.Date(2026, time.October, 20, 23, 59, 59, 0, time.UTC),
			expected: false,
		},
		{
			name:     "October 21st start of season boundary",
			date:     time.Date(2026, time.October, 21, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name:     "October 25th mid-season",
			date:     time.Date(2026, time.October, 25, 12, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name:     "Halloween night October 31st 23:59:59",
			date:     time.Date(2026, time.October, 31, 23, 59, 59, 0, time.UTC),
			expected: true,
		},
		{
			name:     "November 1st inside season",
			date:     time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name:     "November 3rd last active day 23:59:59",
			date:     time.Date(2026, time.November, 3, 23, 59, 59, 0, time.UTC),
			expected: true,
		},
		{
			name:     "November 4th exact boundary 00:00:00 (MUST BE FALSE)",
			date:     time.Date(2026, time.November, 4, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name:     "November 5th mid-day (MUST BE FALSE)",
			date:     time.Date(2026, time.November, 5, 12, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name:     "November 6th (MUST BE FALSE)",
			date:     time.Date(2026, time.November, 6, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name:     "November 30th (MUST BE FALSE)",
			date:     time.Date(2026, time.November, 30, 23, 59, 59, 0, time.UTC),
			expected: false,
		},
		{
			name:     "December 25th (MUST BE FALSE)",
			date:     time.Date(2026, time.December, 25, 12, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name:     "January 1st (MUST BE FALSE)",
			date:     time.Date(2027, time.January, 1, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name:     "September 30th before October (MUST BE FALSE)",
			date:     time.Date(2026, time.September, 30, 23, 59, 59, 0, time.UTC),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsHalloweenSeasonAvailable(tt.date)
			if result != tt.expected {
				t.Errorf("IsHalloweenSeasonAvailable(%v) = %v; want %v", tt.date, result, tt.expected)
			}
		})
	}
}

func TestAppFeaturesHTTPHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := AppFeatures{}
	router.GET("/app/features", handler.Get)

	t.Run("Returns Halloween and active themes when header mock date is in October", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/app/features", nil)
		req.Header.Set("X-Mock-Date", "2026-10-31T20:00:00Z")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}

		var resp FeaturesResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if !resp.HalloweenEnabled {
			t.Errorf("expected HalloweenEnabled=true for Oct 31, got false")
		}
		foundHalloween := false
		for _, theme := range resp.ActiveSeasonalThemes {
			if theme == "halloween" {
				foundHalloween = true
				break
			}
		}
		if !foundHalloween {
			t.Errorf("expected ActiveSeasonalThemes to include 'halloween', got %v", resp.ActiveSeasonalThemes)
		}
	})

	t.Run("Returns New Year and no Halloween when mock date is in late December", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/app/features", nil)
		req.Header.Set("X-Mock-Date", "2026-12-31T23:59:00Z")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}

		var resp FeaturesResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.HalloweenEnabled {
			t.Errorf("expected HalloweenEnabled=false on Dec 31, got true")
		}
		foundNewYear := false
		for _, theme := range resp.ActiveSeasonalThemes {
			if theme == "new-year" {
				foundNewYear = true
				break
			}
		}
		if !foundNewYear {
			t.Errorf("expected ActiveSeasonalThemes to include 'new-year', got %v", resp.ActiveSeasonalThemes)
		}
	})

	t.Run("Returns New Year when mock date is early January", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/app/features", nil)
		req.Header.Set("X-Mock-Date", "2027-01-05T12:00:00Z")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}

		var resp FeaturesResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		foundNewYear := false
		for _, theme := range resp.ActiveSeasonalThemes {
			if theme == "new-year" {
				foundNewYear = true
				break
			}
		}
		if !foundNewYear {
			t.Errorf("expected ActiveSeasonalThemes to include 'new-year', got %v", resp.ActiveSeasonalThemes)
		}
	})

	t.Run("Returns false when header mock date is November 5th 00:00:00", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/app/features", nil)
		req.Header.Set("X-Mock-Date", "2026-11-05T00:00:00Z")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}

		var resp FeaturesResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.HalloweenEnabled {
			t.Errorf("expected HalloweenEnabled=false on Nov 5, got true")
		}
	})

	t.Run("Returns false when header mock date is November 6th", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/app/features", nil)
		req.Header.Set("X-Mock-Date", "2026-11-06T12:00:00Z")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", w.Code)
		}

		var resp FeaturesResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.HalloweenEnabled {
			t.Errorf("expected HalloweenEnabled=false on Nov 6, got true")
		}
	})
}

func TestSeasonalThemeWindows(t *testing.T) {
	newYearWindow := SeasonalThemeWindow{
		ID:         "new-year",
		StartMonth: time.December,
		StartDay:   15,
		EndMonth:   time.January,
		EndDay:     15,
	}

	tests := []struct {
		name     string
		date     time.Time
		expected bool
	}{
		{"Dec 14 before start", time.Date(2026, time.December, 14, 23, 59, 59, 0, time.UTC), false},
		{"Dec 15 start boundary", time.Date(2026, time.December, 15, 0, 0, 0, 0, time.UTC), true},
		{"Dec 31 new year eve", time.Date(2026, time.December, 31, 23, 59, 59, 0, time.UTC), true},
		{"Jan 1 new year day", time.Date(2027, time.January, 1, 0, 0, 0, 0, time.UTC), true},
		{"Jan 14 inside season", time.Date(2027, time.January, 14, 23, 59, 59, 0, time.UTC), true},
		{"Jan 15 end boundary", time.Date(2027, time.January, 15, 0, 0, 0, 0, time.UTC), false},
		{"Jan 16 after season", time.Date(2027, time.January, 16, 12, 0, 0, 0, time.UTC), false},
		{"July 4 summer off-season", time.Date(2026, time.July, 4, 12, 0, 0, 0, time.UTC), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsSeasonalThemeActive(newYearWindow, tt.date)
			if got != tt.expected {
				t.Errorf("IsSeasonalThemeActive(newYear, %v) = %v; want %v", tt.date, got, tt.expected)
			}
		})
	}
}

func TestSeasonalThemesOverride(t *testing.T) {
	t.Setenv("SEASONAL_THEMES_OVERRIDE", "custom-theme,another-theme")
	active := GetActiveSeasonalThemeIDs(time.Date(2026, time.July, 1, 0, 0, 0, 0, time.UTC))
	if len(active) != 2 || active[0] != "custom-theme" || active[1] != "another-theme" {
		t.Fatalf("unexpected active themes from override: %v", active)
	}
}

