package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"moodshare/internal/config"
	"moodshare/internal/db"
	"moodshare/internal/repository"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if len(os.Args) > 1 && os.Args[1] == "diagnose" {
		sql, err := os.ReadFile("migrations/0002_create_entries.sql")
		if err != nil {
			log.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			log.Fatalf("create entries: %v", err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ('0002_create_entries.sql') ON CONFLICT DO NOTHING`); err != nil {
			log.Fatalf("record migration: %v", err)
		}
		email := "entry-diagnose@example.com"
		user, err := (repository.Users{Pool: pool}).Create(ctx, email, "entry_diagnose", "Entry Diagnose", "unused")
		if err != nil {
			log.Fatal(err)
		}
		defer pool.Exec(context.Background(), `DELETE FROM users WHERE email = $1`, email)
		entry, err := (repository.Entries{Pool: pool}).Save(ctx, user.ID, "2026-07-22", 5, []string{"Calm", "Grateful"}, "test", nil, nil)
		fmt.Printf("entry=%+v error=%v\n", entry, err)
		return
	}
	if _, err := pool.Exec(ctx, `DELETE FROM users WHERE email = $1`, os.Args[1]); err != nil {
		log.Fatal(err)
	}
}
