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
			name:     "October 1st start of season",
			date:     time.Date(2026, time.October, 1, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name:     "October 15th mid-season",
			date:     time.Date(2026, time.October, 15, 12, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name:     "Halloween night October 31st 23:59:59",
			date:     time.Date(2026, time.October, 31, 23, 59, 59, 0, time.UTC),
			expected: true,
		},
		{
			name:     "November 1st early November",
			date:     time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name:     "November 4th last active day 23:59:59",
			date:     time.Date(2026, time.November, 4, 23, 59, 59, 0, time.UTC),
			expected: true,
		},
		{
			name:     "November 5th exact boundary 00:00:00 (MUST BE FALSE)",
			date:     time.Date(2026, time.November, 5, 0, 0, 0, 0, time.UTC),
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

	t.Run("Returns true when header mock date is in October", func(t *testing.T) {
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
