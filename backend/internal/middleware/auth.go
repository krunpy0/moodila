package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const jwtIssuer = "moodshare"

type CustomClaims struct {
	jwt.RegisteredClaims
	TokenType string `json:"type,omitempty"`
	CSRF      string `json:"csrf,omitempty"`
}

func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var raw string
		if cookieToken, err := c.Cookie("access_token"); err == nil && strings.TrimSpace(cookieToken) != "" {
			raw = strings.TrimSpace(cookieToken)
		}

		if raw == "" {
			c.AbortWithStatusJSON(401, gin.H{"error": "missing token"})
			return
		}
		claims := &CustomClaims{}
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
		if claims.TokenType != "access" {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid token type"})
			return
		}
		c.Set("userID", claims.Subject)
		c.Set("csrfToken", claims.CSRF)
		c.Next()
	}
}
