package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CSRF enforces double-submit cookie validation for mutating requests (POST, PUT, PATCH, DELETE).
func CSRF() gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		if path == "/auth/login" || path == "/auth/register" || path == "/auth/logout" || path == "/health" {
			c.Next()
			return
		}

		csrfCookie, err := c.Cookie("csrf_token")
		csrfHeader := strings.TrimSpace(c.GetHeader("X-CSRF-Token"))

		if err != nil || csrfCookie == "" || csrfHeader == "" || csrfCookie != csrfHeader {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "CSRF token mismatch or missing"})
			return
		}

		c.Next()
	}
}
