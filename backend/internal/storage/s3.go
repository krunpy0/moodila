// Package storage creates short-lived S3-compatible upload URLs. File bytes
// go directly from the browser to the bucket; the API never handles them.
package storage

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

const uploadURLLifetime = 10 * time.Minute

// S3 contains the connection settings common to AWS S3 and S3-compatible
// providers such as Cloudflare R2, MinIO, and Backblaze B2.
type S3 struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	SessionToken    string
	PublicBaseURL   string
	ForcePathStyle  bool
	Now             func() time.Time
}

type Upload struct {
	UploadURL string `json:"upload_url"`
	PhotoURL  string `json:"photo_url"`
}

type AudioUpload struct {
	UploadURL string `json:"upload_url"`
	AudioURL  string `json:"audio_url"`
}

type PreparedUpload struct {
	ObjectKey string
	PhotoURL  string
}

func (s S3) PrepareUpload(userID, filename, contentType string) (PreparedUpload, error) {
	if s.Bucket == "" || s.AccessKeyID == "" || s.SecretAccessKey == "" {
		return PreparedUpload{}, fmt.Errorf("storage is not configured")
	}
	ext, ok := allowedImageType(contentType, filename)
	if !ok {
		return PreparedUpload{}, fmt.Errorf("unsupported image type")
	}
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return PreparedUpload{}, fmt.Errorf("generate object name: %w", err)
	}
	now := time.Now().UTC()
	if s.Now != nil {
		now = s.Now().UTC()
	}
	objectKey := path.Join(userID, now.Format("2006/01"), hex.EncodeToString(random)+ext)
	return PreparedUpload{ObjectKey: objectKey, PhotoURL: s.publicURL(objectKey)}, nil
}

func (s S3) PrepareAudioUpload(userID, filename, contentType string) (PreparedUpload, error) {
	if s.Bucket == "" || s.AccessKeyID == "" || s.SecretAccessKey == "" {
		return PreparedUpload{}, fmt.Errorf("storage is not configured")
	}
	ext, ok := allowedAudioType(contentType, filename)
	if !ok {
		return PreparedUpload{}, fmt.Errorf("unsupported audio type")
	}
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return PreparedUpload{}, fmt.Errorf("generate object name: %w", err)
	}
	now := time.Now().UTC()
	if s.Now != nil {
		now = s.Now().UTC()
	}
	objectKey := path.Join(userID, "audio", now.Format("2006/01"), hex.EncodeToString(random)+ext)
	return PreparedUpload{ObjectKey: objectKey, PhotoURL: s.publicURL(objectKey)}, nil
}

func (s S3) CreateUpload(_ context.Context, userID, filename, contentType string) (Upload, error) {
	prepared, err := s.PrepareUpload(userID, filename, contentType)
	if err != nil {
		return Upload{}, err
	}
	uploadURL, err := s.presignPut(prepared.ObjectKey, contentType, time.Now().UTC())
	if err != nil {
		return Upload{}, err
	}
	return Upload{UploadURL: uploadURL, PhotoURL: prepared.PhotoURL}, nil
}

// Put streams a file to S3 from the API. This avoids requiring CORS support
// from the storage provider while retaining S3 for the actual upload.
func (s S3) Put(ctx context.Context, objectKey, contentType string, body io.Reader) error {
	uploadURL, err := s.presignPut(objectKey, contentType, time.Now().UTC())
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, body)
	log.Printf("presigned PUT url: %s", uploadURL)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("upload to S3: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("S3 returned %s: %s", resp.Status, strings.TrimSpace(string(message)))
	}
	return nil
}

