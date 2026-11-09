package repository

import (
	"fmt"
	"testing"
	"time"

	"moodshare/internal/models"
)

func TestSummaryCacheBounded(t *testing.T) {
	cache := NewSummaryCache(time.Hour)
	defer cache.Stop()
	cache.maxItems = 3
	for i := 0; i < 20; i++ {
		key := fmt.Sprintf("user%d:2026-11:all", i)
		cache.Set(key, models.EntrySummary{EntryCount: i})
		if len(cache.items) > cache.maxItems {
			t.Fatalf("cache exceeded limit: %d", len(cache.items))
		}
		if got, ok := cache.Get(key); !ok || got.EntryCount != i {
			t.Fatalf("new item missing: %+v, %v", got, ok)
		}
	}
	cache.Set("user19:2026-11:all", models.EntrySummary{EntryCount: 99})
	if len(cache.items) != 3 {
		t.Fatal("updating an existing item evicted another key")
	}
	if got, _ := cache.Get("user19:2026-11:all"); got.EntryCount != 99 {
		t.Fatal("existing item was not updated")
	}
}

func BenchmarkSummaryCacheFull(b *testing.B) {
	cache := NewSummaryCache(time.Hour)
	defer cache.Stop()
	for i := 0; i < cache.maxItems; i++ {
		cache.Set(fmt.Sprintf("user%d:2026-11:all", i), models.EntrySummary{})
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cache.Set(fmt.Sprintf("new%d:2026-11:all", i), models.EntrySummary{})
	}
}

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

func TestEntriesInvalidateUserCache(t *testing.T) {
	customCache := NewSummaryCache(5 * time.Minute)
	repoWithCustom := Entries{Cache: customCache}

	userA := "userA"
	keyA := userA + ":2026-08:all"
	s := models.EntrySummary{EntryCount: 3}

	customCache.Set(keyA, s)
	repoWithCustom.InvalidateUserCache(userA)
	if _, ok := customCache.Get(keyA); ok {
		t.Fatal("expected userA keyA to be invalidated via repoWithCustom")
	}

	// Test default fallback cache
	repoDefault := Entries{}
	defaultSummaryCache.Set(keyA, s)
	repoDefault.InvalidateUserCache(userA)
	if _, ok := defaultSummaryCache.Get(keyA); ok {
		t.Fatal("expected userA keyA to be invalidated in default cache via repoDefault")
	}
}
