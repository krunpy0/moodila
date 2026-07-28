package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

func TestRateLimit_AllowsWithinBurst(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// 1 request per second, burst 2
	router.GET("/test", RateLimit(rate.Every(time.Second), 2, IPKey), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Request 1: allowed
	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w1.Code)
	}
	if w1.Header().Get("X-RateLimit-Limit") != "2" {
		t.Fatalf("expected X-RateLimit-Limit=2, got %s", w1.Header().Get("X-RateLimit-Limit"))
	}

	// Request 2: allowed
	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w2.Code)
	}

	// Request 3: blocked (burst exceeded)
	req3 := httptest.NewRequest(http.MethodGet, "/test", nil)
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429, got %d", w3.Code)
	}
	if w3.Header().Get("Retry-After") == "" {
		t.Fatalf("expected Retry-After header to be set")
	}

	var resp map[string]string
	if err := json.Unmarshal(w3.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal JSON response: %v", err)
	}
	if resp["error"] != "rate limit exceeded, please try again later" {
		t.Fatalf("unexpected error message: %s", resp["error"])
	}
}

func TestRateLimit_UserKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.Use(func(c *gin.Context) {
		if uid := c.GetHeader("X-User-ID"); uid != "" {
			c.Set("userID", uid)
		}
		c.Next()
	})

	// 1 per minute, burst 1
	router.GET("/protected", RateLimit(rate.Every(time.Minute), 1, UserOrIPKey), func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// User A request 1 -> OK
	reqA1 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	reqA1.Header.Set("X-User-ID", "user-A")
	wA1 := httptest.NewRecorder()
	router.ServeHTTP(wA1, reqA1)

	if wA1.Code != http.StatusOK {
		t.Fatalf("User A req 1 expected 200, got %d", wA1.Code)
	}

	// User A request 2 -> 429
	reqA2 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	reqA2.Header.Set("X-User-ID", "user-A")
	wA2 := httptest.NewRecorder()
	router.ServeHTTP(wA2, reqA2)

	if wA2.Code != http.StatusTooManyRequests {
		t.Fatalf("User A req 2 expected 429, got %d", wA2.Code)
	}

	// User B request 1 -> OK (different user key)
	reqB1 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	reqB1.Header.Set("X-User-ID", "user-B")
	wB1 := httptest.NewRecorder()
	router.ServeHTTP(wB1, reqB1)

	if wB1.Code != http.StatusOK {
		t.Fatalf("User B req 1 expected 200, got %d", wB1.Code)
	}
}
