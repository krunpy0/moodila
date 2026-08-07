package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"moodshare/internal/models"
	"moodshare/internal/repository"
	"moodshare/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type Entries struct {
	Entries repository.Entries
	Storage storage.S3
}


type entryInput struct {
	Date          string   `json:"date"`
	Mood          int      `json:"mood"`
	Tags          []string `json:"tags"`
	Text          string   `json:"text"`
	PhotoURL      *string  `json:"photo_url"`
	AudioURL      *string  `json:"audio_url"`
	AudioDuration *int     `json:"audio_duration"`
	IsHidden      *bool    `json:"is_hidden"`
}

type visibilityInput struct {
	IsHidden *bool `json:"is_hidden"`
}

func (h Entries) Save(c *gin.Context) {
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	var input entryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	input.Date = strings.TrimSpace(input.Date)
	input.Text = strings.TrimSpace(input.Text)
	if input.PhotoURL != nil {
		photoURL := strings.TrimSpace(*input.PhotoURL)
		if photoURL == "" {
			input.PhotoURL = nil
		} else if len(photoURL) > 4096 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "photo_url is too long"})
			return
		} else {
			cleaned := h.Storage.CleanURL(&photoURL)
			if cleaned == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "photo_url must be a valid key or URL"})
				return
			}
			input.PhotoURL = cleaned
		}
	}
	if input.AudioURL != nil {
		audioURL := strings.TrimSpace(*input.AudioURL)
		if audioURL == "" {
			input.AudioURL = nil
		} else if len(audioURL) > 4096 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "audio_url is too long"})
			return
		} else {
			cleaned := h.Storage.CleanURL(&audioURL)
			if cleaned == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "audio_url must be a valid key or URL"})
				return
			}
			input.AudioURL = cleaned
		}
	}
	if input.AudioDuration != nil && (*input.AudioDuration < 0 || *input.AudioDuration > 300) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio_duration is invalid"})
		return
	}
	input.Tags = cleanTags(input.Tags)
	today, err := currentDate(time.Now(), c.GetHeader("X-Time-Zone"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid time zone"})
		return
	}
	if err := validateEntryAt(input, today); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	entry, err := h.Entries.Save(
		c.Request.Context(), c.GetString("userID"), input.Date, input.Mood, input.Tags, input.Text, input.PhotoURL, input.AudioURL, input.AudioDuration, input.IsHidden,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save entry"})
		return
	}
	c.JSON(http.StatusOK, h.resolveEntry(entry))
}

func (h Entries) resolveEntry(e models.Entry) models.Entry {
	e.PhotoURL = h.Storage.ResolveAccessURL(e.PhotoURL)
	e.AudioURL = h.Storage.ResolveAccessURL(e.AudioURL)
	return e
}

func (h Entries) resolveCalendarEntries(entries []models.CalendarEntry) []models.CalendarEntry {
	out := make([]models.CalendarEntry, len(entries))
	for i, e := range entries {
		e.PhotoURL = h.Storage.ResolveAccessURL(e.PhotoURL)
		e.AudioURL = h.Storage.ResolveAccessURL(e.AudioURL)
		out[i] = e
	}
	return out
}

func (h Entries) Me(c *gin.Context) {
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	if month := strings.TrimSpace(c.Query("month")); month != "" {
		_, nextMonth, err := monthBounds(month)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "month must be YYYY-MM"})
			return
		}
		entries, err := h.Entries.ByMonth(
			c.Request.Context(),
			c.GetString("userID"),
			month,
			nextMonth,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load entries"})
			return
		}
		c.JSON(http.StatusOK, h.resolveCalendarEntries(entries))
		return
	}

	date := strings.TrimSpace(c.Query("date"))
	if _, err := time.Parse(time.DateOnly, date); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date must be YYYY-MM-DD"})
		return
	}
	entry, err := h.Entries.ByDate(c.Request.Context(), c.GetString("userID"), date)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "entry not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load entry"})
		return
	}
	c.JSON(http.StatusOK, h.resolveEntry(entry))
}

func (h Entries) Summary(c *gin.Context) {
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	month, nextMonth, err := monthBounds(strings.TrimSpace(c.Query("month")))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month must be YYYY-MM"})
		return
	}
	summary, err := h.Entries.Summary(c.Request.Context(), c.GetString("userID"), month, nextMonth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load summary"})
		return
	}
	c.JSON(http.StatusOK, summary)
}

