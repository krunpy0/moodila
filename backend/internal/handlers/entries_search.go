package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
)

func validateSearchFilters(q, tag, mood, from, to string) (int, error) {
	if utf8.RuneCountInString(q) > 200 || utf8.RuneCountInString(tag) > 64 {
		return 0, errors.New("search text is too long")
	}
	value := 0
	if mood != "" {
		var err error
		value, err = strconv.Atoi(mood)
		if err != nil || value < 1 || value > 5 {
			return 0, errors.New("mood must be between 1 and 5")
		}
	}
	for _, date := range []string{from, to} {
		if date == "" {
			continue
		}
		if _, err := time.Parse("2006-01-02", date); err != nil || strings.HasPrefix(date, "0000-") {
			return 0, errors.New("date must be YYYY-MM-DD")
		}
	}
	if from != "" && to != "" && from > to {
		return 0, errors.New("from must not be after to")
	}
	return value, nil
}

func parseEntrySearch(c *gin.Context) (repository.EntrySearchFilters, error) {
	f := repository.EntrySearchFilters{Query: strings.TrimSpace(c.Query("q")), From: c.Query("from"), To: c.Query("to"), Cursor: c.Query("cursor"), Moods: []int{}, Tags: c.QueryArray("tag")}
	if f.Tags == nil {
		f.Tags = []string{}
	}
	if _, err := validateSearchFilters(f.Query, "", "", f.From, f.To); err != nil {
		return f, err
	}
	if _, err := validateSearchFilters("", "", "", f.Cursor, ""); err != nil {
		return f, err
	}
	moods := c.QueryArray("mood")
	if len(moods) > 5 || len(f.Tags) > 30 {
		return f, errors.New("too many filters")
	}
	for _, mood := range moods {
		value, err := validateSearchFilters("", "", mood, "", "")
		if err != nil || value == 0 {
			return f, errors.New("invalid mood")
		}
		f.Moods = append(f.Moods, value)
	}
	for _, tag := range f.Tags {
		if strings.TrimSpace(tag) == "" {
			return f, errors.New("tag must not be empty")
		}
		if _, err := validateSearchFilters("", tag, "", "", ""); err != nil {
			return f, err
		}
	}
	for key, target := range map[string]*bool{"photo": &f.Photo, "audio": &f.Audio} {
		value := c.Query(key)
		if value != "" && value != "true" && value != "false" {
			return f, errors.New("media filter must be true or false")
		}
		*target = value == "true"
	}
	return f, nil
}

func (h Entries) Search(c *gin.Context) {
	f, err := parseEntrySearch(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	userID := c.GetString("userID")
	if userID == "" {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	page, err := h.Entries.Search(c.Request.Context(), userID, f)
	if err != nil {
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not search entries"})
		return
	}
	c.Header("Cache-Control", "private, no-store")
	c.JSON(http.StatusOK, page)
}

func (h Entries) SearchTags(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	if h.Entries.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}
	tags, err := h.Entries.SearchTags(c.Request.Context(), userID)
	if err != nil {
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load tags"})
		return
	}
	c.Header("Cache-Control", "private, no-store")
	c.JSON(http.StatusOK, tags)
}
