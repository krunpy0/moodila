// Package handlers contains the HTTP handlers, grouped by feature.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Health reports server liveness and current database connectivity.
type Health struct {
	Pool *pgxpool.Pool
}

func (h Health) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	db := "not_configured"
	if h.Pool != nil {
		db = "unavailable"
		// Two quick attempts: if the pool hands out a stale conn, it's dropped
		// and the retry gets a fresh one.
		for i := 0; i < 2; i++ {
			ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			err := h.Pool.Ping(ctx)
			cancel()
			if err == nil {
				db = "connected"
				break
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"db":     db,
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

// writeJSON is a small helper shared by handlers in this package.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
