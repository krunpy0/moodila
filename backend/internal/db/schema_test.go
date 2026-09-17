package db_test

import (
	"context"
	"testing"
	"time"

	"moodshare/internal/config"
	"moodshare/internal/db"
)

func TestCheckSchema(t *testing.T) {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		t.Skip("no database url")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	rows, err := pool.Query(ctx, `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5`)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var v string
		_ = rows.Scan(&v)
		t.Logf("schema_migration: %s", v)
	}
}
