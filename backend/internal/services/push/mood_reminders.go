package push

import (
	"context"
	"log"
	"time"

	"moodshare/internal/models"
	"moodshare/internal/repository"
)

func (s *Service) RunMoodReminders(ctx context.Context, settings repository.NotificationSettings) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for ctx.Err() == nil {
		s.sendMoodReminders(ctx, settings)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Service) sendMoodReminders(ctx context.Context, settings repository.NotificationSettings) {
	queryCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// shortcut: a restart after claiming can lose queued reminders, use a durable outbox if retries are needed.
	reminders, err := settings.ClaimMoodReminders(queryCtx, time.Now())
	if err != nil {
		log.Printf("[push] could not claim mood reminders: %v", err)
		return
	}
	usersByLocale := make(map[string][]string)
	for _, reminder := range reminders {
		usersByLocale[reminder.Locale] = append(usersByLocale[reminder.Locale], reminder.UserID)
	}
	for locale, users := range usersByLocale {
		if err := s.enqueue(queryCtx, users, moodReminderPayload(locale), "3600"); err != nil {
			log.Printf("[push] could not queue mood reminder: %v", err)
		}
	}
}

func moodReminderPayload(locale string) models.PushPayload {
	payload := models.PushPayload{
		Tag: "mood-reminder",
		URL: "/entries/new",
	}
	if locale == "en" {
		payload.Locale = "en"
		payload.Title = "How was your day?"
		payload.Body = "Take a moment to log how you felt today."
	} else {
		payload.Locale = "ru"
		payload.Title = "Как прошёл день?"
		payload.Body = "Отметь, как ты себя сегодня чувствуешь."
	}
	return payload
}
