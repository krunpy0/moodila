package handlers

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"moodshare/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func createTestImage(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func createTestJPEGWithEXIF(w, h int, orientation uint16, bigEndian bool) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 200, A: 255})
		}
	}
	var rawJpeg bytes.Buffer
	_ = jpeg.Encode(&rawJpeg, img, &jpeg.Options{Quality: 90})
	jpegBytes := rawJpeg.Bytes()

	// Build EXIF APP1 payload
	var tiff bytes.Buffer
	if bigEndian {
		tiff.WriteString("MM")
		tiff.Write([]byte{0x00, 0x2A}) // magic
		tiff.Write([]byte{0x00, 0x00, 0x00, 0x08}) // IFD0 offset
		tiff.Write([]byte{0x00, 0x01}) // 1 entry
		tiff.Write([]byte{0x01, 0x12}) // Tag 0x0112 (Orientation)
		tiff.Write([]byte{0x00, 0x03}) // Type SHORT
		tiff.Write([]byte{0x00, 0x00, 0x00, 0x01}) // Count 1
		tiff.Write([]byte{byte(orientation >> 8), byte(orientation)}) // Value
		tiff.Write([]byte{0x00, 0x00}) // Padding
	} else {
		tiff.WriteString("II")
		tiff.Write([]byte{0x2A, 0x00}) // magic
		tiff.Write([]byte{0x08, 0x00, 0x00, 0x00}) // IFD0 offset
		tiff.Write([]byte{0x01, 0x00}) // 1 entry
		tiff.Write([]byte{0x12, 0x01}) // Tag 0x0112
		tiff.Write([]byte{0x03, 0x00}) // Type SHORT
		tiff.Write([]byte{0x01, 0x00, 0x00, 0x00}) // Count 1
		tiff.Write([]byte{byte(orientation), byte(orientation >> 8)}) // Value
		tiff.Write([]byte{0x00, 0x00}) // Padding
	}

	exifPayload := append([]byte("Exif\x00\x00"), tiff.Bytes()...)
	app1Len := len(exifPayload) + 2
	var result bytes.Buffer
	result.Write([]byte{0xFF, 0xD8}) // SOI
	result.Write([]byte{0xFF, 0xE1, byte(app1Len >> 8), byte(app1Len)})
	result.Write(exifPayload)
	result.Write(jpegBytes[2:]) // Append remaining JPEG payload after SOI

	return result.Bytes()
}

func TestProcessAndCompressPhoto_ResizeAndReencode(t *testing.T) {
	// Create a large 3000x2000 JPEG image (typical camera photo size)
	rawJPEG := createTestJPEGWithEXIF(3000, 2000, 1, false)
	compressed, err := processAndCompressPhoto(rawJPEG, "image/jpeg")
	if err != nil {
		t.Fatalf("processAndCompressPhoto failed: %v", err)
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(compressed))
	if err != nil {
		t.Fatalf("decode compressed image header failed: %v", err)
	}

	if format != "jpeg" {
		t.Errorf("expected format jpeg, got %s", format)
	}
	if cfg.Width != 1920 || cfg.Height != 1280 {
		t.Errorf("expected dimensions 1920x1280, got %dx%d", cfg.Width, cfg.Height)
	}
	if len(compressed) >= len(rawJPEG) {
		t.Errorf("expected compressed size (%d) to be smaller than original size (%d)", len(compressed), len(rawJPEG))
	}
}

func TestProcessAndCompressPhoto_NoUpscaleSmallImage(t *testing.T) {
	// Create a small 800x600 PNG image
	rawPNG := createTestImage(800, 600)
	compressed, err := processAndCompressPhoto(rawPNG, "image/png")
	if err != nil {
		t.Fatalf("processAndCompressPhoto failed: %v", err)
	}

	cfg, _, err := image.DecodeConfig(bytes.NewReader(compressed))
	if err != nil {
		t.Fatalf("decode config failed: %v", err)
	}

	if cfg.Width != 800 || cfg.Height != 600 {
		t.Errorf("expected dimensions 800x600, got %dx%d", cfg.Width, cfg.Height)
	}
}

