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

func TestAnnouncementsGetActivePromptNilPool(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/announcements/active-prompt", nil)
	c.Set("userID", "00000000-0000-0000-0000-000000000001")

	h.GetActivePrompt(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if w.Body.String() != "null" {
		t.Fatalf("expected null, got %s", w.Body.String())
	}
}

func TestAnnouncementsGetInboxNilPool(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/announcements/inbox", nil)
	c.Set("userID", "00000000-0000-0000-0000-000000000001")

	h.GetInbox(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if w.Body.String() != "[]" {
		t.Fatalf("expected empty array [], got %s", w.Body.String())
	}
}

func TestAnnouncementsDismissInvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/announcements/invalid-uuid/dismiss", nil)
	c.Params = gin.Params{{Key: "id", Value: "invalid-uuid"}}
	c.Set("userID", "00000000-0000-0000-0000-000000000001")

	h.Dismiss(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid UUID, got %d", w.Code)
	}
}

func TestAnnouncementsAcknowledgeInvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodPost, "/announcements/not-a-uuid/acknowledge", nil)
	c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
	c.Set("userID", "00000000-0000-0000-0000-000000000001")

	h.Acknowledge(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid UUID, got %d", w.Code)
	}
}

func TestAnnouncementsDeleteAdminInvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodDelete, "/admin/announcements/bad-uuid", nil)
	c.Params = gin.Params{{Key: "id", Value: "bad-uuid"}}

	h.DeleteAdmin(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid UUID, got %d", w.Code)
	}
}

func TestAnnouncementsCreateValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	payload := map[string]any{
		"title":        "",
		"body":         "some body",
		"severity":     "invalid_severity",
		"kind":         "invalid_kind",
		"display_type": "invalid_display",
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

func TestIsValidKind(t *testing.T) {
	if !isValidKind(models.KindStandard) {
		t.Errorf("expected standard to be valid")
	}
	if !isValidKind(models.KindOnboarding) {
		t.Errorf("expected onboarding to be valid")
	}
	if isValidKind("invalid") {
		t.Errorf("expected invalid to be rejected")
	}
}

func TestIsValidDisplayType(t *testing.T) {
	if !isValidDisplayType(models.DisplayTypeModal) {
		t.Errorf("expected modal to be valid")
	}
	if !isValidDisplayType(models.DisplayTypeBanner) {
		t.Errorf("expected banner to be valid")
	}
	if !isValidDisplayType(models.DisplayTypeFeedOnly) {
		t.Errorf("expected feed_only to be valid")
	}
	if isValidDisplayType("toast") {
		t.Errorf("expected toast to be invalid")
	}
}

func TestCleanCTA(t *testing.T) {
	lbl := "  Click here  "
	u := "  https://example.com  "
	pLbl := &lbl
	pU := &u

	cleanCTA(&pLbl, &pU)
	if *pLbl != "Click here" || *pU != "https://example.com" {
		t.Errorf("expected trimmed strings, got %v, %v", *pLbl, *pU)
	}

	// If one is empty, both become nil
	lbl2 := "   "
	u2 := "https://example.com"
	pLbl2 := &lbl2
	pU2 := &u2
	cleanCTA(&pLbl2, &pU2)
	if pLbl2 != nil || pU2 != nil {
		t.Errorf("expected both nil when one is empty, got %v, %v", pLbl2, pU2)
	}
}

func TestAnnouncementsGetStatsAdminInvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/admin/announcements/not-a-uuid/stats", nil)
	c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}

	h.GetStatsAdmin(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid UUID, got %d", w.Code)
	}
}

func TestAnnouncementsGetStatsAdminNilPool(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Announcements{Announcements: repository.Announcements{Pool: nil}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/admin/announcements/00000000-0000-0000-0000-000000000001/stats", nil)
	c.Params = gin.Params{{Key: "id", Value: "00000000-0000-0000-0000-000000000001"}}

	h.GetStatsAdmin(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 for nil pool, got %d", w.Code)
	}
}
