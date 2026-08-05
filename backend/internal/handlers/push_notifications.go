package handlers

import (
	"net/http"

	"moodshare/internal/models"
	"moodshare/internal/repository"
	"moodshare/internal/services/push"

	"github.com/gin-gonic/gin"
)

type PushNotifications struct {
	Repo        repository.PushSubscriptions
	PushService *push.Service
}

func (h PushNotifications) VAPIDPublicKey(c *gin.Context) {
	if h.PushService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "push service unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"public_key": h.PushService.VAPIDPublicKey(),
	})
}

func (h PushNotifications) Subscribe(c *gin.Context) {
	if h.Repo.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	var input models.PushSubscriptionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid push subscription payload"})
		return
	}
	if input.Endpoint == "" || input.Keys.P256dh == "" || input.Keys.Auth == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint, keys.p256dh and keys.auth are required"})
		return
	}

	userID := c.GetString("userID")
	if err := h.Repo.Save(c.Request.Context(), userID, input); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save push subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "push subscription saved"})
}

func (h PushNotifications) Unsubscribe(c *gin.Context) {
	if h.Repo.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	var input struct {
		Endpoint string `json:"endpoint"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || input.Endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint is required"})
		return
	}

	userID := c.GetString("userID")
	if err := h.Repo.DeleteByEndpoint(c.Request.Context(), userID, input.Endpoint); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove push subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "push subscription removed"})
}
