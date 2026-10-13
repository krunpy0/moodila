package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestUpdateMe_DatabaseUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Users{}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("PATCH", "/users/me", strings.NewReader(`{"avatar_url":""}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userID", "550e8400-e29b-41d4-a716-446655440000")

	h.UpdateMe(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 when pool is nil, got %d", w.Code)
	}
}

func TestFriendProfileUser_DoesNotExposeSensitiveFields(t *testing.T) {
	avatar := "https://example.com/avatar.jpg"
	fUser := FriendProfileUser{
		ID:          "123e4567-e89b-12d3-a456-426614174000",
		Username:    "alice",
		DisplayName: "Alice Smith",
		AvatarURL:   &avatar,
	}

	data, err := json.Marshal(fUser)
	if err != nil {
		t.Fatalf("failed to marshal FriendProfileUser: %v", err)
	}

	s := string(data)
	if strings.Contains(s, "email") {
		t.Errorf("FriendProfileUser JSON should not contain 'email': %s", s)
	}
	if strings.Contains(s, "is_admin") {
		t.Errorf("FriendProfileUser JSON should not contain 'is_admin': %s", s)
	}
	if strings.Contains(s, "password") {
		t.Errorf("FriendProfileUser JSON should not contain 'password': %s", s)
	}
	if strings.Contains(s, "token_version") {
		t.Errorf("FriendProfileUser JSON should not contain 'token_version': %s", s)
	}
	if !strings.Contains(s, `"username":"alice"`) {
		t.Errorf("FriendProfileUser JSON missing username: %s", s)
	}
}

