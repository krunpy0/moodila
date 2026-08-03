package handlers

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"io"
	"log"
	"math"
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
	maxImageSide        = 1920
	jpegCompressionQual = 80
	maxDimensionCap     = 20000
	maxPixelAreaCap     = 50000000
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

func shouldCompress(contentType string) bool {
	ct := cleanContentType(contentType)
	return ct == "image/jpeg" || ct == "image/png"
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
	if c.Request.ContentLength > claims.MaxSize || c.Request.ContentLength > maxPhotoBytes {
		log.Printf("upload size exceeded: ContentLength=%d > MaxSize=%d", c.Request.ContentLength, claims.MaxSize)
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size is invalid"})
		return
	}

	readLimit := claims.MaxSize + 1
	if readLimit > maxPhotoBytes+1 {
		readLimit = maxPhotoBytes + 1
	}
	rawBytes, err := io.ReadAll(io.LimitReader(c.Request.Body, readLimit))
	if err != nil {
		log.Printf("upload body read failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read upload body"})
		return
	}
	if int64(len(rawBytes)) > claims.MaxSize || int64(len(rawBytes)) > maxPhotoBytes {
		log.Printf("upload size exceeded post-read: len=%d (claimMax=%d, maxPhotoBytes=%d)", len(rawBytes), claims.MaxSize, maxPhotoBytes)
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size is invalid"})
		return
	}
	if len(rawBytes) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "upload file is empty"})
		return
	}

	var uploadReader io.Reader
	if shouldCompress(claimContentType) {
		compressedBytes, err := processAndCompressPhoto(rawBytes, claimContentType)
		if err != nil {
			log.Printf("photo compression failed: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		uploadReader = bytes.NewReader(compressedBytes)
	} else {
		log.Printf("photo upload [%s]: short-circuiting compression (%d bytes)", claimContentType, len(rawBytes))
		uploadReader = bytes.NewReader(rawBytes)
	}

	if err := h.Storage.Put(c.Request.Context(), claims.ObjectKey, claims.ContentType, uploadReader); err != nil {
		log.Printf("s3 put failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not upload file"})
		return
	}
	c.Status(http.StatusNoContent)
}

func processAndCompressPhoto(raw []byte, contentType string) ([]byte, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("decode image header: %w", err)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return nil, fmt.Errorf("invalid image dimensions: %dx%d", cfg.Width, cfg.Height)
	}
	if cfg.Width > maxDimensionCap || cfg.Height > maxDimensionCap || int64(cfg.Width)*int64(cfg.Height) > maxPixelAreaCap {
		return nil, fmt.Errorf("image dimensions exceed safety limits (%dx%d)", cfg.Width, cfg.Height)
	}

	orientation := 1
	if contentType == "image/jpeg" || format == "jpeg" {
		orientation = extractEXIFOrientation(raw)
	}

	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("decode image pixels: %w", err)
	}

	if orientation > 1 && orientation <= 8 {
		img = fixEXIFOrientation(img, orientation)
	}

	origW, origH := img.Bounds().Dx(), img.Bounds().Dy()
	var resizedImg image.Image = img
	if origW > maxImageSide || origH > maxImageSide {
		resizedImg = resizeImage(img, maxImageSide)
	}

	newW, newH := resizedImg.Bounds().Dx(), resizedImg.Bounds().Dy()

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resizedImg, &jpeg.Options{Quality: jpegCompressionQual}); err != nil {
		return nil, fmt.Errorf("re-encode jpeg: %w", err)
	}

	compressed := buf.Bytes()
	origSize := len(raw)
	compressedSize := len(compressed)
	savings := origSize - compressedSize
	savingsPct := float64(savings) / float64(origSize) * 100

	log.Printf("photo compression [%s]: before=%d bytes (%dx%d), after=%d bytes (%dx%d), saved %d bytes (%.1f%%)",
		contentType, origSize, origW, origH, compressedSize, newW, newH, savings, savingsPct)

	return compressed, nil
}

