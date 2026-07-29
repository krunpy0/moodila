package repository

import (
	"testing"
	"time"

	"moodshare/internal/models"
)

func TestSummaryCacheHitAndExpiration(t *testing.T) {
	cache := NewSummaryCache(100 * time.Millisecond)

	userID := "user123"
	month := "2026-07"
	key := userID + ":" + month + ":all"

	expected := models.EntrySummary{
		EntryCount:   10,
		DominantMood: func() *int { m := 4; return &m }(),
		TopTag:       func() *string { tag := "Calm"; return &tag }(),
	}

	// Initial miss
	if _, ok := cache.Get(key); ok {
		t.Fatal("expected cache miss initially")
	}

	// Set and hit
	cache.Set(key, expected)
	got, ok := cache.Get(key)
	if !ok {
		t.Fatal("expected cache hit after Set")
	}
	if got.EntryCount != expected.EntryCount || *got.DominantMood != *expected.DominantMood {
		t.Fatalf("unexpected summary returned: %#v", got)
	}

	// Wait for TTL expiration
	time.Sleep(150 * time.Millisecond)
	if _, ok := cache.Get(key); ok {
		t.Fatal("expected cache miss after TTL expiration")
	}
}

func TestSummaryCacheUserInvalidation(t *testing.T) {
	cache := NewSummaryCache(5 * time.Minute)

	userA := "userA"
	userB := "userB"
	keyA1 := userA + ":2026-07:all"
	keyA2 := userA + ":2026-06:visible"
	keyB := userB + ":2026-07:all"

	s := models.EntrySummary{EntryCount: 5}

	cache.Set(keyA1, s)
	cache.Set(keyA2, s)
	cache.Set(keyB, s)

	// Invalidate userA only
	cache.InvalidateUser(userA)

	if _, ok := cache.Get(keyA1); ok {
		t.Fatal("expected userA keyA1 to be invalidated")
	}
	if _, ok := cache.Get(keyA2); ok {
		t.Fatal("expected userA keyA2 to be invalidated")
	}
	if _, ok := cache.Get(keyB); !ok {
		t.Fatal("expected userB keyB to remain valid in cache")
	}
}
