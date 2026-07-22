// Package handlers contains the HTTP handlers, grouped by feature.
package handlers

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Health reports server liveness and current database connectivity.
type Health struct {
	Pool *pgxpool.Pool
}

func (h Health) Get(c *gin.Context) {
	db := "not_configured"
	if h.Pool != nil {
		db = "unavailable"
		// Two quick attempts: if the pool hands out a stale conn, it's dropped
		// and the retry gets a fresh one.
		for i := 0; i < 2; i++ {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
			err := h.Pool.Ping(ctx)
			cancel()
			if err == nil {
				db = "connected"
				break
			}
		}
	}

	c.JSON(200, gin.H{
		"status": "ok",
		"db":     db,
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}