func resizeImage(src image.Image, maxSide int) image.Image {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= maxSide && h <= maxSide {
		return src
	}
	var nw, nh int
	if w > h {
		nw = maxSide
		nh = int(int64(h) * int64(maxSide) / int64(w))
	} else {
		nh = maxSide
		nw = int(int64(w) * int64(maxSide) / int64(h))
	}
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	xRatio := float64(w) / float64(nw)
	yRatio := float64(h) / float64(nh)

	for y := 0; y < nh; y++ {
		sy := (float64(y) + 0.5) * yRatio - 0.5
		y0 := int(math.Floor(sy))
		y1 := y0 + 1
		fy := sy - float64(y0)
		if y0 < 0 {
			y0, y1, fy = 0, 0, 0
		}
		if y1 >= h {
			y1 = h - 1
		}

		for x := 0; x < nw; x++ {
			sx := (float64(x) + 0.5) * xRatio - 0.5
			x0 := int(math.Floor(sx))
			x1 := x0 + 1
			fx := sx - float64(x0)
			if x0 < 0 {
				x0, x1, fx = 0, 0, 0
			}
			if x1 >= w {
				x1 = w - 1
			}

			r00, g00, b00, a00 := src.At(bounds.Min.X+x0, bounds.Min.Y+y0).RGBA()
			r10, g10, b10, a10 := src.At(bounds.Min.X+x1, bounds.Min.Y+y0).RGBA()
			r01, g01, b01, a01 := src.At(bounds.Min.X+x0, bounds.Min.Y+y1).RGBA()
			r11, g11, b11, a11 := src.At(bounds.Min.X+x1, bounds.Min.Y+y1).RGBA()

			w00 := (1 - fx) * (1 - fy)
			w10 := fx * (1 - fy)
			w01 := (1 - fx) * fy
			w11 := fx * fy

			r := uint16(float64(r00)*w00 + float64(r10)*w10 + float64(r01)*w01 + float64(r11)*w11)
			g := uint16(float64(g00)*w00 + float64(g10)*w10 + float64(g01)*w01 + float64(g11)*w11)
			b := uint16(float64(b00)*w00 + float64(b10)*w10 + float64(b01)*w01 + float64(b11)*w11)
			a := uint16(float64(a00)*w00 + float64(a10)*w10 + float64(a01)*w01 + float64(a11)*w11)

			dst.SetRGBA64(x, y, color.RGBA64{R: r, G: g, B: b, A: a})
		}
	}
	return dst
}

func fixEXIFOrientation(img image.Image, orientation int) image.Image {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	switch orientation {
	case 2: // Flip horizontal
		dst := image.NewRGBA(image.Rect(0, 0, w, h))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				dst.Set(x, y, img.At(bounds.Min.X+(w-1-x), bounds.Min.Y+y))
			}
		}
		return dst
	case 3: // Rotate 180
		dst := image.NewRGBA(image.Rect(0, 0, w, h))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				dst.Set(x, y, img.At(bounds.Min.X+(w-1-x), bounds.Min.Y+(h-1-y)))
			}
		}
		return dst
	case 4: // Flip vertical
		dst := image.NewRGBA(image.Rect(0, 0, w, h))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				dst.Set(x, y, img.At(bounds.Min.X+x, bounds.Min.Y+(h-1-y)))
			}
		}
		return dst
	case 5: // Transpose
		dst := image.NewRGBA(image.Rect(0, 0, h, w))
		for y := 0; y < w; y++ {
			for x := 0; x < h; x++ {
				dst.Set(x, y, img.At(bounds.Min.X+y, bounds.Min.Y+x))
			}
		}
		return dst
	case 6: // Rotate 90 CW
		dst := image.NewRGBA(image.Rect(0, 0, h, w))
		for y := 0; y < w; y++ {
			for x := 0; x < h; x++ {
				dst.Set(x, y, img.At(bounds.Min.X+y, bounds.Min.Y+(h-1-x)))
			}
		}
		return dst
	case 7: // Transverse
		dst := image.NewRGBA(image.Rect(0, 0, h, w))
		for y := 0; y < w; y++ {
			for x := 0; x < h; x++ {
				dst.Set(x, y, img.At(bounds.Min.X+(w-1-y), bounds.Min.Y+(h-1-x)))
			}
		}
		return dst
	case 8: // Rotate 270 CW (90 CCW)
		dst := image.NewRGBA(image.Rect(0, 0, h, w))
		for y := 0; y < w; y++ {
			for x := 0; x < h; x++ {
				dst.Set(x, y, img.At(bounds.Min.X+(w-1-y), bounds.Min.Y+x))
			}
		}
		return dst
	default:
		return img
	}
}

