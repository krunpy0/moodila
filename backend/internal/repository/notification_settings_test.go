package repository

import (
	"context"
	"testing"

	"moodshare/internal/models"
)

func TestNotificationSettings_NilPoolSafety(t *testing.T) {
	repo := NotificationSettings{Pool: nil}
	ctx := context.Background()

	// GetByUserID should return default enabled settings
	settings, err := repo.GetByUserID(ctx, "user1")
	if err != nil {
		t.Fatalf("expected nil error on GetByUserID with nil pool, got: %v", err)
	}
	if !settings.NotifyNewPosts || !settings.NotifyReactions || !settings.NotifyComments || !settings.NotifyFriendRequests {
		t.Fatalf("expected all notification settings to default to true, got: %+v", settings)
	}

	// Update should return default settings when pool is nil
	fVal := false
	updated, err := repo.Update(ctx, "user1", models.NotificationSettingsInput{
		NotifyNewPosts: &fVal,
	})
	if err != nil {
		t.Fatalf("expected nil error on Update with nil pool, got: %v", err)
	}
	if updated.UserID != "user1" {
		t.Fatalf("expected userID 'user1', got: %s", updated.UserID)
	}
}
