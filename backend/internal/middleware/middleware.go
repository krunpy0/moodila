// Package middleware provides cross-cutting Gin middleware.
package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// CORS allows the configured frontend origin and answers preflight requests.
func CORS(origin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Time-Zone, X-CSRF-Token")
		if c.Request.Method == "OPTIONS" {
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
