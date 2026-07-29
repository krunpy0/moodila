package handlers

import (
	"errors"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,24}$`)

type Auth struct {
	Users     repository.Users
	JWTSecret string
}

type credentials struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

func (h Auth) Register(c *gin.Context) {
	if h.Users.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	var input credentials
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.Username = strings.ToLower(strings.TrimSpace(input.Username))
	input.DisplayName = strings.TrimSpace(input.DisplayName)
	if input.DisplayName == "" {
		input.DisplayName = input.Username
	}
	if err := validateRegistration(input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not secure password"})
		return
	}
	user, err := h.Users.Create(c.Request.Context(), input.Email, input.Username, input.DisplayName, string(hash))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "email or username already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
		return
	}
	h.respondWithToken(c, http.StatusCreated, user.ID, user)
}

func (h Auth) Login(c *gin.Context) {
	if h.Users.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	var input credentials
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if input.Email == "" || input.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, err := h.Users.ByEmail(c.Request.Context(), input.Email)
	if err != nil || user.PasswordHash == nil ||
		bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(input.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	h.respondWithToken(c, http.StatusOK, user.ID, user)
}

func (h Auth) Session(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"user_id": c.GetString("userID"),
	})
}

func (h Auth) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

func (h Auth) respondWithToken(c *gin.Context, status int, userID string, user any) {
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   userID,
		Issuer:    "moodshare",
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
	})
	signed, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create token"})
		return
	}

	c.JSON(status, gin.H{
		"token": signed,
		"user":  user,
	})
}

func validateRegistration(input credentials) error {
	address, err := mail.ParseAddress(input.Email)
	if err != nil || address.Address != input.Email {
		return errors.New("valid email is required")
	}
	if !usernamePattern.MatchString(input.Username) {
		return errors.New("username must be 3-24 lowercase letters, numbers, or underscores")
	}
	if len(input.DisplayName) > 60 {
		return errors.New("display name must be 60 characters or fewer")
	}
	if len(input.Password) < 8 || len(input.Password) > 72 {
		return errors.New("password must be 8-72 characters")
	}
	return nil
}
