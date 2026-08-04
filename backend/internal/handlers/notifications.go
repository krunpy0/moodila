package handlers

import (
	"net/http"
	"strconv"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
)

type Notifications struct {
	Notifications repository.Notifications
}

type markReadInput struct {
	IDs []string `json:"ids"`
}

func (h Notifications) List(c *gin.Context) {
	if !h.available(c) {
		return
	}
	limitStr := c.Query("limit")
	limit := 30
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}
	if limit > 50 {
		limit = 50
	}

	list, err := h.Notifications.List(c.Request.Context(), c.GetString("userID"), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load notifications"})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h Notifications) UnreadCount(c *gin.Context) {
	if !h.available(c) {
		return
	}
	count, err := h.Notifications.UnreadCount(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not count unread notifications"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"unread_count": count})
}

func (h Notifications) MarkRead(c *gin.Context) {
	if !h.available(c) {
		return
	}
	var input markReadInput
	_ = c.ShouldBindJSON(&input)

	for _, id := range input.IDs {
		if !validUUID(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification ID format"})
			return
		}
	}

	if err := h.Notifications.MarkAsRead(c.Request.Context(), c.GetString("userID"), input.IDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mark notifications as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

func (h Notifications) available(c *gin.Context) bool {
	if h.Notifications.Pool != nil {
		return true
	}
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
	return false
}
