package storage

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestCreateUploadForCustomS3Endpoint(t *testing.T) {
	s := S3{
		Endpoint:        "https://s3.example.test",
		Region:          "us-east-1",
		Bucket:          "photos",
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		PublicBaseURL:   "https://cdn.example.test/entries",
		Now:             func() time.Time { return time.Date(2026, 7, 23, 12, 0, 0, 0, time.UTC) },
	}

	u, err := s.CreateUpload(t.Context(), "user-1", "day photo.png", "image/png")
	if err != nil {
		t.Fatalf("CreateUpload() error = %v", err)
	}
	parsed, err := url.Parse(u.UploadURL)
	if err != nil {
		t.Fatalf("parse upload URL: %v", err)
	}
	if parsed.Host != "s3.example.test" || !strings.HasPrefix(parsed.EscapedPath(), "/photos/user-1/2026/07/") {
		t.Fatalf("unexpected S3 upload URL: %s", u.UploadURL)
	}
	if got := parsed.Query().Get("X-Amz-SignedHeaders"); got != "content-type;host" {
		t.Errorf("signed headers = %q, want content-type;host", got)
	}
	if parsed.Query().Get("X-Amz-Signature") == "" {
		t.Error("upload URL has no signature")
	}
	if !strings.HasPrefix(u.PhotoURL, "https://cdn.example.test/entries/user-1/2026/07/") || !strings.HasSuffix(u.PhotoURL, ".png") {
		t.Errorf("unexpected public photo URL: %s", u.PhotoURL)
	}
}

func TestCreateUploadRejectsUnsupportedType(t *testing.T) {
	s := S3{Bucket: "photos", AccessKeyID: "key", SecretAccessKey: "secret"}
	_, err := s.CreateUpload(t.Context(), "user-1", "file.pdf", "application/pdf")
	if err == nil || err.Error() != "unsupported image type" {
		t.Fatalf("CreateUpload() error = %v, want unsupported image type", err)
	}
}
