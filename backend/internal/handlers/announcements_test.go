package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"moodshare/internal/models"
	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
)

func TestAnnouncementsGetUnreadNilPool(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/announcements/unread", nil)
	c.Set("userID", "00000000-0000-0000-0000-000000000001")

	h.GetUnread(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if w.Body.String() != "[]" {
		t.Fatalf("expected empty array [], got %s", w.Body.String())
	}
}

func TestAnnouncementsCreateValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	payload := map[string]any{
		"title":    "",
		"body":     "some body",
		"severity": "invalid_severity",
	}
	jsonBytes, _ := json.Marshal(payload)
	c.Request, _ = http.NewRequest(http.MethodPost, "/admin/announcements", bytes.NewBuffer(jsonBytes))
	c.Request.Header.Set("Content-Type", "application/json")

	h.CreateAdmin(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 for nil pool, got %d", w.Code)
	}
}

func TestIsValidSeverity(t *testing.T) {
	if !isValidSeverity(models.SeverityInfo) {
		t.Errorf("expected info to be valid")
	}
	if !isValidSeverity(models.SeverityWarning) {
		t.Errorf("expected warning to be valid")
	}
	if !isValidSeverity(models.SeverityCritical) {
		t.Errorf("expected critical to be valid")
	}
	if isValidSeverity("unknown") {
		t.Errorf("expected unknown to be invalid")
	}
}
