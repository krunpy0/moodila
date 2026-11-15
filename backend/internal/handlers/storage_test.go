package handlers

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"hash/crc32"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"moodshare/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestPhotoMemoryLimitBeforeDecode(t *testing.T) {
	var raw bytes.Buffer
	img := image.NewNRGBA64(image.Rect(0, 0, 1, 1))
	img.SetNRGBA64(0, 0, color.NRGBA64{R: 12345, A: 32768})
	if err := png.Encode(&raw, img); err != nil {
		t.Fatal(err)
	}
	data := raw.Bytes()
	binary.BigEndian.PutUint32(data[16:20], 8000)
	binary.BigEndian.PutUint32(data[20:24], 6000)
	binary.BigEndian.PutUint32(data[29:33], crc32.ChecksumIEEE(data[12:29]))
	if _, err := processAndCompressPhoto(data, "image/png"); !errors.Is(err, errPhotoMemoryLimit) {
		t.Fatalf("expected memory rejection before pixel decoding, got %v", err)
	}
}

type genericImage struct{ image.Image }

func TestResizeImagePixelAccess(t *testing.T) {
	bounds := image.Rect(7, 9, 24, 20)
	for _, src := range []draw.Image{
		image.NewRGBA(bounds), image.NewNRGBA(bounds), image.NewRGBA64(bounds),
		image.NewNRGBA64(bounds), image.NewGray(bounds), image.NewGray16(bounds), image.NewCMYK(bounds),
	} {
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				src.Set(x, y, color.NRGBA64{R: uint16(x * 2000), G: uint16(y * 2000), B: 12345, A: 32768})
			}
		}
		got := resizeImage(src, 8).(*image.RGBA)
		want := resizeImage(genericImage{src}, 8).(*image.RGBA)
		if !bytes.Equal(got.Pix, want.Pix) {
			t.Fatalf("pixel conversion changed for %T", src)
		}
	}
	src := image.NewYCbCr(bounds, image.YCbCrSubsampleRatio420)
	for i := range src.Y {
		src.Y[i] = uint8(i)
	}
	for i := range src.Cb {
		src.Cb[i], src.Cr[i] = 90, 160
	}
	if !bytes.Equal(resizeImage(src, 8).(*image.RGBA).Pix, resizeImage(genericImage{src}, 8).(*image.RGBA).Pix) {
		t.Fatal("YCbCr conversion changed")
	}
	if allocs := testing.AllocsPerRun(3, func() { resizeImage(src, 8) }); allocs > 4 {
		t.Fatalf("resize allocates per pixel: %f allocations", allocs)
	}
}

