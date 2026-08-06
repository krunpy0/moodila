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

func TestExtractObjectKey(t *testing.T) {
	s := S3{
		PublicBaseURL: "https://xyz.supabase.co/storage/v1/object/public/entries",
	}
	userID := "user-123"

	t.Run("Valid Public Base URL", func(t *testing.T) {
		urlStr := "https://xyz.supabase.co/storage/v1/object/public/entries/user-123/2026/08/abc.jpg"
		key, err := s.ExtractObjectKey(urlStr, userID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if key != "user-123/2026/08/abc.jpg" {
			t.Errorf("got key %q, want %q", key, "user-123/2026/08/abc.jpg")
		}
	})

	t.Run("Valid Generic URL with User Path", func(t *testing.T) {
		sNoBase := S3{}
		urlStr := "https://s3.us-east-1.amazonaws.com/bucket/user-123/2026/08/file%20name.jpg"
		key, err := sNoBase.ExtractObjectKey(urlStr, userID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if key != "user-123/2026/08/file name.jpg" {
			t.Errorf("got key %q, want %q", key, "user-123/2026/08/file name.jpg")
		}
	})

	t.Run("Raw Key Input", func(t *testing.T) {
		key, err := s.ExtractObjectKey("user-123/2026/08/abc.jpg", userID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if key != "user-123/2026/08/abc.jpg" {
			t.Errorf("got key %q, want %q", key, "user-123/2026/08/abc.jpg")
		}
	})

	t.Run("Cross-User Rejection", func(t *testing.T) {
		urlStr := "https://xyz.supabase.co/storage/v1/object/public/entries/other-user/2026/08/abc.jpg"
		_, err := s.ExtractObjectKey(urlStr, userID)
		if err == nil {
			t.Fatal("expected error for cross-user object deletion, got nil")
		}
	})
}

func TestPresignDelete(t *testing.T) {
	s := S3{
		Endpoint:        "https://s3.example.test",
		Bucket:          "photos",
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
	}
	deleteURL, err := s.presignDelete("user-1/photo.jpg", time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("presignDelete() error = %v", err)
	}
	parsed, err := url.Parse(deleteURL)
	if err != nil {
		t.Fatalf("parse delete URL: %v", err)
	}
	if parsed.Query().Get("X-Amz-SignedHeaders") != "host" {
		t.Errorf("signed headers = %q, want host", parsed.Query().Get("X-Amz-SignedHeaders"))
	}
	if parsed.Query().Get("X-Amz-Signature") == "" {
		t.Error("delete URL has no signature")
	}
}

func TestPresignGet(t *testing.T) {
	s := S3{
		Endpoint:        "https://s3.example.test",
		Bucket:          "photos",
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		Now:             func() time.Time { return time.Date(2026, 8, 6, 12, 0, 0, 0, time.UTC) },
	}

	getURL, err := s.PresignGet("user-1/2026/08/photo.jpg", 2*time.Hour)
	if err != nil {
		t.Fatalf("PresignGet() error = %v", err)
	}
	parsed, err := url.Parse(getURL)
	if err != nil {
		t.Fatalf("parse GET URL: %v", err)
	}
	if parsed.Query().Get("X-Amz-SignedHeaders") != "host" {
		t.Errorf("signed headers = %q, want host", parsed.Query().Get("X-Amz-SignedHeaders"))
	}
	if parsed.Query().Get("X-Amz-Expires") != "7200" {
		t.Errorf("expires = %q, want 7200", parsed.Query().Get("X-Amz-Expires"))
	}
	if parsed.Query().Get("X-Amz-Signature") == "" {
		t.Error("GET URL has no signature")
	}
}

func TestResolveAccessURL(t *testing.T) {
	sPublic := S3{
		IsPrivate:     false,
		PublicBaseURL: "https://cdn.example.test/photos",
	}

	sPrivate := S3{
		IsPrivate:       true,
		Endpoint:        "https://s3.example.test",
		Bucket:          "photos",
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		PublicBaseURL:   "https://cdn.example.test/photos",
	}

	rawURL := "https://cdn.example.test/photos/user-1/2026/08/photo.jpg"

	t.Run("Public Mode", func(t *testing.T) {
		res := sPublic.ResolveAccessURL(&rawURL)
		if res == nil || *res != rawURL {
			t.Errorf("got %v, want %q", res, rawURL)
		}
	})

	t.Run("Private Mode Generates Presigned GET", func(t *testing.T) {
		res := sPrivate.ResolveAccessURL(&rawURL)
		if res == nil {
			t.Fatal("got nil resolved URL")
		}
		if !strings.Contains(*res, "X-Amz-Signature=") {
			t.Errorf("expected presigned URL with signature, got %q", *res)
		}
		if !strings.Contains(*res, "user-1/2026/08/photo.jpg") {
			t.Errorf("expected URL to contain object key, got %q", *res)
		}
	})

	t.Run("Nil or Empty Input", func(t *testing.T) {
		if res := sPrivate.ResolveAccessURL(nil); res != nil {
			t.Errorf("expected nil for nil input, got %v", res)
		}
		emptyStr := ""
		if res := sPrivate.ResolveAccessURL(&emptyStr); res != nil {
			t.Errorf("expected nil for empty input, got %v", res)
		}
	})
}

