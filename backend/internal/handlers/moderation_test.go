package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestModeration_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Moderation{}

	t.Run("Block invalid UUID", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = []gin.Param{{Key: "id", Value: "not-a-uuid"}}
		c.Request = httptest.NewRequest("POST", "/users/not-a-uuid/block", nil)
		c.Set("userID", "00000000-0000-0000-0000-000000000001")

		h.Block(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for invalid UUID, got %d", w.Code)
		}
	})

	t.Run("Block self rejected", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = []gin.Param{{Key: "id", Value: "00000000-0000-0000-0000-000000000001"}}
		c.Request = httptest.NewRequest("POST", "/users/00000000-0000-0000-0000-000000000001/block", nil)
		c.Set("userID", "00000000-0000-0000-0000-000000000001")

		h.Block(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for blocking self, got %d", w.Code)
		}
	})

	t.Run("Report invalid JSON or missing reason", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := bytes.NewBufferString(`{"reported_user_id":"00000000-0000-0000-0000-000000000002","entity_type":"user","reason":""}`)
		c.Request = httptest.NewRequest("POST", "/reports", body)
		c.Request.Header.Set("Content-Type", "application/json")
		c.Set("userID", "00000000-0000-0000-0000-000000000001")

		h.Report(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for empty reason, got %d", w.Code)
		}
	})
}
