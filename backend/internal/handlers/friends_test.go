package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestValidUUID(t *testing.T) {
	if !validUUID("550e8400-e29b-41d4-a716-446655440000") {
		t.Fatal("valid UUID rejected")
	}
	if validUUID("not-a-uuid") {
		t.Fatal("invalid UUID accepted")
	}
}

func TestCleanSearchQuery(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"   ", ""},
		{"@", ""},
		{"@username", "username"},
		{"  @alex  ", "alex"},
		{"Deleted User", "Deleted User"},
		{"  Some Name With Spaces  ", "Some Name With Spaces"},
		{"привет", "привет"},
		{"@привет_друг", "привет_друг"},
		{strings.Repeat("a", 70), strings.Repeat("a", 60)},
	}

	for _, tt := range tests {
		got := cleanSearchQuery(tt.input)
		if got != tt.expected {
			t.Errorf("cleanSearchQuery(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestFriendsRequestUnavailable(t *testing.T) {
	h := Friends{Friends: repository.Friends{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/friends/request", strings.NewReader(`{"user_id":"550e8400-e29b-41d4-a716-446655440000"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Request(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestFriendsRequestSelf(t *testing.T) {
	selfID := "550e8400-e29b-41d4-a716-446655440000"
	h := Friends{Friends: repository.Friends{Pool: &pgxpool.Pool{}}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("userID", selfID)
	c.Request, _ = http.NewRequest(http.MethodPost, "/friends/request", strings.NewReader(`{"user_id":"`+selfID+`"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Request(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 when friending self, got %d", w.Code)
	}
}

