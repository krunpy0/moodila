// Package db handles the Postgres connection pool and SQL migrations.
package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect opens a pgx connection pool for the given DSN and verifies it with a
// ping. It uses the simple query protocol, which keeps us compatible with
// Supabase's PgBouncer poolers (transaction mode has no prepared statements)
// and allows migration files with multiple statements in a single Exec.
func Connect(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	// Supabase's transaction pooler (Supavisor) closes idle server-side
	// connections, which leaves stale conns in our pool that hang ~10s on next
	// use. Recycle idle/old conns before that happens and health-check on
	// acquire so a dead conn is discarded, not handed out.
	cfg.MaxConnIdleTime = 20 * time.Second
	cfg.MaxConnLifetime = 5 * time.Minute
	cfg.HealthCheckPeriod = 15 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}

// Migrate applies every *.sql file in dir (lexical order) that has not yet been
// recorded in schema_migrations. Each file is applied atomically together with
// its version record.
func Migrate(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		var applied bool
		if err := pool.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, name,
		).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if applied {
			continue
		}

		sqlBytes, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		// Supabase's pooler can stall on multi-statement batches. Migrations are
		// idempotent, so apply the SQL first and record it only after success.
		if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO schema_migrations (version) VALUES ($1)`, name,
		); err != nil {
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		fmt.Printf("migration applied: %s\n", name)
	}
	return nil
}
