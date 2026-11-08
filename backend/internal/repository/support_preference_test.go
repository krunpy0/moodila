package repository

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"moodshare/internal/db"
)

func TestSupportPreferenceIntegration(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := db.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool, nil); err != nil {
		t.Fatal(err)
	}
	users := Users{Pool: pool}
	entries := Entries{Pool: pool}
	feed := Feed{Pool: pool}
	friends := Friends{Pool: pool}
	createUser := func(name string) string {
		t.Helper()
		suffix := fmt.Sprintf("%s%d", name, time.Now().UnixNano())
		user, err := users.Create(ctx, suffix+"@test.com", suffix, name, "test")
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", user.ID) })
		return user.ID
	}
	author, friend, stranger := createUser("author"), createUser("friend"), createUser("stranger")
	request, err := friends.Request(ctx, author, friend)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = friends.Respond(ctx, request.ID, friend, "accepted"); err != nil {
		t.Fatal(err)
	}
	save := func(date string, preference *string) string {
		t.Helper()
		entry, _, _, err := entries.Save(ctx, author, date, 3, []string{}, "Note", nil, nil, nil, nil, preference, nil)
		if err != nil {
			t.Fatal(err)
		}
		return entry.ID
	}
	date := "2026-07-22"
	id := save(date, nil)
	oldComment, err := feed.AddComment(ctx, friend, id, "Already here")
	if err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{"listen", "advice", "reach_out", "no_discussion", ""} {
		save(date, &value)
		entry, err := entries.ByDate(ctx, author, date)
		if err != nil || entry.SupportPreference != value {
			t.Fatalf("ByDate: %+v, %v", entry, err)
		}
		page, cursor, err := feed.List(ctx, friend, 10, "", false)
		if err != nil || len(page) != 1 || page[0].SupportPreference != value || cursor != "" {
			t.Fatalf("feed: %+v, %v", page, err)
		}
		calendar, err := entries.VisibleByMonth(ctx, author, friend, "2026-07", "2026-08")
		if err != nil || len(calendar) != 1 || calendar[0].SupportPreference != value {
			t.Fatalf("calendar: %+v, %v", calendar, err)
		}
		_, err = feed.AddComment(ctx, friend, id, "New comment")
		if value == "no_discussion" {
			if !errors.Is(err, ErrCommentsClosed) {
				t.Fatalf("closed discussion: %v", err)
			}
			if _, err = feed.AddComment(ctx, author, id, "Author comment"); !errors.Is(err, ErrCommentsClosed) {
				t.Fatalf("author bypass: %v", err)
			}
			if _, err = feed.React(ctx, friend, id, "❤️"); err != nil {
				t.Fatalf("reaction: %v", err)
			}
		} else if err != nil {
			t.Fatal(err)
		}
	}
	closed := "no_discussion"
	save(date, &closed)
	save(date, nil)
	entry, err := entries.ByDate(ctx, author, date)
	if err != nil || entry.SupportPreference != closed {
		t.Fatalf("omitted field lost preference: %v", err)
	}
	newID := save("2026-07-23", nil)
	newEntry, err := entries.ByDate(ctx, author, "2026-07-23")
	if err != nil || newEntry.SupportPreference != "" || newID == id {
		t.Fatal("preference carried to next day")
	}
	comments, err := feed.GetComments(ctx, friend, id)
	if err != nil || len(comments) != 5 || comments[0].ID != oldComment.ID {
		t.Fatalf("existing comments: %+v, %v", comments, err)
	}
	if _, err = feed.AddComment(ctx, stranger, id, "Private"); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("stranger access: %v", err)
	}
	if _, err = feed.GetComments(ctx, stranger, id); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("stranger read: %v", err)
	}
	page, _, err := feed.List(ctx, stranger, 10, "", false)
	if err != nil || len(page) != 0 {
		t.Fatalf("stranger feed: %+v, %v", page, err)
	}
	hidden := true
	if _, err = entries.UpdateVisibility(ctx, id, author, hidden); err != nil {
		t.Fatal(err)
	}
	if _, err = feed.GetComments(ctx, friend, id); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("hidden entry: %v", err)
	}
}
