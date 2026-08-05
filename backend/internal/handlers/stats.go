package handlers

import (
	"net/http"
	"strings"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
)

type Stats struct {
	Entries repository.Entries
}

func (h Stats) Get(c *gin.Context) {
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	period := strings.ToLower(strings.TrimSpace(c.Query("period")))
	if period != "week" && period != "year" {
		period = "month"
	}

	timeZone := c.GetHeader("X-Time-Zone")

	stats, err := h.Entries.GetStats(c.Request.Context(), c.GetString("userID"), period, timeZone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}
