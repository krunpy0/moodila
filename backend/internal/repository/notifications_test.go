package repository

import (
	"context"
	"testing"

	"moodshare/internal/models"
)

func TestNotifications_NilPoolSafety(t *testing.T) {
	repo := Notifications{Pool: nil}
	ctx := context.Background()

	// Test Create
	if err := repo.Create(ctx, "user1", "user2", "like", nil, nil); err != nil {
		t.Fatalf("expected nil error on Create with nil pool, got: %v", err)
	}

	// Test List
	list, err := repo.List(ctx, "user1", 10)
	if err != nil || len(list) != 0 {
		t.Fatalf("expected empty list and nil error, got list=%v err=%v", list, err)
	}

	// Test UnreadCount
	count, err := repo.UnreadCount(ctx, "user1")
	if err != nil || count != 0 {
		t.Fatalf("expected 0 count and nil error, got count=%d err=%v", count, err)
	}

	// Test MarkAsRead
	if err := repo.MarkAsRead(ctx, "user1", []string{"id1"}); err != nil {
		t.Fatalf("expected nil error on MarkAsRead, got: %v", err)
	}

	// Test DeleteOlderThanBatch
	deleted, err := repo.DeleteOlderThanBatch(ctx, 30, 1000)
	if err != nil || deleted != 0 {
		t.Fatalf("expected 0 deleted and nil error, got deleted=%d err=%v", deleted, err)
	}

	// Test PurgeOld
	total, err := repo.PurgeOld(ctx, 30, 1000)
	if err != nil || total != 0 {
		t.Fatalf("expected 0 total and nil error, got total=%d err=%v", total, err)
	}

	// Test NotifyNewPost
	if err := repo.NotifyNewPost(ctx, "author1", models.Entry{ID: "e1"}); err != nil {
		t.Fatalf("expected nil error on NotifyNewPost with nil pool, got: %v", err)
	}
}

func TestFormatPostsCountRu(t *testing.T) {
	tests := []struct {
		count    int
		expected string
	}{
		{1, "1 новую запись"},
		{2, "2 новые записи"},
		{3, "3 новые записи"},
		{4, "4 новые записи"},
		{5, "5 новых записей"},
		{11, "11 новых записей"},
		{12, "12 новых записей"},
		{14, "14 новых записей"},
		{21, "21 новую запись"},
		{22, "22 новые записи"},
		{25, "25 новых записей"},
	}

	for _, tc := range tests {
		got := formatPostsCountRu(tc.count)
		if got != tc.expected {
			t.Errorf("formatPostsCountRu(%d) = %q; want %q", tc.count, got, tc.expected)
		}
	}
}

