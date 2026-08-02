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
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Time-Zone")
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

// Logger logs method, path, status code and duration for each request.
func Logger(c *gin.Context) {
	start := time.Now()
	c.Next()
	log.Printf("%s %s %d %s", c.Request.Method, c.Request.URL.Path, c.Writer.Status(), time.Since(start))
}
