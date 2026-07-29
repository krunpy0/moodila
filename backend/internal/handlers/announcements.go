package handlers

import (
	"errors"
	"net/http"
	"strings"

	"moodshare/internal/models"
	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type Announcements struct {
	Announcements repository.Announcements
}

type createAnnouncementInput struct {
	Title    string          `json:"title"`
	Body     string          `json:"body"`
	Severity models.Severity `json:"severity"`
}

type updateAnnouncementInput struct {
	Title    string          `json:"title"`
	Body     string          `json:"body"`
	Severity models.Severity `json:"severity"`
}

// GET /announcements/unread
func (h Announcements) GetUnread(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, []models.Announcement{})
		return
	}
	userID := c.GetString("userID")
	list, err := h.Announcements.UnreadForUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch unread announcements"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// POST /announcements/:id/read
func (h Announcements) MarkRead(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}
	announcementID := strings.TrimSpace(c.Param("id"))
	if !validUUID(announcementID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}
	userID := c.GetString("userID")
	if err := h.Announcements.MarkAsRead(c.Request.Context(), announcementID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mark announcement as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GET /admin/announcements
func (h Announcements) ListAdmin(c *gin.Context) {
	if h.Announcements.Pool == nil {
		c.JSON(http.StatusOK, []models.Announcement{})
		return
	}
	list, err := h.Announcements.ListAll(c.Request.Context())
	if err != nil {
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

	item, err := h.Announcements.Create(c.Request.Context(), input.Title, input.Body, string(input.Severity))
	if err != nil {
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

	item, err := h.Announcements.Update(c.Request.Context(), id, input.Title, input.Body, string(input.Severity))
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "announcement not found"})
		return
	}
	if err != nil {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not publish announcement"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not archive announcement"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func isValidSeverity(s models.Severity) bool {
	return s == models.SeverityInfo || s == models.SeverityWarning || s == models.SeverityCritical
}
