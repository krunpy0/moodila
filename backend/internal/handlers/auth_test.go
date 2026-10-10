package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestValidateRegistration(t *testing.T) {
	valid := credentials{
		Email:       "user@example.com",
		Password:    "password",
		Username:    "mood_user",
		DisplayName: "Mood User",
	}
	if err := validateRegistration(valid); err != nil {
		t.Fatalf("valid registration rejected: %v", err)
	}

	validUsernames := []string{
		"mood_user",
		"user-123",
		"user.name",
		"ab",
		"user_with_dots.and-hyphens_99",
	}
	for _, u := range validUsernames {
		v := valid
		v.Username = u
		if err := validateRegistration(v); err != nil {
			t.Errorf("expected username %q to be valid, got: %v", u, err)
		}
	}

	invalidUsernames := []string{
		"a",
		"user@name",
		"user!name",
		"user space",
	}
	for _, u := range invalidUsernames {
		inv := valid
		inv.Username = u
		if err := validateRegistration(inv); err == nil {
			t.Errorf("expected username %q to be invalid, but it passed", u)
		}
	}

	invalid := valid
	invalid.Password = "short"
	if err := validateRegistration(invalid); err == nil {
		t.Fatal("short password accepted")
	}
}

func TestAuth_GetUserIDFromContextOrCookies(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := "test-jwt-secret-12345"
	h := Auth{JWTSecret: secret}

	t.Run("From Gin context", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/auth/logout", nil)
		c.Set("userID", "user-ctx-1")

		uid := h.getUserIDFromContextOrCookies(c)
		if uid != "user-ctx-1" {
			t.Errorf("expected user-ctx-1, got %q", uid)
		}
	})

	t.Run("From refresh_token cookie", func(t *testing.T) {
		claims := CustomClaims{
			RegisteredClaims: jwt.RegisteredClaims{
				Subject:   "user-from-refresh",
				Issuer:    "moodshare",
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			},
			TokenType: "refresh",
		}
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signed, _ := tok.SignedString([]byte(secret))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req := httptest.NewRequest("POST", "/auth/logout", nil)
		req.AddCookie(&http.Cookie{Name: "refresh_token", Value: signed})
		c.Request = req

		uid := h.getUserIDFromContextOrCookies(c)
		if uid != "user-from-refresh" {
			t.Errorf("expected user-from-refresh, got %q", uid)
		}
	})

	t.Run("From expired access_token cookie", func(t *testing.T) {
		claims := CustomClaims{
			RegisteredClaims: jwt.RegisteredClaims{
				Subject:   "user-expired",
				Issuer:    "moodshare",
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)), // expired
			},
			TokenType: "access",
		}
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signed, _ := tok.SignedString([]byte(secret))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req := httptest.NewRequest("POST", "/auth/logout", nil)
		req.AddCookie(&http.Cookie{Name: "access_token", Value: signed})
		c.Request = req

		uid := h.getUserIDFromContextOrCookies(c)
		if uid != "user-expired" {
			t.Errorf("expected user-expired, got %q", uid)
		}
	})

	t.Run("No cookies or context", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("POST", "/auth/logout", nil)

		uid := h.getUserIDFromContextOrCookies(c)
		if uid != "" {
			t.Errorf("expected empty string, got %q", uid)
		}
	})
}

func TestAuth_LogoutHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Auth{JWTSecret: "test-secret"}
	r := gin.New()
	r.POST("/auth/logout", h.Logout)

	req := httptest.NewRequest("POST", "/auth/logout", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
}