func (s S3) presignPut(objectKey, contentType string, now time.Time) (string, error) {
	endpoint, err := s.endpointURL()
	if err != nil {
		return "", err
	}
	region := s.Region
	if region == "" {
		region = "us-east-1"
	}
	pathStyle := s.ForcePathStyle || s.Endpoint != ""
	basePath := strings.TrimRight(endpoint.Path, "/")
	canonicalURI := basePath + "/" + escapeObjectKey(objectKey)
	if pathStyle {
			canonicalURI = basePath + "/" + url.PathEscape(s.Bucket) + "/" + escapeObjectKey(objectKey)
	} else {
			endpoint.Host = s.Bucket + "." + endpoint.Host
	}
	endpoint.Path = canonicalURI
	endpoint.RawPath = canonicalURI

	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	credentialScope := dateStamp + "/" + region + "/s3/aws4_request"
	query := url.Values{
		"X-Amz-Algorithm":     {"AWS4-HMAC-SHA256"},
		"X-Amz-Credential":    {s.AccessKeyID + "/" + credentialScope},
		"X-Amz-Date":          {amzDate},
		"X-Amz-Expires":       {fmt.Sprintf("%d", int(uploadURLLifetime.Seconds()))},
		"X-Amz-SignedHeaders": {"content-type;host"},
	}
	if s.SessionToken != "" {
		query.Set("X-Amz-Security-Token", s.SessionToken)
	}
	canonicalHeaders := "content-type:" + strings.TrimSpace(contentType) + "\n" + "host:" + endpoint.Host + "\n"
	canonicalRequest := strings.Join([]string{
		"PUT", canonicalURI, query.Encode(), canonicalHeaders, "content-type;host", "UNSIGNED-PAYLOAD",
	}, "\n")
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest),
	}, "\n")
	signature := hex.EncodeToString(hmacSHA256(signingKey(s.SecretAccessKey, dateStamp, region, "s3"), stringToSign))
	query.Set("X-Amz-Signature", signature)
	endpoint.RawQuery = query.Encode()
	return endpoint.String(), nil
}

func (s S3) endpointURL() (*url.URL, error) {
	endpoint := s.Endpoint
	if endpoint == "" {
		region := s.Region
		if region == "" || region == "us-east-1" {
			endpoint = "https://s3.amazonaws.com"
		} else {
			endpoint = "https://s3." + region + ".amazonaws.com"
		}
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("invalid S3 endpoint")
	}
	return u, nil
}

func (s S3) publicURL(objectKey string) string {
	base := strings.TrimRight(s.PublicBaseURL, "/")
	if base != "" {
		return base + "/" + escapeObjectKey(objectKey)
	}
	endpoint, err := s.endpointURL()
	if err != nil {
		return ""
	}
	if s.Endpoint == "" {
		endpoint.Host = s.Bucket + "." + endpoint.Host
		return endpoint.Scheme + "://" + endpoint.Host + "/" + escapeObjectKey(objectKey)
	}
	return strings.TrimRight(endpoint.String(), "/") + "/" + url.PathEscape(s.Bucket) + "/" + escapeObjectKey(objectKey)
}

func escapeObjectKey(key string) string {
	parts := strings.Split(key, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func signingKey(secret, date, region, service string) []byte {
	dateKey := hmacSHA256([]byte("AWS4"+secret), date)
	regionKey := hmacSHA256(dateKey, region)
	serviceKey := hmacSHA256(regionKey, service)
	return hmacSHA256(serviceKey, "aws4_request")
}

func hmacSHA256(key []byte, value string) []byte {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write([]byte(value))
	return h.Sum(nil)
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func allowedImageType(contentType, filename string) (string, bool) {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	allowed := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
	ext, ok := allowed[contentType]
	if !ok {
		return "", false
	}
	if guessed := mime.TypeByExtension(strings.ToLower(path.Ext(filename))); guessed != "" && !strings.HasPrefix(guessed, "image/") {
		return "", false
	}
	return ext, true
}

func allowedAudioType(contentType, filename string) (string, bool) {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	allowed := map[string]string{
		"audio/webm":     ".webm",
		"audio/ogg":      ".ogg",
		"audio/mp4":      ".m4a",
		"audio/x-m4a":    ".m4a",
		"audio/m4a":      ".m4a",
		"audio/aac":      ".aac",
		"audio/mpeg":     ".mp3",
		"audio/mp3":      ".mp3",
		"audio/wav":      ".wav",
		"audio/x-wav":    ".wav",
	}
	ext, ok := allowed[contentType]
	if !ok {
		// Fallback: check extension
		extName := strings.ToLower(path.Ext(filename))
		if extName == ".webm" || extName == ".ogg" || extName == ".m4a" || extName == ".mp3" || extName == ".wav" || extName == ".mp4" {
			return extName, true
		}
		return "", false
	}
	return ext, true
}
