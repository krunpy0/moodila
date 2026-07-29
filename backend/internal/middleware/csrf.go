package middleware

import (
	"github.com/gin-gonic/gin"
)

// CSRF is a no-op middleware retained for backwards compatibility.
// Bearer Token authentication via Authorization header is immune to CSRF.
func CSRF() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}
