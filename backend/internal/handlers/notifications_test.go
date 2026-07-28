package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
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
