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

func TestPrepareUploadPrivateS3(t *testing.T) {
	s := S3{
		IsPrivate:       true,
		Endpoint:        "https://s3.eu-central-003.backblazeb2.com",
		Bucket:          "moodila-uploads",
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
		Now:             func() time.Time { return time.Date(2026, 8, 7, 10, 0, 0, 0, time.UTC) },
	}

	prep, err := s.PrepareUpload("user-1", "photo.png", "image/png")
	if err != nil {
		t.Fatalf("PrepareUpload() error = %v", err)
	}

	if !strings.Contains(prep.PhotoURL, "X-Amz-Signature=") {
		t.Errorf("expected PhotoURL in private S3 mode to contain GET presigned signature, got %q", prep.PhotoURL)
	}
}

func TestCreateUploadRejectsUnsupportedType(t *testing.T) {
	s := S3{Bucket: "photos", AccessKeyID: "key", SecretAccessKey: "secret"}
	_, err := s.CreateUpload(t.Context(), "user-1", "file.pdf", "application/pdf")
	if err == nil || err.Error() != "unsupported image type" {
		t.Fatalf("CreateUpload() error = %v, want unsupported image type", err)
	}
}

func TestStrictExtractKey(t *testing.T) {
	s := S3{}

	t.Run("Valid Relative Key", func(t *testing.T) {
		key, err := s.ExtractKey("user-123/2026/08/abc.jpg")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if key != "user-123/2026/08/abc.jpg" {
			t.Errorf("got key %q, want %q", key, "user-123/2026/08/abc.jpg")
		}
	})

	t.Run("Rejects Full HTTPS URL", func(t *testing.T) {
		_, err := s.ExtractKey("https://moodila-uploads.s3.eu-central-003.backblazeb2.com/user-123/2026/08/abc.jpg")
		if err == nil {
			t.Fatal("expected error for full HTTP URL, got nil")
		}
	})

	t.Run("Rejects Legacy Storage Prefix", func(t *testing.T) {
		_, err := s.ExtractKey("storage/v1/object/public/entry-photos/user-123/2026/08/abc.jpg")
		if err == nil {
			t.Fatal("expected error for legacy path prefix, got nil")
		}
	})
}

func TestCleanURL(t *testing.T) {
	s := S3{
		PublicBaseURL: "https://moodila-uploads.s3.eu-central-003.backblazeb2.com",
		Bucket:        "moodila-uploads",
	}

	t.Run("Relative Key Preserved", func(t *testing.T) {
		in := "user-123/2026/08/abc.jpg"
		res := s.CleanURL(&in)
		if res == nil || *res != "user-123/2026/08/abc.jpg" {
			t.Errorf("got %v, want %q", res, "user-123/2026/08/abc.jpg")
		}
	})

	t.Run("Current Public Base URL Cleaned To Relative Key", func(t *testing.T) {
		in := "https://moodila-uploads.s3.eu-central-003.backblazeb2.com/user-123/2026/08/abc.jpg?X-Amz-Signature=123"
		res := s.CleanURL(&in)
		if res == nil || *res != "user-123/2026/08/abc.jpg" {
			t.Errorf("got %v, want %q", res, "user-123/2026/08/abc.jpg")
		}
	})

	t.Run("Rejects Legacy Supabase URL", func(t *testing.T) {
		in := "https://amnpytvtzvcgyqmsmrvp.supabase.co/storage/v1/object/public/entry-photos/user-123/2026/08/abc.jpg"
		res := s.CleanURL(&in)
		if res != nil {
			t.Errorf("expected nil for legacy Supabase URL on write, got %q", *res)
		}
	})
}

func TestResolveAccessURL(t *testing.T) {
	sPublic := S3{
		IsPrivate:     false,
		PublicBaseURL: "https://moodila-uploads.s3.eu-central-003.backblazeb2.com",
	}

	sPrivate := S3{
		IsPrivate:       true,
		Endpoint:        "https://s3.eu-central-003.backblazeb2.com",
		Bucket:          "moodila-uploads",
		AccessKeyID:     "access-key",
		SecretAccessKey: "secret-key",
	}

	key := "user-1/2026/08/photo.jpg"

	t.Run("Public Mode Builds Full URL From Relative Key", func(t *testing.T) {
		res := sPublic.ResolveAccessURL(&key)
		want := "https://moodila-uploads.s3.eu-central-003.backblazeb2.com/user-1/2026/08/photo.jpg"
		if res == nil || *res != want {
			t.Errorf("got %v, want %q", res, want)
		}
	})

	t.Run("Private Mode Generates Presigned GET From Relative Key", func(t *testing.T) {
		res := sPrivate.ResolveAccessURL(&key)
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
		if res := sPublic.ResolveAccessURL(nil); res != nil {
			t.Errorf("expected nil for nil input, got %v", res)
		}
		emptyStr := ""
		if res := sPublic.ResolveAccessURL(&emptyStr); res != nil {
			t.Errorf("expected nil for empty input, got %v", res)
		}
	})
}
