package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type Feed struct {
	Feed          repository.Feed
	Notifications repository.Notifications
}

type reactInput struct {
	Reaction string `json:"reaction"`
}

type commentInput struct {
	Text string `json:"text"`
}

func (h Feed) List(c *gin.Context) {
	if !h.available(c) {
		return
	}
	limitStr := strings.TrimSpace(c.Query("limit"))
	limit := 10
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}
	cursor := strings.TrimSpace(c.Query("cursor"))

	entries, nextCursor, err := h.Feed.List(c.Request.Context(), c.GetString("userID"), limit, cursor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load feed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items":       entries,
		"entries":     entries,
		"next_cursor": nextCursor,
	})
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

	var input reactInput
	_ = c.ShouldBindJSON(&input)
	reaction := strings.TrimSpace(input.Reaction)
	if reaction == "" {
		reaction = "❤️"
	}

	result, err := h.Feed.React(c.Request.Context(), c.GetString("userID"), entryID, reaction)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "friend entry not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not react to entry"})
		return
	}

	if result.LikedByMe {
		if ownerID, err := h.Feed.GetEntryOwner(c.Request.Context(), entryID); err == nil && ownerID != "" {
			_ = h.Notifications.Create(c.Request.Context(), ownerID, c.GetString("userID"), "like", &entryID, &reaction)
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h Feed) GetComments(c *gin.Context) {
	if !h.available(c) {
		return
	}
	entryID := strings.TrimSpace(c.Param("entry_id"))
	if !validUUID(entryID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "entry_id must be a valid UUID"})
		return
	}

	comments, err := h.Feed.GetComments(c.Request.Context(), c.GetString("userID"), entryID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "entry not found or access denied"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load comments"})
		return
	}
	c.JSON(http.StatusOK, comments)
}

func (h Feed) AddComment(c *gin.Context) {
	if !h.available(c) {
		return
	}
	entryID := strings.TrimSpace(c.Param("entry_id"))
	if !validUUID(entryID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "entry_id must be a valid UUID"})
		return
	}

	var input commentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	text := strings.TrimSpace(input.Text)
	if text == "" || len(text) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "comment text must be 1 to 500 characters"})
		return
	}

	comment, err := h.Feed.AddComment(c.Request.Context(), c.GetString("userID"), entryID, text)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "entry not found or access denied"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add comment"})
		return
	}

	if ownerID, err := h.Feed.GetEntryOwner(c.Request.Context(), entryID); err == nil && ownerID != "" {
		_ = h.Notifications.Create(c.Request.Context(), ownerID, c.GetString("userID"), "comment", &entryID, &text)
	}

	c.JSON(http.StatusOK, comment)
}

func (h Feed) DeleteComment(c *gin.Context) {
	if !h.available(c) {
		return
	}
	commentID := strings.TrimSpace(c.Param("comment_id"))
	if !validUUID(commentID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "comment_id must be a valid UUID"})
		return
	}

	err := h.Feed.DeleteComment(c.Request.Context(), c.GetString("userID"), commentID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "comment not found or not owned by you"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete comment"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "comment deleted"})
}

func (h Feed) available(c *gin.Context) bool {
	if h.Feed.Pool != nil {
		return true
	}
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
	return false
}
