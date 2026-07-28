package handlers

import (
	"log"
	"moodshare/internal/storage"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	maxPhotoBytes       = 10 * 1024 * 1024
	storageUploadIssuer = "moodshare-storage"
)

type Storage struct {
	Storage      storage.S3
	JWTSecret    string
	UploadAPIURL string
}

type uploadInput struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
}

type uploadClaims struct {
	ObjectKey   string `json:"object_key"`
	ContentType string `json:"content_type"`
	MaxSize     int64  `json:"max_size"`
	jwt.RegisteredClaims
}

func cleanContentType(ct string) string {
	return strings.ToLower(strings.TrimSpace(strings.Split(ct, ";")[0]))
}

func (h Storage) SignUpload(c *gin.Context) {
	var input uploadInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	input.Filename = strings.TrimSpace(input.Filename)
	input.ContentType = cleanContentType(input.ContentType)
	if input.Filename == "" || len(input.Filename) > 255 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "filename is required"})
		return
	}
	if input.Size <= 0 || input.Size > maxPhotoBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image must be 10 MB or smaller"})
		return
	}
	prepared, err := h.Storage.PrepareUpload(c.GetString("userID"), input.Filename, input.ContentType)
	if err != nil {
		if err.Error() == "storage is not configured" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "photo storage is not configured"})
			return
		}
		if err.Error() == "unsupported image type" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "use a JPEG, PNG, WebP, or GIF image"})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not prepare photo upload"})
		return
	}
	claims := uploadClaims{
		ObjectKey: prepared.ObjectKey, ContentType: input.ContentType, MaxSize: input.Size,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: storageUploadIssuer, Subject: c.GetString("userID"),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(10 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare photo upload"})
		return
	}
	base := strings.TrimRight(h.UploadAPIURL, "/")
	c.JSON(http.StatusOK, storage.Upload{
		UploadURL: base + "/storage/entry-photos/upload/" + signed,
		PhotoURL:  prepared.PhotoURL,
	})
}

func (h Storage) Upload(c *gin.Context) {
	claims := &uploadClaims{}
	token, err := jwt.ParseWithClaims(c.Param("token"), claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.JWTSecret), nil
	}, jwt.WithIssuer(storageUploadIssuer))
	if err != nil || !token.Valid || claims.Subject != c.GetString("userID") || claims.ObjectKey == "" || claims.MaxSize <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired upload URL"})
		return
	}
	contentType := cleanContentType(c.GetHeader("Content-Type"))
	claimContentType := cleanContentType(claims.ContentType)
	if contentType != claimContentType {
		log.Printf("upload contentType mismatch: got %q, expected %q (raw header: %q, raw claim: %q)", contentType, claimContentType, c.GetHeader("Content-Type"), claims.ContentType)
		c.JSON(http.StatusBadRequest, gin.H{"error": "file type does not match upload URL"})
		return
	}
	if c.Request.ContentLength > claims.MaxSize {
		log.Printf("upload size exceeded: ContentLength=%d > MaxSize=%d", c.Request.ContentLength, claims.MaxSize)
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size is invalid"})
		return
	}
	body := http.MaxBytesReader(c.Writer, c.Request.Body, claims.MaxSize)
	if err := h.Storage.Put(c.Request.Context(), claims.ObjectKey, claims.ContentType, body); err != nil {
		log.Printf("s3 put failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not upload file"})
		return
	}
	c.Status(http.StatusNoContent)
}

const maxAudioBytes = 15 * 1024 * 1024

func (h Storage) SignAudioUpload(c *gin.Context) {
	var input uploadInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	input.Filename = strings.TrimSpace(input.Filename)
	input.ContentType = cleanContentType(input.ContentType)
	if input.Filename == "" || len(input.Filename) > 255 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "filename is required"})
		return
	}
	if input.Size <= 0 || input.Size > maxAudioBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audio file must be 15 MB or smaller"})
		return
	}
	prepared, err := h.Storage.PrepareAudioUpload(c.GetString("userID"), input.Filename, input.ContentType)
	if err != nil {
		if err.Error() == "storage is not configured" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "audio storage is not configured"})
			return
		}
		if err.Error() == "unsupported audio type" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported audio format"})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not prepare audio upload"})
		return
	}
	claims := uploadClaims{
		ObjectKey: prepared.ObjectKey, ContentType: input.ContentType, MaxSize: input.Size,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: storageUploadIssuer, Subject: c.GetString("userID"),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(10 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare audio upload"})
		return
	}
	base := strings.TrimRight(h.UploadAPIURL, "/")
	c.JSON(http.StatusOK, storage.AudioUpload{
		UploadURL: base + "/storage/entry-photos/upload/" + signed, // Reuse upload proxy endpoint!
		AudioURL:  prepared.PhotoURL,
	})
}