func extractEXIFOrientation(data []byte) int {
	if len(data) < 14 || data[0] != 0xFF || data[1] != 0xD8 {
		return 1
	}
	idx := 2
	for idx+4 < len(data) {
		if data[idx] != 0xFF {
			return 1
		}
		marker := data[idx+1]
		length := int(data[idx+2])<<8 | int(data[idx+3])
		if length < 2 || idx+2+length > len(data) {
			return 1
		}
		if marker == 0xE1 { // APP1 EXIF
			payload := data[idx+4 : idx+2+length]
			if len(payload) >= 6 && string(payload[:6]) == "Exif\x00\x00" {
				return parseExifOrientation(payload[6:])
			}
		}
		if marker == 0xDA || marker == 0xD9 {
			break
		}
		idx += 2 + length
	}
	return 1
}

func parseExifOrientation(tiff []byte) int {
	if len(tiff) < 8 {
		return 1
	}
	isBigEndian := false
	if tiff[0] == 'M' && tiff[1] == 'M' {
		isBigEndian = true
	} else if tiff[0] == 'I' && tiff[1] == 'I' {
		isBigEndian = false
	} else {
		return 1
	}
	readUint16 := func(offset int) uint16 {
		if offset < 0 || offset+2 > len(tiff) {
			return 0
		}
		if isBigEndian {
			return uint16(tiff[offset])<<8 | uint16(tiff[offset+1])
		}
		return uint16(tiff[offset+1])<<8 | uint16(tiff[offset])
	}
	readUint32 := func(offset int) uint32 {
		if offset < 0 || offset+4 > len(tiff) {
			return 0
		}
		if isBigEndian {
			return uint32(tiff[offset])<<24 | uint32(tiff[offset+1])<<16 | uint32(tiff[offset+2])<<8 | uint32(tiff[offset+3])
		}
		return uint32(tiff[offset+3])<<24 | uint32(tiff[offset+2])<<16 | uint32(tiff[offset+1])<<8 | uint32(tiff[offset])
	}

	if readUint16(2) != 0x002A {
		return 1
	}
	ifdOffset := int(readUint32(4))
	if ifdOffset < 8 || ifdOffset+2 > len(tiff) {
		return 1
	}
	numEntries := int(readUint16(ifdOffset))
	for i := 0; i < numEntries; i++ {
		entryOffset := ifdOffset + 2 + i*12
		if entryOffset+12 > len(tiff) {
			break
		}
		tag := readUint16(entryOffset)
		if tag == 0x0112 {
			val := readUint16(entryOffset + 8)
			if val >= 1 && val <= 8 {
				return int(val)
			}
			return 1
		}
	}
	return 1
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

type deleteObjectInput struct {
	PhotoURL  string `json:"photo_url"`
	URL       string `json:"url"`
	ObjectKey string `json:"object_key"`
}

func (h Storage) DeleteObject(c *gin.Context) {
	var input deleteObjectInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	target := strings.TrimSpace(input.PhotoURL)
	if target == "" {
		target = strings.TrimSpace(input.URL)
	}
	if target == "" {
		target = strings.TrimSpace(input.ObjectKey)
	}
	if target == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo_url, url or object_key is required"})
		return
	}

	userID := c.GetString("userID")
	objectKey, err := h.Storage.ExtractObjectKey(target, userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "unauthorized object deletion"})
		return
	}

	if err := h.Storage.Delete(c.Request.Context(), objectKey); err != nil {
		if err.Error() == "storage is not configured" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "photo storage is not configured"})
			return
		}
		log.Printf("s3 delete failed for key %q: %v", objectKey, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not delete object"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "object deleted"})
}


