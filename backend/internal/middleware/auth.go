package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const jwtIssuer = "moodshare"

func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var raw string
		if cookieToken, err := c.Cookie("token"); err == nil && strings.TrimSpace(cookieToken) != "" {
			raw = strings.TrimSpace(cookieToken)
		} else {
			header := c.GetHeader("Authorization")
			if strings.HasPrefix(header, "Bearer ") {
				raw = strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
			}
		}

		if raw == "" {
			c.AbortWithStatusJSON(401, gin.H{"error": "missing token"})
			return
		}
		claims := &jwt.RegisteredClaims{}
		token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		}, jwt.WithIssuer(jwtIssuer))
		if err != nil || !token.Valid || claims.Subject == "" {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid or expired token"})
			return
		}
		c.Set("userID", claims.Subject)
		c.Next()
	}
}
