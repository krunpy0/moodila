package handlers

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestValidateSearchFilters(t *testing.T) {
	tests := []struct {
		name           string
		mood, from, to string
		wantMood       int
		wantErr        bool
	}{
		{name: "no optional filters"},
		{name: "valid mood and date range", mood: "5", from: "2026-01-01", to: "2026-12-31", wantMood: 5},
		{name: "mood outside range", mood: "6", wantErr: true},
		{name: "invalid date", from: "2026-02-30", wantErr: true},
		{name: "reversed range", from: "2026-03-01", to: "2026-02-01", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mood, err := validateSearchFilters("", "", tt.mood, tt.from, tt.to)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateSearchFilters() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil && mood != tt.wantMood {
				t.Fatalf("validateSearchFilters() mood = %d, want %d", mood, tt.wantMood)
			}
		})
	}
}

func TestParseEntrySearch(t *testing.T) {
	for _, query := range []string{"mood=0", "mood=5&mood=6", "cursor=invalid", "photo=yes", "tag=", "from=2026-02-02&to=2026-01-01"} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/entries/search?"+query, nil)
		if _, err := parseEntrySearch(c); err == nil {
			t.Fatalf("accepted invalid filters %s", query)
		}
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/entries/search?mood=1&mood=5&tag=Calm&tag=Work&photo=true&audio=true", nil)
	f, err := parseEntrySearch(c)
	if err != nil || len(f.Moods) != 2 || len(f.Tags) != 2 || !f.Photo || !f.Audio {
		t.Fatalf("bad filters: %+v %v", f, err)
	}
}

func TestEntrySearchRequiresOwner(t *testing.T) {
	for _, handler := range []gin.HandlerFunc{(Entries{}).Search, (Entries{}).SearchTags} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Request = httptest.NewRequest("GET", "/entries/search", nil)
		handler(c)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("unauthenticated search returned %d", response.Code)
		}
	}
}
