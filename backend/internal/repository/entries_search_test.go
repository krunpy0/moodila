package repository

import (
	"context"
	"fmt"
	"moodshare/internal/db"
	"os"
	"testing"
	"time"
)

func TestSearchPattern(t *testing.T) {
	if got := searchPattern(`ЭКЗАМЁН 100%_\`); got != `%экзамен 100\%\_\\%` {
		t.Fatalf("unexpected pattern: %q", got)
	}
}

func TestEntrySearchDatabase(t *testing.T) {
	dsn := os.Getenv("SEARCH_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("SEARCH_TEST_DATABASE_URL not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := db.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var owner, stranger string
	for i, target := range []*string{&owner, &stranger} {
		name := fmt.Sprintf("search_%d_%d", time.Now().UnixNano(), i)
		if err := pool.QueryRow(ctx, `INSERT INTO users (email, username) VALUES ($1, $2) RETURNING id`, name+"@test.invalid", name).Scan(target); err != nil {
			t.Fatal(err)
		}
		id := *target
		defer pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id)
	}
	_, err = pool.Exec(ctx, `INSERT INTO entries (user_id,date,mood,tags,text,is_hidden,photo_url,audio_url)
 SELECT $1, '2026-01-01'::date + n, 4, ARRAY['Calm','Мой тег'], 'ЭКЗАМЁН', true, 'photo.jpg', 'voice.webm' FROM generate_series(0,24) n;
 INSERT INTO entries (user_id,date,mood,tags,text) VALUES ($2,'2026-12-31',4,ARRAY['Calm'],'ЭКЗАМЁН')`, owner, stranger)
	if err != nil {
		t.Fatal(err)
	}
	repo := Entries{Pool: pool}
	filters := EntrySearchFilters{Query: "экзамен", Moods: []int{1, 4}, Tags: []string{"Calm", "Мой тег"}, Photo: true, Audio: true}
	first, err := repo.Search(ctx, owner, filters)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Entries) != 20 || first.NextCursor == "" || first.Entries[0].Date != "2026-01-25" {
		t.Fatalf("bad first page: %+v", first)
	}
	filters.Cursor = first.NextCursor
	second, err := repo.Search(ctx, owner, filters)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Entries) != 5 || second.NextCursor != "" || second.Entries[0].Date >= first.NextCursor {
		t.Fatalf("bad second page: %+v", second)
	}
	filters.Cursor = ""
	filters.From, filters.To = "2026-01-05", "2026-01-05"
	page, err := repo.Search(ctx, owner, filters)
	if err != nil || len(page.Entries) != 1 {
		t.Fatalf("date bounds: %+v %v", page, err)
	}
	for _, column := range []string{"photo_url", "audio_url"} {
		if _, err := pool.Exec(ctx, "UPDATE entries SET "+column+" = NULL WHERE user_id = $1 AND date = '2026-01-05'", owner); err != nil {
			t.Fatal(err)
		}
		page, err = repo.Search(ctx, owner, filters)
		if err != nil || len(page.Entries) != 0 {
			t.Fatalf("media filter %s: %+v %v", column, page, err)
		}
		if _, err := pool.Exec(ctx, "UPDATE entries SET "+column+" = 'attachment' WHERE user_id = $1 AND date = '2026-01-05'", owner); err != nil {
			t.Fatal(err)
		}
	}
	filters.Tags = []string{"missing"}
	page, err = repo.Search(ctx, owner, filters)
	if err != nil || len(page.Entries) != 0 {
		t.Fatalf("tag filter: %+v %v", page, err)
	}
	filters.Tags = []string{"Calm"}

	filters.Moods = []int{1}
	page, err = repo.Search(ctx, owner, filters)
	if err != nil || len(page.Entries) != 0 {
		t.Fatalf("mood filter: %+v %v", page, err)
	}
	for _, query := range []string{"%", "_", "missing"} {
		page, err := repo.Search(ctx, owner, EntrySearchFilters{Query: query, Moods: []int{}, Tags: []string{}})
		if err != nil || len(page.Entries) != 0 {
			t.Fatalf("literal query %s: %+v %v", query, page, err)
		}
	}
	tags, err := repo.SearchTags(ctx, owner)
	if err != nil || len(tags) != 2 {
		t.Fatalf("own tags: %v %v", tags, err)
	}
}
