package repository

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"moodshare/internal/db"
	"moodshare/internal/models"
)

func TestMoodRemindersIntegration(t *testing.T) {
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
	settings := NotificationSettings{Pool: pool}
	users := Users{Pool: pool}
	subs := PushSubscriptions{Pool: pool}
	var userIDs []string
	defer func() {
		if _, err := pool.Exec(ctx, "DELETE FROM users WHERE id = ANY($1::uuid[])", userIDs); err != nil {
			t.Error(err)
		}
	}()
	create := func(zone, locale string, subscribed bool) string {
		t.Helper()
		name := fmt.Sprintf("reminder%d", time.Now().UnixNano())
		user, err := users.Create(ctx, name+"@test.com", name, "Reminder", "test")
		if err != nil {
			t.Fatal(err)
		}
		userIDs = append(userIDs, user.ID)
		if subscribed {
			err := subs.Save(ctx, user.ID, models.PushSubscriptionInput{Endpoint: "https://fcm.googleapis.com/" + name})
			if err != nil {
				t.Fatal(err)
			}
		}
		if _, err := settings.Update(ctx, user.ID, models.NotificationSettingsInput{Locale: &locale, TimeZone: &zone}); err != nil {
			t.Fatal(err)
		}
		return user.ID
	}

	due := create("Asia/Kathmandu", "en", true)
	recorded := create("Asia/Kathmandu", "ru", true)
	otherZone := create("Europe/Berlin", "ru", true)
	optedOut := create("Asia/Kathmandu", "ru", true)
	enabled := false
	if saved, err := settings.Update(ctx, optedOut, models.NotificationSettingsInput{NotifyMoodReminders: &enabled}); err != nil || saved.NotifyMoodReminders || !saved.NotifyComments {
		t.Fatalf("disable reminders: %+v, %v", saved, err)
	}
	locale, zone := "en", "Asia/Kathmandu"
	if _, err := settings.Update(ctx, optedOut, models.NotificationSettingsInput{Locale: &locale, TimeZone: &zone}); err != nil {
		t.Fatal(err)
	}
	if saved, err := settings.GetByUserID(ctx, optedOut); err != nil || saved.NotifyMoodReminders {
		t.Fatalf("sync must keep reminders disabled: %+v, %v", saved, err)
	}
	create("Asia/Kathmandu", "ru", false)
	create("invalid/zone", "ru", true)
	if _, err := pool.Exec(ctx, `INSERT INTO entries (user_id, date, mood, is_hidden)
		VALUES ($1, '2026-07-22', 3, true), ($2, '2026-07-21', 3, true)`, recorded, due); err != nil {
		t.Fatal(err)
	}

	check := func(hour, minute int, want ...MoodReminder) {
		t.Helper()
		got, err := settings.ClaimMoodReminders(ctx, time.Date(2026, 7, 22, hour, minute, 0, 0, time.UTC))
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != len(want) || (len(want) != 0 && !reflect.DeepEqual(got, want)) {
			t.Fatalf("%02d:%02d UTC: got %+v, want %+v", hour, minute, got, want)
		}
	}
	check(14, 14)
	check(14, 15, MoodReminder{UserID: due, Locale: "en"})
	check(14, 16)
	enabled = true
	if saved, err := settings.Update(ctx, optedOut, models.NotificationSettingsInput{NotifyMoodReminders: &enabled}); err != nil || !saved.NotifyMoodReminders {
		t.Fatalf("enable reminders: %+v, %v", saved, err)
	}
	check(14, 17, MoodReminder{UserID: optedOut, Locale: "en"})
	check(18, 0, MoodReminder{UserID: otherZone, Locale: "ru"})
}