// Friend returns a friend's public calendar entries for the requested month.
// Calendar access is deliberately restricted to accepted friendships.
func (h Entries) Friend(c *gin.Context) {
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	friendID := strings.TrimSpace(c.Param("friend_id"))
	if !validUUID(friendID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "friend_id must be a valid UUID"})
		return
	}
	month, nextMonth, err := monthBounds(strings.TrimSpace(c.Query("month")))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month must be YYYY-MM"})
		return
	}

	requesterID := c.GetString("userID")
	var allowed bool
	if requesterID == friendID {
		allowed = true
	} else {
		allowed, err = h.Entries.CanViewFriend(c.Request.Context(), requesterID, friendID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify friendship"})
			return
		}
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "friend calendar is unavailable"})
		return
	}

	entries, err := h.Entries.VisibleByMonth(c.Request.Context(), friendID, month, nextMonth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load friend entries"})
		return
	}
	c.JSON(http.StatusOK, h.resolveCalendarEntries(entries))
}

func (h Entries) Visibility(c *gin.Context) {
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	entryID := strings.TrimSpace(c.Param("id"))
	if !validUUID(entryID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
		return
	}

	var input visibilityInput
	if err := c.ShouldBindJSON(&input); err != nil || input.IsHidden == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "is_hidden (boolean) is required"})
		return
	}

	entry, err := h.Entries.UpdateVisibility(c.Request.Context(), entryID, c.GetString("userID"), *input.IsHidden)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "entry not found"})
		return
	}
	if errors.Is(err, repository.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update visibility"})
		return
	}
	c.JSON(http.StatusOK, h.resolveEntry(entry))
}

func (h Entries) cleanupAttachments(ctx context.Context, userID string, attachments []repository.AttachmentURLs) {
	for _, att := range attachments {
		if att.PhotoURL != nil && *att.PhotoURL != "" {
			if key, err := h.Storage.ExtractObjectKey(*att.PhotoURL, userID); err == nil {
				if err := h.Storage.Delete(ctx, key); err != nil {
					log.Printf("warning: failed to delete entry photo from storage (%s): %v", key, err)
				}
			}
		}
		if att.AudioURL != nil && *att.AudioURL != "" {
			if key, err := h.Storage.ExtractObjectKey(*att.AudioURL, userID); err == nil {
				if err := h.Storage.Delete(ctx, key); err != nil {
					log.Printf("warning: failed to delete entry audio from storage (%s): %v", key, err)
				}
			}
		}
	}
}

func (h Entries) Delete(c *gin.Context) {
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	userID := c.GetString("userID")
	entryID := strings.TrimSpace(c.Param("id"))

	if entryID != "" {
		if !validUUID(entryID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id must be a valid UUID"})
			return
		}
		attachments, err := h.Entries.Delete(c.Request.Context(), entryID, userID)
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "entry not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete entry"})
			return
		}
		h.cleanupAttachments(c.Request.Context(), userID, attachments)
		c.JSON(http.StatusOK, gin.H{"message": "entry deleted"})
		return
	}

	date := strings.TrimSpace(c.Query("date"))
	if _, err := time.Parse(time.DateOnly, date); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id or date YYYY-MM-DD is required"})
		return
	}
	attachments, err := h.Entries.DeleteByDate(c.Request.Context(), userID, date)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "entry not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete entry"})
		return
	}
	h.cleanupAttachments(c.Request.Context(), userID, attachments)
	c.JSON(http.StatusOK, gin.H{"message": "entry deleted"})
}



func monthBounds(month string) (string, string, error) {
	start, err := time.Parse("2006-01", month)
	if err != nil || start.Format("2006-01") != month {
		return "", "", errors.New("invalid month")
	}
	return month, start.AddDate(0, 1, 0).Format("2006-01"), nil
}

func validateEntryAt(input entryInput, today time.Time) error {
	date, err := time.Parse(time.DateOnly, input.Date)
	if err != nil {
		return errors.New("date must be YYYY-MM-DD")
	}
	if date.After(today) {
		return errors.New("date cannot be in the future")
	}
	if input.Mood < 1 || input.Mood > 5 {
		return errors.New("mood must be between 1 and 5")
	}
	if len(input.Tags) > 10 {
		return errors.New("choose at most 10 tags")
	}
	for _, tag := range input.Tags {
		if tag == "" || len(tag) > 24 {
			return errors.New("tags must be 1-24 characters")
		}
	}
	if len(input.Text) > 5000 {
		return errors.New("text must be 5000 characters or fewer")
	}
	return nil
}

func currentDate(now time.Time, timeZone string) (time.Time, error) {
	location := time.UTC
	if timeZone = strings.TrimSpace(timeZone); timeZone != "" {
		var err error
		location, err = time.LoadLocation(timeZone)
		if err != nil {
			return time.Time{}, err
		}
	}
	local := now.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC), nil
}

func cleanTags(tags []string) []string {
	clean := make([]string, 0, len(tags))
	seen := make(map[string]bool, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		key := strings.ToLower(tag)
		if tag != "" && !seen[key] {
			seen[key] = true
			clean = append(clean, tag)
		}
	}
	return clean
}
