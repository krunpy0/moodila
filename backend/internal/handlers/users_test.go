package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestFriendProfile_InvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Users{}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "invalid-uuid"}}
	c.Set("userID", "550e8400-e29b-41d4-a716-446655440000")

	h.FriendProfile(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 when pool is nil, got %d", w.Code)
	}
}
