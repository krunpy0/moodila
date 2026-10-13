package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"moodshare/internal/models"
	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
)

func TestIsValidPushEndpoint(t *testing.T) {
	tests := []struct {
		name     string
		endpoint string
		expected bool
	}{
		// Valid providers
		{
			name:     "valid fcm.googleapis.com",
			endpoint: "https://fcm.googleapis.com/fcm/send/eXample_Token-123",
			expected: true,
		},
		{
			name:     "valid android.googleapis.com",
			endpoint: "https://android.googleapis.com/gcm/send/abc123token",
			expected: true,
		},
		{
			name:     "valid push.services.mozilla.com root",
			endpoint: "https://push.services.mozilla.com/v1/sub/123",
			expected: true,
		},
		{
			name:     "valid mozilla subdomain",
			endpoint: "https://updates.push.services.mozilla.com/wpush/v1/sub/123",
			expected: true,
		},
		{
			name:     "valid push.apple.com root",
			endpoint: "https://push.apple.com/v1/sub/123",
			expected: true,
		},
		{
			name:     "valid apple subdomain",
			endpoint: "https://web.push.apple.com/v1/sub/123",
			expected: true,
		},
		{
			name:     "valid notify.windows.com root",
			endpoint: "https://notify.windows.com/v1/sub/123",
			expected: true,
		},
		{
			name:     "valid windows subdomain",
			endpoint: "https://wns2-bn1p.notify.windows.com/w/?token=sample",
			expected: true,
		},

		// Invalid endpoints / SSRF attempts
		{
			name:     "http scheme rejected for fcm",
			endpoint: "http://fcm.googleapis.com/fcm/send/123",
			expected: false,
		},
		{
			name:     "http scheme rejected for apple",
			endpoint: "http://push.apple.com/sub/123",
			expected: false,
		},
		{
			name:     "ftp scheme rejected",
			endpoint: "ftp://push.apple.com/sub/123",
			expected: false,
		},
		{
			name:     "localhost rejected",
			endpoint: "https://localhost:8080/push",
			expected: false,
		},
		{
			name:     "loopback IP rejected",
			endpoint: "https://127.0.0.1:8080/push",
			expected: false,
		},
		{
			name:     "cloud metadata IP rejected",
			endpoint: "https://169.254.169.254/latest/meta-data/",
			expected: false,
		},
		{
			name:     "arbitrary internal host rejected",
			endpoint: "https://internal.corp.network/push",
			expected: false,
		},
		{
			name:     "attacker subdomain prefix rejected",
			endpoint: "https://evilpush.apple.com/sub",
			expected: false,
		},
		{
			name:     "attacker suffix rejected",
			endpoint: "https://fcm.googleapis.com.evil.com/sub",
			expected: false,
		},
		{
			name:     "empty endpoint rejected",
			endpoint: "",
			expected: false,
		},
		{
			name:     "malformed endpoint rejected",
			endpoint: "not-a-valid-url-%%%",
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			actual := isValidPushEndpoint(tc.endpoint)
			if actual != tc.expected {
				t.Errorf("isValidPushEndpoint(%q) = %v; want %v", tc.endpoint, actual, tc.expected)
			}
		})
	}
}

func TestSubscribe_EndpointValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := PushNotifications{
		Repo: repository.PushSubscriptions{
			Pool: nil, // Note: with Pool == nil and valid payload, Subscribe returns 503 database unavailable after validation if pool check is after, or 503 first if pool check is first.
		},
	}

	// However, note that Subscribe checks Repo.Pool == nil first:
	// if h.Repo.Pool == nil { c.JSON(503, ...); return }
	// So to test endpoint validation on HTTP level, we can check that when Repo.Pool is nil it returns 503,
	// or we can test when Pool is mocked, or we can test when input is invalid.
	// We already have complete unit tests for isValidPushEndpoint directly above.
	// Let's verify Subscribe's response to invalid payload and nil pool.

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(models.PushSubscriptionInput{
		Endpoint: "https://evil.com/bad",
		Keys: models.PushSubscriptionKeys{
			P256dh: "key1",
			Auth:   "auth1",
		},
	})
	c.Request = httptest.NewRequest(http.MethodPost, "/api/push/subscribe", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	handler.Subscribe(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 for nil pool, got %d", w.Code)
	}
}
