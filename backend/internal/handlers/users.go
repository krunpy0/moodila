package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"moodshare/internal/models"
	"moodshare/internal/repository"
	"moodshare/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type Users struct {
	Users   repository.Users
	Entries repository.Entries
	Friends repository.Friends
	Storage storage.S3
}

type profileUpdateInput struct {
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type profileResponse struct {
	User          models.User         `json:"user"`
	RecentEntries []models.Entry      `json:"recent_entries"`
	Friends       []models.FriendUser `json:"friends"`
}

type friendProfileResponse struct {
	User    models.User         `json:"user"`
	Entries []models.Entry      `json:"entries"`
	Summary models.EntrySummary `json:"summary"`
}

func (h Users) resolveUser(u models.User) models.User {
	u.AvatarURL = h.Storage.ResolveAccessURL(u.AvatarURL)
	return u
}

func (h Users) resolveEntries(entries []models.Entry) []models.Entry {
	out := make([]models.Entry, len(entries))
	for i, e := range entries {
		e.PhotoURL = h.Storage.ResolveAccessURL(e.PhotoURL)
		e.AudioURL = h.Storage.ResolveAccessURL(e.AudioURL)
		out[i] = e
	}
	return out
}

func (h Users) resolveFriendUsers(friends []models.FriendUser) []models.FriendUser {
	out := make([]models.FriendUser, len(friends))
	for i, f := range friends {
		f.AvatarURL = h.Storage.ResolveAccessURL(f.AvatarURL)
		out[i] = f
	}
	return out
}

func (h Users) Me(c *gin.Context) {
	if !h.available(c) {
		return
	}
	ctx := c.Request.Context()
	user, err := h.Users.ByID(ctx, c.GetString("userID"))
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load profile"})
		return
	}
	recent, err := h.Entries.Recent(ctx, user.ID, 6)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load recent entries"})
		return
	}
	friends, err := h.Friends.Accepted(ctx, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load friends"})
		return
	}
	c.JSON(http.StatusOK, profileResponse{
		User:          h.resolveUser(user),
		RecentEntries: h.resolveEntries(recent),
		Friends:       h.resolveFriendUsers(friends),
	})
}

func (h Users) UpdateMe(c *gin.Context) {
	if !h.available(c) {
		return
	}
	var input profileUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if input.DisplayName != nil {
		name := strings.TrimSpace(*input.DisplayName)
		if name == "" || len(name) > 60 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "display_name must be 1-60 characters"})
			return
		}
		input.DisplayName = &name
	}
	if input.AvatarURL != nil {
		avatar := strings.TrimSpace(*input.AvatarURL)
		if len(avatar) > 4096 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "avatar_url is too long"})
			return
		}
		cleaned := h.Storage.CleanURL(&avatar)
		if avatar != "" && cleaned == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "avatar_url must be a valid key or URL"})
			return
		}
		input.AvatarURL = cleaned
	}
	if input.DisplayName == nil && input.AvatarURL == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one field is required"})
		return
	}
	user, err := h.Users.UpdateProfile(c.Request.Context(), c.GetString("userID"), input.DisplayName, input.AvatarURL)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update profile"})
		return
	}
	c.JSON(http.StatusOK, h.resolveUser(user))
}

func (h Users) FriendProfile(c *gin.Context) {
	if !h.available(c) {
		return
	}

	friendID := strings.TrimSpace(c.Param("id"))
	if !validUUID(friendID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}

	requesterID := c.GetString("userID")

	var allowed bool
	var err error
	if requesterID == friendID {
		allowed = true
	} else {
		allowed, err = h.Entries.CanViewFriend(c.Request.Context(), requesterID, friendID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify friendship"})
			return
		}
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "not friends"})
		return
	}

	ctx := c.Request.Context()

	user, err := h.Users.ByID(ctx, friendID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load profile"})
		return
	}

	recent, err := h.Entries.VisibleRecent(ctx, friendID, 6)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load recent entries"})
		return
	}

	currentMonth := time.Now().Format("2006-01")
	month, nextMonth, _ := monthBounds(currentMonth)
	summary, err := h.Entries.VisibleSummary(ctx, friendID, month, nextMonth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load summary"})
		return
	}

	c.JSON(http.StatusOK, friendProfileResponse{
		User:    h.resolveUser(user),
		Entries: h.resolveEntries(recent),
		Summary: summary,
	})
}

func (h Users) available(c *gin.Context) bool {
	if h.Users.Pool != nil && h.Entries.Pool != nil && h.Friends.Pool != nil {
		return true
	}
	c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
	return false
}
