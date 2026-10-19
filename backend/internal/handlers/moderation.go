package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"moodshare/internal/models"
	"moodshare/internal/repository"
	"moodshare/internal/storage"

	"github.com/gin-gonic/gin"
)

type Moderation struct {
	Blocks  repository.Blocks
	Reports repository.Reports
	Entries repository.Entries
	Storage storage.S3
}

type reportInput struct {
	ReportedUserID string  `json:"reported_user_id"`
	EntityType     string  `json:"entity_type"`
	EntityID       *string `json:"entity_id"`
	Reason         string  `json:"reason"`
	Details        string  `json:"details"`
}

func (h Moderation) Block(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if !validUUID(targetID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid user_id is required"})
		return
	}

	userID := c.GetString("userID")
	if userID == targetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot block yourself"})
		return
	}

	if h.Blocks.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	if err := h.Blocks.Block(c.Request.Context(), userID, targetID); err != nil {
		log.Printf("[ERROR] Moderation.Block (user=%s, target=%s): %v", userID, targetID, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not block user"})
		return
	}

	if h.Entries.Pool != nil {
		h.Entries.InvalidateUserCache(userID)
		h.Entries.InvalidateUserCache(targetID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "user blocked successfully"})
}

func (h Moderation) Unblock(c *gin.Context) {
	if h.Blocks.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	targetID := strings.TrimSpace(c.Param("id"))
	if !validUUID(targetID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid user_id is required"})
		return
	}

	userID := c.GetString("userID")
	if err := h.Blocks.Unblock(c.Request.Context(), userID, targetID); err != nil {
		if errors.Is(err, errors.New("block not found")) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user is not blocked"})
			return
		}
		log.Printf("[ERROR] Moderation.Unblock (user=%s, target=%s): %v", userID, targetID, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not unblock user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user unblocked successfully"})
}

func (h Moderation) ListBlocked(c *gin.Context) {
	if h.Blocks.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	userID := c.GetString("userID")
	list, err := h.Blocks.ListBlocked(c.Request.Context(), userID)
	if err != nil {
		log.Printf("[ERROR] Moderation.ListBlocked (user=%s): %v", userID, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list blocked users"})
		return
	}

	for i := range list {
		list[i].AvatarURL = h.Storage.ResolveAccessURL(list[i].AvatarURL)
	}

	c.JSON(http.StatusOK, list)
}

func (h Moderation) Report(c *gin.Context) {
	var input reportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	input.ReportedUserID = strings.TrimSpace(input.ReportedUserID)
	if !validUUID(input.ReportedUserID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid reported_user_id is required"})
		return
	}

	input.Reason = strings.TrimSpace(input.Reason)
	if input.Reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason is required"})
		return
	}

	input.EntityType = strings.ToLower(strings.TrimSpace(input.EntityType))
	if input.EntityType != "entry" && input.EntityType != "comment" && input.EntityType != "user" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "entity_type must be entry, comment, or user"})
		return
	}

	if input.EntityID != nil {
		cleaned := strings.TrimSpace(*input.EntityID)
		if cleaned == "" || !validUUID(cleaned) {
			input.EntityID = nil
		} else {
			input.EntityID = &cleaned
		}
	}

	if h.Reports.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	reporterID := c.GetString("userID")
	report, err := h.Reports.Create(
		c.Request.Context(),
		reporterID,
		input.ReportedUserID,
		input.EntityType,
		input.EntityID,
		input.Reason,
		input.Details,
	)
	if err != nil {
		log.Printf("[ERROR] Moderation.Report (reporter=%s, reported=%s): %v", reporterID, input.ReportedUserID, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not submit report"})
		return
	}

	c.JSON(http.StatusCreated, report)
}

func (h Moderation) CheckCanInteract(c *gin.Context, targetUserID string) bool {
	if h.Blocks.Pool == nil {
		return true
	}
	userID := c.GetString("userID")
	if userID == "" || targetUserID == "" {
		return true
	}
	blocked, err := h.Blocks.IsBlockedBetween(c.Request.Context(), userID, targetUserID)
	if err != nil {
		return false
	}
	return !blocked
}

