package middleware

import (
	"errors"
	"net/http"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func Admin(usersRepo repository.Users) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("userID")
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if usersRepo.Pool == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
			return
		}

		user, err := usersRepo.ByID(c.Request.Context(), userID)
		if errors.Is(err, pgx.ErrNoRows) || !user.IsAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "could not verify admin status"})
			return
		}

		c.Next()
	}
}
