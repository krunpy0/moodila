// Package middleware provides cross-cutting Gin middleware.
package middleware

import (
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// CORS allows the configured frontend origins (comma-separated) and answers preflight requests.
func CORS(allowedOriginsStr string) gin.HandlerFunc {
	origins := strings.Split(allowedOriginsStr, ",")
	allowedOrigins := make(map[string]bool)
	for _, o := range origins {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			allowedOrigins[trimmed] = true
		}
	}

	return func(c *gin.Context) {
		reqOrigin := c.Request.Header.Get("Origin")
		if reqOrigin != "" && allowedOrigins[reqOrigin] {
			c.Header("Access-Control-Allow-Origin", reqOrigin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Time-Zone, X-CSRF-Token")
			c.Header("Access-Control-Expose-Headers", "Content-Type, Authorization, X-Time-Zone, X-CSRF-Token")
		}

		if c.Request.Method == "OPTIONS" {
			if reqOrigin != "" && !allowedOrigins[reqOrigin] {
				c.AbortWithStatus(403)
				return
			}
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

// Logger logs method, path, status code, duration, user, and any errors for each request.
func Logger(c *gin.Context) {
	start := time.Now()
	path := c.Request.URL.Path
	rawQuery := c.Request.URL.RawQuery
	if rawQuery != "" {
		path = path + "?" + rawQuery
	}

	c.Next()

	duration := time.Since(start)
	status := c.Writer.Status()
	userID := c.GetString("userID")
	userTag := ""
	if userID != "" {
		userTag = " [user=" + userID + "]"
	}

	errs := c.Errors.String()

	if status >= 500 {
		log.Printf("[HTTP 500 ERROR]%s %s %s -> %d in %s | client=%s | %s", userTag, c.Request.Method, path, status, duration, c.ClientIP(), errs)
	} else if status >= 400 {
		log.Printf("[HTTP %d WARN]%s %s %s -> %d in %s | client=%s | %s", status, userTag, c.Request.Method, path, status, duration, c.ClientIP(), errs)
	} else {
		log.Printf("[HTTP %d]%s %s %s -> %d in %s", status, userTag, c.Request.Method, path, status, duration)
	}
}