func BenchmarkResizeCameraPhoto(b *testing.B) {
	src := image.NewYCbCr(image.Rect(0, 0, 4000, 3000), image.YCbCrSubsampleRatio420)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resizeImage(src, 1920)
	}
}

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
		tiff.Write([]byte{0x00, 0x2A})                                // magic
		tiff.Write([]byte{0x00, 0x00, 0x00, 0x08})                    // IFD0 offset
		tiff.Write([]byte{0x00, 0x01})                                // 1 entry
		tiff.Write([]byte{0x01, 0x12})                                // Tag 0x0112 (Orientation)
		tiff.Write([]byte{0x00, 0x03})                                // Type SHORT
		tiff.Write([]byte{0x00, 0x00, 0x00, 0x01})                    // Count 1
		tiff.Write([]byte{byte(orientation >> 8), byte(orientation)}) // Value
		tiff.Write([]byte{0x00, 0x00})                                // Padding
	} else {
		tiff.WriteString("II")
		tiff.Write([]byte{0x2A, 0x00})                                // magic
		tiff.Write([]byte{0x08, 0x00, 0x00, 0x00})                    // IFD0 offset
		tiff.Write([]byte{0x01, 0x00})                                // 1 entry
		tiff.Write([]byte{0x12, 0x01})                                // Tag 0x0112
		tiff.Write([]byte{0x03, 0x00})                                // Type SHORT
		tiff.Write([]byte{0x01, 0x00, 0x00, 0x00})                    // Count 1
		tiff.Write([]byte{byte(orientation), byte(orientation >> 8)}) // Value
		tiff.Write([]byte{0x00, 0x00})                                // Padding
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

	t.Run("Cancelled queued uploads do not read bodies", func(t *testing.T) {
		for i := 0; i < cap(uploadProcessingSem); i++ {
			uploadProcessingSem <- struct{}{}
		}
		defer func() {
			for i := 0; i < cap(uploadProcessingSem); i++ {
				<-uploadProcessingSem
			}
		}()
		for _, contentType := range []string{"image/jpeg", "image/gif", "audio/webm"} {
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			body := &uploadReadProbe{}
			req := httptest.NewRequest("PUT", "/storage/entry-photos/upload/"+makeToken(contentType, 1024), body).WithContext(ctx)
			req.Header.Set("Content-Type", contentType)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != http.StatusRequestTimeout || body.read {
				t.Fatalf("%s: status=%d body read=%v", contentType, w.Code, body.read)
			}
		}
	})

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

	t.Run("Valid PNG Re-encoded to JPEG", func(t *testing.T) {
		token := makeToken("image/png", 5*1024*1024)
		rawPNG := createTestImage(400, 300)

		req := httptest.NewRequest("PUT", "/storage/entry-photos/upload/"+token, bytes.NewReader(rawPNG))
		req.Header.Set("Content-Type", "image/png")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)
		if w.Code != http.StatusBadGateway {
			t.Errorf("expected 502 Bad Gateway, got %d (body: %s)", w.Code, w.Body.String())
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
	t.Run("Decoded memory limit returns a localized error code", func(t *testing.T) {
		data := createTestImage(1, 1)
		binary.BigEndian.PutUint32(data[16:20], 8000)
		binary.BigEndian.PutUint32(data[20:24], 6000)
		binary.BigEndian.PutUint32(data[29:33], crc32.ChecksumIEEE(data[12:29]))
		token := makeToken("image/png", int64(len(data)))
		req := httptest.NewRequest("PUT", "/storage/entry-photos/upload/"+token, bytes.NewReader(data))
		req.Header.Set("Content-Type", "image/png")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		var body struct {
			Code string `json:"code"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || w.Code != http.StatusBadRequest || body.Code != "image_too_large" {
			t.Fatalf("expected memory limit response, got %d: %s (%v)", w.Code, w.Body.String(), err)
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

type uploadReadProbe struct{ read bool }

func (p *uploadReadProbe) Read([]byte) (int, error) {
	p.read = true
	return 0, io.EOF
}

func TestDeleteObjectHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Storage{
		Storage: storage.S3{
			Bucket:          "photos",
			AccessKeyID:     "key",
			SecretAccessKey: "secret",
		},
	}

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", "user-123")
		c.Next()
	})
	r.POST("/storage/delete", h.DeleteObject)

	t.Run("Cross user deletion rejected with 403", func(t *testing.T) {
		body := bytes.NewBufferString(`{"photo_url":"https://storage.test/other-user/2026/08/pic.jpg"}`)
		req := httptest.NewRequest("POST", "/storage/delete", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden, got %d", w.Code)
		}
	})

	t.Run("Missing target parameter rejected with 400", func(t *testing.T) {
		body := bytes.NewBufferString(`{}`)
		req := httptest.NewRequest("POST", "/storage/delete", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request, got %d", w.Code)
		}
	})

	t.Run("Unconfigured storage returns 503", func(t *testing.T) {
		unconfiguredH := Storage{Storage: storage.S3{}}
		rUnconf := gin.New()
		rUnconf.Use(func(c *gin.Context) {
			c.Set("userID", "user-123")
			c.Next()
		})
		rUnconf.POST("/storage/delete", unconfiguredH.DeleteObject)

		body := bytes.NewBufferString(`{"photo_url":"user-123/2026/08/pic.jpg"}`)
		req := httptest.NewRequest("POST", "/storage/delete", body)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		rUnconf.ServeHTTP(w, req)
		if w.Code != http.StatusServiceUnavailable {
			t.Errorf("expected 503 Service Unavailable, got %d", w.Code)
		}
	})
}

func TestStorage_SignUpload_PNGtoJPEG(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := Storage{
		JWTSecret: "test-secret",
		Storage: storage.S3{
			Bucket:          "bucket",
			AccessKeyID:     "key",
			SecretAccessKey: "sec",
		},
	}
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", "user-123")
		c.Next()
	})
	r.POST("/storage/entry-photos/upload-url", h.SignUpload)

	req := httptest.NewRequest("POST", "/storage/entry-photos/upload-url", bytes.NewBufferString(`{"filename":"test.png","content_type":"image/png","size":1000}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d (body: %s)", w.Code, w.Body.String())
	}
	var resp storage.Upload
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !strings.HasSuffix(resp.PhotoURL, ".jpg") {
		t.Errorf("expected photo URL to end with .jpg, got %s", resp.PhotoURL)
	}
}
