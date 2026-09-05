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

func TestFeedLikeUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Feed{Feed: repository.Feed{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/feed/123/like", nil)

	h.Like(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestFeedLikeInvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Feed{Feed: repository.Feed{Pool: &pgxpool.Pool{}}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "entry_id", Value: "invalid-uuid"}}
	c.Request, _ = http.NewRequest(http.MethodPost, "/feed/invalid-uuid/like", strings.NewReader(`{"reaction":"❤️"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Like(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid UUID, got %d", w.Code)
	}
}

func TestFeedGetReactionsInvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Feed{Feed: repository.Feed{Pool: &pgxpool.Pool{}}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "entry_id", Value: "not-a-uuid"}}
	c.Request, _ = http.NewRequest(http.MethodGet, "/feed/not-a-uuid/reactions", nil)

	h.GetReactions(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid UUID, got %d", w.Code)
	}
}