func (h Moderation) ListReportsAdmin(c *gin.Context) {
	if h.Reports.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	status := strings.TrimSpace(c.Query("status"))
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	reports, err := h.Reports.ListAdmin(c.Request.Context(), status, limit, offset)
	if err != nil {
		log.Printf("[ERROR] Moderation.ListReportsAdmin: %v", err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list reports"})
		return
	}

	for i := range reports {
		reports[i].EntryPhotoURL = h.Storage.ResolveAccessURL(reports[i].EntryPhotoURL)
		reports[i].EntryAudioURL = h.Storage.ResolveAccessURL(reports[i].EntryAudioURL)
		reports[i].ReportedAvatarURL = h.Storage.ResolveAccessURL(reports[i].ReportedAvatarURL)
	}

	c.JSON(http.StatusOK, gin.H{"reports": reports})
}

type updateReportStatusInput struct {
	Status string `json:"status"`
}

func (h Moderation) UpdateReportStatusAdmin(c *gin.Context) {
	reportID := strings.TrimSpace(c.Param("id"))
	if !validUUID(reportID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid report id is required"})
		return
	}

	var input updateReportStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	input.Status = strings.TrimSpace(strings.ToLower(input.Status))
	if input.Status != "pending" && input.Status != "reviewed" && input.Status != "dismissed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be pending, reviewed, or dismissed"})
		return
	}

	if h.Reports.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	if err := h.Reports.UpdateStatusAdmin(c.Request.Context(), reportID, input.Status); err != nil {
		log.Printf("[ERROR] Moderation.UpdateReportStatusAdmin (id=%s, status=%s): %v", reportID, input.Status, err)
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update report status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": input.Status})
}

func (h Moderation) DeleteReportedContentAdmin(c *gin.Context) {
	reportID := strings.TrimSpace(c.Param("id"))
	if !validUUID(reportID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid report id is required"})
		return
	}

	if h.Reports.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	report, err := h.Reports.GetReport(c.Request.Context(), reportID)
	if err != nil {
		log.Printf("[ERROR] Moderation.DeleteReportedContentAdmin (id=%s): %v", reportID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}

	if report.EntityID == nil || *report.EntityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "report has no associated entity_id"})
		return
	}

	entityID := *report.EntityID

	if report.EntityType == "entry" {
		authorID, attachments, err := h.Entries.DeleteAdmin(c.Request.Context(), entityID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			log.Printf("[ERROR] Moderation.DeleteReportedContentAdmin entry (id=%s): %v", entityID, err)
			_ = c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete entry"})
			return
		}
		if len(attachments) > 0 && authorID != "" {
			for _, att := range attachments {
				if att.PhotoURL != nil && *att.PhotoURL != "" {
					if key, err := h.Storage.ExtractObjectKey(*att.PhotoURL, authorID); err == nil {
						_ = h.Storage.Delete(c.Request.Context(), key)
					}
				}
				if att.AudioURL != nil && *att.AudioURL != "" {
					if key, err := h.Storage.ExtractObjectKey(*att.AudioURL, authorID); err == nil {
						_ = h.Storage.Delete(c.Request.Context(), key)
					}
				}
			}
		}
	} else if report.EntityType == "comment" {
		if err := h.Reports.DeleteCommentAdmin(c.Request.Context(), entityID); err != nil {
			log.Printf("[ERROR] Moderation.DeleteReportedContentAdmin comment (id=%s): %v", entityID, err)
			_ = c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete comment"})
			return
		}
	}

	// Auto-mark report as reviewed
	_ = h.Reports.UpdateStatusAdmin(c.Request.Context(), reportID, "reviewed")

	c.JSON(http.StatusOK, gin.H{"message": "content deleted", "status": "reviewed"})
}

var _ models.BlockedUser

