package handlers

import (
	"testing"
	"time"
)

func TestValidateEntry(t *testing.T) {
	input := entryInput{
		Date: "2026-07-22",
		Mood: 4,
		Tags: cleanTags([]string{" Calm ", "calm", "Grateful"}),
		Text: "A good day.",
	}
	if err := validateEntryAt(input, time.Date(2026, 7, 22, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("valid entry rejected: %v", err)
	}
	if len(input.Tags) != 2 || input.Tags[0] != "Calm" {
		t.Fatalf("tags not normalized: %#v", input.Tags)
	}

	input.Mood = 6
	if err := validateEntryAt(input, time.Date(2026, 7, 22, 0, 0, 0, 0, time.UTC)); err == nil {
		t.Fatal("invalid mood accepted")
	}
}

func TestMonthBounds(t *testing.T) {
	month, nextMonth, err := monthBounds("2026-12")
	if err != nil {
		t.Fatal(err)
	}
	if month != "2026-12" || nextMonth != "2027-01" {
		t.Fatalf("bounds = %s, %s", month, nextMonth)
	}
	if _, _, err := monthBounds("2026-1"); err == nil {
		t.Fatal("invalid month accepted")
	}
}

func TestValidateEntryRejectsFutureDate(t *testing.T) {
	input := entryInput{Date: "2026-07-23", Mood: 4}
	if err := validateEntryAt(input, time.Date(2026, 7, 22, 0, 0, 0, 0, time.UTC)); err == nil {
		t.Fatal("future date accepted")
	}

	input.Date = "2026-07-22"
	if err := validateEntryAt(input, time.Date(2026, 7, 22, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("current date rejected: %v", err)
	}
}

func TestCurrentDateUsesUserTimeZone(t *testing.T) {
	now := time.Date(2026, 7, 22, 20, 0, 0, 0, time.UTC)
	got, err := currentDate(now, "Asia/Yekaterinburg")
	if err != nil {
		t.Fatal(err)
	}
	if got.Format(time.DateOnly) != "2026-07-23" {
		t.Fatalf("local date = %s", got.Format(time.DateOnly))
	}
}

func TestVisibilityInputValidation(t *testing.T) {
	// Test struct for JSON binding
	v := visibilityInput{}
	if v.IsHidden != nil {
		t.Fatal("expected IsHidden to be nil when not provided")
	}
}