func TestProcessAndCompressPhoto_EXIFOrientation(t *testing.T) {
	// Test orientation 6 (90 degrees CW rotation) for both Little-Endian and Big-Endian EXIF
	for _, bigEndian := range []bool{false, true} {
		t.Run(fmt.Sprintf("BigEndian=%v", bigEndian), func(t *testing.T) {
			rawJPEG := createTestJPEGWithEXIF(2400, 1600, 6, bigEndian)
			compressed, err := processAndCompressPhoto(rawJPEG, "image/jpeg")
			if err != nil {
				t.Fatalf("processAndCompressPhoto failed: %v", err)
			}
			cfg, _, err := image.DecodeConfig(bytes.NewReader(compressed))
			if err != nil {
				t.Fatalf("decode config failed: %v", err)
			}
			// 2400x1600 rotated 90 CW becomes 1600x2400, which capped at max 1920 becomes 1280x1920
			if cfg.Width != 1280 || cfg.Height != 1920 {
				t.Errorf("expected rotated & resized dimensions 1280x1920, got %dx%d", cfg.Width, cfg.Height)
			}
		})
	}
}

func TestUploadHandler_CompressionAndShortCircuit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := "test-secret"
	h := Storage{
		JWTSecret:    secret,
		UploadAPIURL: "http://api.local",
		Storage:      storage.S3{},
	}

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", "user-123")
		c.Next()
	})
	r.PUT("/storage/entry-photos/upload/:token", h.Upload)

	makeToken := func(contentType string, maxSize int64) string {
		claims := uploadClaims{
			ObjectKey:   "test/user/photo.jpg",
			ContentType: contentType,
			MaxSize:     maxSize,
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    storageUploadIssuer,
				Subject:   "user-123",
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			},
		}
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signed, _ := tok.SignedString([]byte(secret))
		return signed
	}

	t.Run("Valid JPEG Compress Success", func(t *testing.T) {
		token := makeToken("image/jpeg", 5*1024*1024)
		rawPNG := createTestImage(2000, 1500)

		req := httptest.NewRequest("PUT", "/storage/entry-photos/upload/"+token, bytes.NewReader(rawPNG))
		req.Header.Set("Content-Type", "image/jpeg")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)
		if w.Code != http.StatusBadGateway {
			t.Errorf("expected 502 Bad Gateway (S3 unconfigured), got %d (body: %s)", w.Code, w.Body.String())
		}
	})

	t.Run("Short circuit GIF", func(t *testing.T) {
		token := makeToken("image/gif", 5*1024*1024)
		gifData := []byte("GIF89a...")

		req := httptest.NewRequest("PUT", "/storage/entry-photos/upload/"+token, bytes.NewReader(gifData))
		req.Header.Set("Content-Type", "image/gif")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)
		if w.Code != http.StatusBadGateway {
			t.Errorf("expected 502 Bad Gateway, got %d (body: %s)", w.Code, w.Body.String())
		}
	})

	t.Run("Corrupted image rejection", func(t *testing.T) {
		token := makeToken("image/jpeg", 5*1024*1024)
		corruptData := []byte("not an image at all")

		req := httptest.NewRequest("PUT", "/storage/entry-photos/upload/"+token, bytes.NewReader(corruptData))
		req.Header.Set("Content-Type", "image/jpeg")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for corrupted image, got %d (body: %s)", w.Code, w.Body.String())
		}
	})

	t.Run("Exceeded size limit rejection", func(t *testing.T) {
		token := makeToken("image/jpeg", 100) // claim max size 100 bytes
		largeData := make([]byte, 500)

		req := httptest.NewRequest("PUT", "/storage/entry-photos/upload/"+token, bytes.NewReader(largeData))
		req.Header.Set("Content-Type", "image/jpeg")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for size limit, got %d (body: %s)", w.Code, w.Body.String())
		}
	})
}
