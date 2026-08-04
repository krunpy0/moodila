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

func TestNotificationsUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Notifications{Notifications: repository.Notifications{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/notifications", nil)

	h.List(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestNotificationsUnreadCountUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Notifications{Notifications: repository.Notifications{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/notifications/unread-count", nil)

	h.UnreadCount(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestMarkRead_InvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Notifications{Notifications: repository.Notifications{Pool: &pgxpool.Pool{}}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/notifications/read", strings.NewReader(`{"ids": ["not-a-uuid"]}`))
	c.Request.Header.Set("Content-Type", "application/json")

	h.MarkRead(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 Bad Request for invalid UUID, got %d", w.Code)
	}
}
