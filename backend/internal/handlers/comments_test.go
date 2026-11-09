package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestEditCommentValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, available := range []bool{false, true} {
		h := Feed{}
		if available {
			h.Feed = repository.Feed{Pool: &pgxpool.Pool{}}
		}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "comment_id", Value: "invalid"}}
		c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
		h.EditComment(c)
		want := http.StatusServiceUnavailable
		if available {
			want = http.StatusBadRequest
		}
		if w.Code != want {
			t.Fatalf("edit available=%v: status %d, want %d", available, w.Code, want)
		}
	}
}

func TestEditCommentRejectsInvalidText(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Feed{Feed: repository.Feed{Pool: &pgxpool.Pool{}}}
	for _, body := range []string{`{`, `{"text":"  "}`, `{"text":"` + strings.Repeat("я", 501) + `"}`} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "comment_id", Value: "11111111-1111-4111-8111-111111111111"}}
		c.Request = httptest.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		h.EditComment(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status %d, want 400", w.Code)
		}
	}
}
