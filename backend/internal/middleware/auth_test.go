package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestAuthAndCSRF(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create access token
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, CustomClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-123",
			Issuer:    jwtIssuer,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
		TokenType: "access",
		CSRF:      "test-csrf-secret",
	})
	signedAccess, err := accessToken.SignedString([]byte("secret"))
	if err != nil {
		t.Fatal(err)
	}

	// Create refresh token
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, CustomClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-123",
			Issuer:    jwtIssuer,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
		},
		TokenType: "refresh",
	})
	signedRefresh, err := refreshToken.SignedString([]byte("secret"))
	if err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.GET("/test", Auth("secret"), func(c *gin.Context) {
		c.String(http.StatusOK, c.GetString("userID"))
	})
	router.POST("/mutate", Auth("secret"), CSRF(), func(c *gin.Context) {
		c.String(http.StatusOK, "success")
	})

	// 1. Valid access_token cookie
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: signedAccess})
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusOK || res.Body.String() != "user-123" {
		t.Fatalf("valid access cookie failed: status=%d body=%q", res.Code, res.Body.String())
	}

	// 2. Reject refresh_token on access endpoint
	req = httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: signedRefresh})
	res = httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("refresh_token accepted as access_token: got status %d", res.Code)
	}

	// 3. Reject Bearer header (no fallback)
	req = httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+signedAccess)
	res = httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("bearer header accepted: got status %d", res.Code)
	}

	// 4. CSRF check on POST: missing X-CSRF-Token header
	req = httptest.NewRequest(http.MethodPost, "/mutate", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: signedAccess})
	res = httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("missing CSRF header accepted: got status %d", res.Code)
	}

	// 5. CSRF check on POST: valid X-CSRF-Token header
	req = httptest.NewRequest(http.MethodPost, "/mutate", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: signedAccess})
	req.Header.Set("X-CSRF-Token", "test-csrf-secret")
	res = httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusOK || res.Body.String() != "success" {
		t.Fatalf("valid CSRF header failed: status=%d body=%q", res.Code, res.Body.String())
	}
}
