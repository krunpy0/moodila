package handlers

import (
	"log"
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
	if period != "week" && period != "year" && period != "all" {
		period = "month"
	}

	timeZone := c.GetHeader("X-Time-Zone")
	scope := c.Query("scope")
	if scope != "" && scope != "summary" && scope != "series" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "scope must be summary or series"})
		return
	}

	stats, err := h.Entries.GetStats(c.Request.Context(), c.GetString("userID"), period, timeZone, scope)
	if err != nil {
		log.Printf("[ERROR] Stats.Get (user=%s, period=%s): %v", c.GetString("userID"), period, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}
