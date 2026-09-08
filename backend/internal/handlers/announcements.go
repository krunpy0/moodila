package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"moodshare/internal/models"
	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type Announcements struct {
	Announcements repository.Announcements
}

type createAnnouncementInput struct {
	Title       string             `json:"title"`
	Body        string             `json:"body"`
	Severity    models.Severity    `json:"severity"`
	Kind        models.Kind        `json:"kind"`
	DisplayType models.DisplayType `json:"display_type"`
	ExpiresAt   *time.Time         `json:"expires_at"`
	CTALabel    *string            `json:"cta_label"`
	CTAURL      *string            `json:"cta_url"`
	IsPinned    bool               `json:"is_pinned"`
}

type updateAnnouncementInput struct {
	Title       string             `json:"title"`
	Body        string             `json:"body"`
	Severity    models.Severity    `json:"severity"`
	Kind        models.Kind        `json:"kind"`
	DisplayType models.DisplayType `json:"display_type"`
	ExpiresAt   *time.Time         `json:"expires_at"`
	CTALabel    *string            `json:"cta_label"`
	CTAURL      *string            `json:"cta_url"`
	IsPinned    bool               `json:"is_pinned"`
}

// GET /announcements/active-prompt
// Returns at most ONE interruptive announcement prompt (modal or banner) for the user.
func (h Announcements) GetActivePrompt(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	userID := c.GetString("userID")
	item, err := h.Announcements.ActivePromptForUser(c.Request.Context(), userID)
	if err != nil {
		log.Printf("[ERROR] Announcements.GetActivePrompt (user=%s): %v", userID, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch active announcement prompt"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// GET /announcements/inbox
// Returns all accessible announcements for the user with is_read and is_dismissed status.
func (h Announcements) GetInbox(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, []models.InboxAnnouncement{})
		return
	}
	userID := c.GetString("userID")
	list, err := h.Announcements.InboxForUser(c.Request.Context(), userID)
	if err != nil {
		log.Printf("[ERROR] Announcements.GetInbox (user=%s): %v", userID, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch announcements inbox"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// POST /announcements/:id/dismiss
// Marks the announcement as dismissed (hides modal or banner), leaving read_at untouched.
func (h Announcements) Dismiss(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}
	userID := c.GetString("userID")
	if err := h.Announcements.Dismiss(c.Request.Context(), id, userID); err != nil {
		log.Printf("[ERROR] Announcements.Dismiss (user=%s, id=%s): %v", userID, id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not dismiss announcement"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// POST /announcements/:id/acknowledge
// Acknowledges a modal announcement, marking both dismissed_at and read_at.
func (h Announcements) Acknowledge(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}
	userID := c.GetString("userID")
	if err := h.Announcements.AcknowledgeModal(c.Request.Context(), id, userID); err != nil {
		log.Printf("[ERROR] Announcements.Acknowledge (user=%s, id=%s): %v", userID, id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not acknowledge announcement"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// POST /announcements/:id/read
// Marks an announcement as read in the inbox.
func (h Announcements) MarkRead(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}
	userID := c.GetString("userID")
	if err := h.Announcements.MarkAsRead(c.Request.Context(), id, userID); err != nil {
		log.Printf("[ERROR] Announcements.MarkRead (user=%s, id=%s): %v", userID, id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mark announcement as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// Legacy GET /announcements/unread
func (h Announcements) GetUnread(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, []models.Announcement{})
		return
	}
	userID := c.GetString("userID")
	list, err := h.Announcements.UnreadForUser(c.Request.Context(), userID)
	if err != nil {
		log.Printf("[ERROR] Announcements.GetUnread (user=%s): %v", userID, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch unread announcements"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GET /admin/announcements
func (h Announcements) ListAdmin(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, []models.Announcement{})
		return
	}
	list, err := h.Announcements.ListAll(c.Request.Context())
	if err != nil {
		log.Printf("[ERROR] Announcements.ListAdmin: %v", err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch announcements"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// POST /admin/announcements
func (h Announcements) CreateAdmin(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	var input createAnnouncementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Body = strings.TrimSpace(input.Body)
	if input.Title == "" || len(input.Title) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title must be 1-200 characters"})
		return
	}
	if input.Body == "" || len(input.Body) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "body must be 1-5000 characters"})
		return
	}
	if !isValidSeverity(input.Severity) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "severity must be info, warning, or critical"})
		return
	}
	if input.Kind == "" {
		input.Kind = models.KindStandard
	} else if !isValidKind(input.Kind) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kind must be standard or onboarding"})
		return
	}
	if input.DisplayType == "" {
		input.DisplayType = models.DisplayTypeModal
	} else if !isValidDisplayType(input.DisplayType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "display_type must be modal, banner, or feed_only"})
		return
	}

	cleanCTA(&input.CTALabel, &input.CTAURL)

	item, err := h.Announcements.Create(c.Request.Context(), repository.CreateAnnouncementParams{
		Title:       input.Title,
		Body:        input.Body,
		Severity:    input.Severity,
		Kind:        input.Kind,
		DisplayType: input.DisplayType,
		ExpiresAt:   input.ExpiresAt,
		CTALabel:    input.CTALabel,
		CTAURL:      input.CTAURL,
		IsPinned:    input.IsPinned,
	})
	if err != nil {
		log.Printf("[ERROR] Announcements.CreateAdmin: %v", err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create announcement"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

// PATCH /admin/announcements/:id
func (h Announcements) UpdateAdmin(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	var input updateAnnouncementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Body = strings.TrimSpace(input.Body)
	if input.Title == "" || len(input.Title) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title must be 1-200 characters"})
		return
	}
	if input.Body == "" || len(input.Body) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "body must be 1-5000 characters"})
		return
	}
	if !isValidSeverity(input.Severity) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "severity must be info, warning, or critical"})
		return
	}
	if input.Kind == "" {
		input.Kind = models.KindStandard
	} else if !isValidKind(input.Kind) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kind must be standard or onboarding"})
		return
	}
	if input.DisplayType == "" {
		input.DisplayType = models.DisplayTypeModal
	} else if !isValidDisplayType(input.DisplayType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "display_type must be modal, banner, or feed_only"})
		return
	}

	cleanCTA(&input.CTALabel, &input.CTAURL)

	item, err := h.Announcements.Update(c.Request.Context(), id, repository.UpdateAnnouncementParams{
		Title:       input.Title,
		Body:        input.Body,
		Severity:    input.Severity,
		Kind:        input.Kind,
		DisplayType: input.DisplayType,
		ExpiresAt:   input.ExpiresAt,
		CTALabel:    input.CTALabel,
		CTAURL:      input.CTAURL,
		IsPinned:    input.IsPinned,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "announcement not found"})
		return
	}
	if err != nil {
		log.Printf("[ERROR] Announcements.UpdateAdmin (id=%s): %v", id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update announcement"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// POST /admin/announcements/:id/publish
func (h Announcements) PublishAdmin(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	item, err := h.Announcements.Publish(c.Request.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "announcement not found"})
		return
	}
	if err != nil {
		log.Printf("[ERROR] Announcements.PublishAdmin (id=%s): %v", id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not publish announcement"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// POST /admin/announcements/:id/unpublish
func (h Announcements) UnpublishAdmin(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	item, err := h.Announcements.Unpublish(c.Request.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "announcement not found"})
		return
	}
	if err != nil {
		log.Printf("[ERROR] Announcements.UnpublishAdmin (id=%s): %v", id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not unpublish announcement"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// POST /admin/announcements/:id/archive
func (h Announcements) ArchiveAdmin(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	item, err := h.Announcements.Archive(c.Request.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "announcement not found"})
		return
	}
	if err != nil {
		log.Printf("[ERROR] Announcements.ArchiveAdmin (id=%s): %v", id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not archive announcement"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// DELETE /admin/announcements/:id
func (h Announcements) DeleteAdmin(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	if err := h.Announcements.Delete(c.Request.Context(), id); err != nil {
		log.Printf("[ERROR] Announcements.DeleteAdmin (id=%s): %v", id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete announcement"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GET /admin/announcements/:id/stats
func (h Announcements) GetStatsAdmin(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if !validUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	stats, err := h.Announcements.GetStats(c.Request.Context(), id)
	if err != nil {
		log.Printf("[ERROR] Announcements.GetStatsAdmin (id=%s): %v", id, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch announcement stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func isValidSeverity(s models.Severity) bool {
	return s == models.SeverityInfo || s == models.SeverityWarning || s == models.SeverityCritical
}

func isValidKind(k models.Kind) bool {
	return k == models.KindStandard || k == models.KindOnboarding
}

func isValidDisplayType(d models.DisplayType) bool {
	return d == models.DisplayTypeModal || d == models.DisplayTypeBanner || d == models.DisplayTypeFeedOnly
}

func cleanCTA(label, url **string) {
	if *label != nil {
		trimmed := strings.TrimSpace(**label)
		if trimmed == "" {
			*label = nil
		} else {
			*label = &trimmed
		}
	}
	if *url != nil {
		trimmed := strings.TrimSpace(**url)
		if trimmed == "" {
			*url = nil
		} else {
			*url = &trimmed
		}
	}
	// If either is nil, both must be nil
	if *label == nil || *url == nil {
		*label = nil
		*url = nil
	}
}
