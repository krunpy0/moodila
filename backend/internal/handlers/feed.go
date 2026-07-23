package handlers

import (
	"errors"
	"net/http"
	"strings"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type Feed struct {
	Feed repository.Feed
}

func (h Feed) List(c *gin.Context) {
	if !h.available(c) {
		return
	}
	entries, err := h.Feed.List(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load feed"})
		return
	}
	c.JSON(http.StatusOK, entries)
}

func (h Feed) Like(c *gin.Context) {
	if !h.available(c) {
		return
	}
	entryID := strings.TrimSpace(c.Param("entry_id"))
	if !validUUID(entryID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "entry_id must be a valid UUID"})
		return
	}
	result, err := h.Feed.Like(c.Request.Context(), c.GetString("userID"), entryID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "friend entry not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not like entry"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h Feed) available(c *gin.Context) bool {
	if h.Feed.Pool != nil {
		return true
	}
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
	return false
}
