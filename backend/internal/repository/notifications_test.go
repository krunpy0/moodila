package repository

import (
	"context"
	"testing"
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
}
