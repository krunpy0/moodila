package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CSRF checks X-CSRF-Token header against the csrfToken set in context for mutating requests.
func CSRF() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
			headerCSRF := c.GetHeader("X-CSRF-Token")
			expectedCSRF := c.GetString("csrfToken")
			if headerCSRF == "" || expectedCSRF == "" || headerCSRF != expectedCSRF {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "invalid or missing CSRF token"})
				return
			}
		}
		c.Next()
	}
}
