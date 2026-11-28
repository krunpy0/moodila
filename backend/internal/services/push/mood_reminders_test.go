package push

import "testing"

func TestMoodReminderPayload(t *testing.T) {
	for locale, want := range map[string]string{
		"en": "Take a moment to log how you felt today.",
		"ru": "Отметь, как ты себя сегодня чувствуешь.",
	} {
		t.Run(locale, func(t *testing.T) {
			payload := moodReminderPayload(locale)
			if payload.Locale != locale || payload.Body != want || payload.Title == "" ||
				payload.URL != "/entries/new" || payload.Tag != "mood-reminder" || payload.NotificationID != "" {
				t.Fatalf("unexpected reminder payload: %+v", payload)
			}
		})
	}
}
