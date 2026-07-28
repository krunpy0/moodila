package handlers

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"moodshare/internal/models"
	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

var usernameSearchPattern = regexp.MustCompile(`^[a-z0-9_]+$`)

type Friends struct {
	Friends       repository.Friends
	Notifications repository.Notifications
}

type friendInput struct {
	UserID       string `json:"user_id"`
	FriendshipID string `json:"friendship_id"`
}

func (h Friends) Search(c *gin.Context) {
	if !h.available(c) {
		return
	}
	query := strings.ToLower(strings.TrimSpace(c.Query("q")))
	if len(query) < 1 || len(query) > 24 || !usernameSearchPattern.MatchString(query) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q must contain 1-24 lowercase letters, numbers, or underscores"})
		return
	}
	users, err := h.Friends.Search(c.Request.Context(), c.GetString("userID"), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not search users"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h Friends) Request(c *gin.Context) {
	if !h.available(c) {
		return
	}
	var input friendInput
	if err := c.ShouldBindJSON(&input); err != nil || !validUUID(input.UserID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid user_id is required"})
		return
	}
	if input.UserID == c.GetString("userID") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot send a friend request to yourself"})
		return
	}
	friendship, err := h.Friends.Request(c.Request.Context(), c.GetString("userID"), input.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusConflict, gin.H{"error": "friend request already exists"})
		return
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not send friend request"})
		return
	}

	_ = h.Notifications.Create(c.Request.Context(), input.UserID, c.GetString("userID"), "friend_request", &friendship.ID, nil)

	c.JSON(http.StatusCreated, friendship)
}

func (h Friends) Accept(c *gin.Context) {
	h.respond(c, "accepted")
}

func (h Friends) Decline(c *gin.Context) {
	h.respond(c, "declined")
}

func (h Friends) Pending(c *gin.Context) {
	h.list(c, h.Friends.Pending)
}

func (h Friends) Accepted(c *gin.Context) {
	h.list(c, h.Friends.Accepted)
}

func (h Friends) respond(c *gin.Context, status string) {
	if !h.available(c) {
		return
	}
	var input friendInput
	if err := c.ShouldBindJSON(&input); err != nil || !validUUID(input.FriendshipID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid friendship_id is required"})
		return
	}
	friendship, err := h.Friends.Respond(
		c.Request.Context(), input.FriendshipID, c.GetString("userID"), status,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "pending friend request not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update friend request"})
		return
	}

	if status == "accepted" {
		_ = h.Notifications.Create(c.Request.Context(), friendship.RequesterID, c.GetString("userID"), "friend_accept", &friendship.ID, nil)
	}

	c.JSON(http.StatusOK, friendship)
}

func (h Friends) Unfriend(c *gin.Context) {
	if !h.available(c) {
		return
	}
	targetID := strings.TrimSpace(c.Param("id"))
	if !validUUID(targetID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid friend_id or friendship_id is required"})
		return
	}
	err := h.Friends.Delete(c.Request.Context(), c.GetString("userID"), targetID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "friendship not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove friend"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unfriended successfully"})
}

func (h Friends) Cancel(c *gin.Context) {
	if !h.available(c) {
		return
	}
	var input friendInput
	_ = c.ShouldBindJSON(&input)
	targetID := strings.TrimSpace(input.UserID)
	if targetID == "" {
		targetID = strings.TrimSpace(input.FriendshipID)
	}
	if targetID == "" {
		targetID = strings.TrimSpace(c.Query("user_id"))
	}
	if !validUUID(targetID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid user_id or friendship_id is required"})
		return
	}
	err := h.Friends.CancelRequest(c.Request.Context(), c.GetString("userID"), targetID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "pending friend request not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not cancel friend request"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "friend request cancelled"})
}

func (h Friends) list(c *gin.Context, load func(context.Context, string) ([]models.FriendUser, error)) {

	if !h.available(c) {
		return
	}
	users, err := load(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load friends"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h Friends) available(c *gin.Context) bool {
	if h.Friends.Pool != nil {
		return true
	}
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
	return false
}

func validUUID(value string) bool {
	var id pgtype.UUID
	return id.Scan(strings.TrimSpace(value)) == nil && id.Valid
}
