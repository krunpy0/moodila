package handlers

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func (h Feed) EditComment(c *gin.Context) {
	if !h.available(c) {
		return
	}
	commentID := strings.TrimSpace(c.Param("comment_id"))
	if !validUUID(commentID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "comment_id must be a valid UUID"})
		return
	}
	var input commentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	text := strings.TrimSpace(input.Text)
	if text == "" || utf8.RuneCountInString(text) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "comment text must be 1 to 500 characters"})
		return
	}
	if err := h.Feed.EditComment(c.Request.Context(), c.GetString("userID"), commentID, text); err != nil {
		commentError(c, err, "could not edit comment")
		return
	}
	c.JSON(http.StatusOK, gin.H{"text": text})
}

func commentError(c *gin.Context, err error, message string) {
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "comment not found or access denied"})
		return
	}
	_ = c.Error(err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": message})
}
