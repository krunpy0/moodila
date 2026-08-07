package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"moodshare/internal/storage"

	"github.com/jackc/pgx/v5"
)

func main() {
	data, err := os.ReadFile(".env")
	if err != nil {
		log.Fatalf("read .env failed: %v", err)
	}

	var dbURL string
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "DATABASE_URL=") {
			dbURL = strings.TrimPrefix(line, "DATABASE_URL=")
			dbURL = strings.Trim(dbURL, `"'`)
		}
	}
	if dbURL == "" {
		log.Fatal("DATABASE_URL not found in .env")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect failed: %v", err)
	}
	defer conn.Close(ctx)

	fmt.Println("=== VERIFYING DATABASE KEYS POST-MIGRATION ===")

	tables := []struct {
		table  string
		column string
	}{
		{"users", "avatar_url"},
		{"entries", "photo_url"},
		{"entries", "audio_url"},
	}

	var totalInvalid int
	for _, t := range tables {
		query := fmt.Sprintf(`
			SELECT %s FROM %s 
			WHERE %s IS NOT NULL AND %s != '' 
			  AND (%s LIKE '%%supabase.co%%' OR %s LIKE '%%backblazeb2.com%%' OR %s LIKE 'http%%' OR %s LIKE 'storage/v1/%%')
		`, t.column, t.table, t.column, t.column, t.column, t.column, t.column, t.column)

		rows, err := conn.Query(ctx, query)
		if err != nil {
			log.Fatalf("Query error for %s.%s: %v", t.table, t.column, err)
		}
		var unmigrated []string
		for rows.Next() {
			var val string
			_ = rows.Scan(&val)
			unmigrated = append(unmigrated, val)
		}
		rows.Close()

		if len(unmigrated) > 0 {
			fmt.Printf("FAIL: Found %d unmigrated rows in %s.%s:\n", len(unmigrated), t.table, t.column)
			for _, u := range unmigrated {
				fmt.Printf("  - %s\n", u)
			}
			totalInvalid += len(unmigrated)
		} else {
			fmt.Printf("PASS: %s.%s has 0 unmigrated/non-relative keys.\n", t.table, t.column)
		}
	}

	if totalInvalid == 0 {
		fmt.Println("\nALL DATABASE KEYS VERIFIED AS RELATIVE OBJECT KEYS!")
	} else {
		fmt.Printf("\nFAILURE: %d unmigrated keys found!\n", totalInvalid)
	}

	fmt.Println("\n=== TESTING GO URL BUILDER RESOLUTION ===")
	s := storage.S3{
		PublicBaseURL: "https://moodila-uploads.s3.eu-central-003.backblazeb2.com",
		Bucket:        "moodila-uploads",
		IsPrivate:     false,
	}

	relKey := "c4dee056-c5a2-4430-b612-de55ff6724bf/2026/08/c00a4c6b08097ed75fe1b4358c678333.jpg"
	resolved := s.ResolveAccessURL(&relKey)
	fmt.Printf("Key:      %s\nResolved: %s\n", relKey, *resolved)

	want := "https://moodila-uploads.s3.eu-central-003.backblazeb2.com/c4dee056-c5a2-4430-b612-de55ff6724bf/2026/08/c00a4c6b08097ed75fe1b4358c678333.jpg"
	if *resolved != want {
		log.Fatalf("URL Builder output mismatch! got %q, want %q", *resolved, want)
	}
	fmt.Println("PASS: Go URL Builder generated expected Backblaze URL!")
}
