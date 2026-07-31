package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"moodshare/internal/config"
	"moodshare/internal/mailer"
	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,24}$`)

type Auth struct {
	Users           repository.Users
	PasswordReset   repository.PasswordReset
	AccountDeletion repository.AccountDeletion
	Mailer          mailer.Mailer
	Config          config.Config
	JWTSecret       string
}

type credentials struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

type forgotPasswordInput struct {
	Email string `json:"email"`
}

type resetPasswordInput struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

type changePasswordInput struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type deleteAccountRequestInput struct {
	Password string `json:"password"`
}

type deleteAccountConfirmInput struct {
	Token string `json:"token"`
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

const neutralResetMessage = "If that email address is in our system, we have sent a password reset link."

func (h Auth) ForgotPassword(c *gin.Context) {
	if h.Users.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	var input forgotPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	// Always return 200 with identical neutral message to protect against user enumeration
	defer func() {
		if !c.IsAborted() {
			c.JSON(http.StatusOK, gin.H{"message": neutralResetMessage})
		}
	}()

	user, err := h.Users.ByExactEmail(c.Request.Context(), email)
	if err != nil {
		// User not found or DB error — keep neutral response
		return
	}

	// Generate 32 crypto-random bytes
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		log.Printf("error generating random reset token: %v", err)
		return
	}
	rawToken := base64.RawURLEncoding.EncodeToString(tokenBytes)

	// SHA-256 hash of raw token
	sum := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(sum[:])

	ttl := h.Config.ResetTokenTTLMinutes
	if ttl <= 0 {
		ttl = 30
	}
	expiresAt := time.Now().Add(time.Duration(ttl) * time.Minute)

	// Save token in DB (atomically invalidating prior tokens for user)
	_, err = h.PasswordReset.Create(c.Request.Context(), user.ID, tokenHash, expiresAt)
	if err != nil {
		log.Printf("error saving password reset token: %v", err)
		return
	}

	baseURL := h.Config.AppBaseURL
	if baseURL == "" {
		baseURL = "http://localhost:5173"
	}
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", baseURL, rawToken)

	// Send email via mailer
	if err := h.Mailer.SendPasswordResetEmail(user.Email, resetURL, ttl); err != nil {
		log.Printf("error sending password reset email: %v", err)
	}
}

func (h Auth) ResetPassword(c *gin.Context) {
	if h.Users.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	var input resetPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	token := strings.TrimSpace(input.Token)
	newPassword := input.NewPassword

	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}
	if len(newPassword) < 8 || len(newPassword) > 72 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be 8-72 characters"})
		return
	}

	sum := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(sum[:])

	err := h.PasswordReset.ResetPassword(c.Request.Context(), tokenHash, newPassword)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidOrExpiredToken) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired password reset token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reset password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

func (h Auth) ChangePassword(c *gin.Context) {
	if h.Users.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input changePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	if len(input.NewPassword) < 8 || len(input.NewPassword) > 72 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be 8-72 characters"})
		return
	}

	user, err := h.Users.ByID(c.Request.Context(), userID)
	if err != nil || user.PasswordHash == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user session invalid or user not found"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(input.OldPassword)) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
		return
	}

	if input.OldPassword == input.NewPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be different from current password"})
		return
	}

	err = h.Users.SetPassword(c.Request.Context(), userID, input.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not change password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

func (h Auth) DeleteAccountRequest(c *gin.Context) {
	if h.Users.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input deleteAccountRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	if input.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password is required to request deletion"})
		return
	}

	user, err := h.Users.ByID(c.Request.Context(), userID)
	if err != nil || user.PasswordHash == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user session invalid or user not found"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(input.Password)) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Incorrect password"})
		return
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		log.Printf("error generating random delete token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate deletion token"})
		return
	}
	rawToken := base64.RawURLEncoding.EncodeToString(tokenBytes)

	sum := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(sum[:])

	ttl := h.Config.AccountDeleteTokenTTLMinutes
	if ttl <= 0 {
		ttl = 30
	}
	expiresAt := time.Now().Add(time.Duration(ttl) * time.Minute)

	_, err = h.AccountDeletion.Create(c.Request.Context(), user.ID, tokenHash, expiresAt)
	if err != nil {
		log.Printf("error saving account deletion token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not process deletion request"})
		return
	}

	baseURL := h.Config.AppBaseURL
	if baseURL == "" {
		baseURL = "http://localhost:5173"
	}
	deleteURL := fmt.Sprintf("%s/account/confirm-delete?token=%s", baseURL, rawToken)

	if err := h.Mailer.SendAccountDeletionEmail(user.Email, deleteURL, ttl); err != nil {
		log.Printf("error sending account deletion email: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deletion confirmation email sent. Please check your inbox."})
}

func (h Auth) DeleteAccountConfirm(c *gin.Context) {
	if h.Users.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return
	}

	var input deleteAccountConfirmInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	token := strings.TrimSpace(input.Token)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}

	sum := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(sum[:])

	tok, err := h.AccountDeletion.GetValidByHash(c.Request.Context(), tokenHash)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidOrExpiredDeleteToken) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired account deletion token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify token"})
		return
	}

	user, err := h.Users.ByID(c.Request.Context(), tok.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user not found"})
		return
	}

	if err := h.Users.DeleteAccount(c.Request.Context(), tok.UserID); err != nil {
		log.Printf("error deleting account %s: %v", tok.UserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete account"})
		return
	}

	_ = h.AccountDeletion.MarkUsed(c.Request.Context(), tok.ID)
	_ = h.Mailer.SendAccountDeletedConfirmationEmail(user.Email)

	c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
}
