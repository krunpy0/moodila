package config_test

import (
	"os"
	"testing"

	"moodshare/internal/config"
)

func TestLoad_JWTSecret(t *testing.T) {
	origSecret, exists := os.LookupEnv("JWT_SECRET")
	defer func() {
		if exists {
			_ = os.Setenv("JWT_SECRET", origSecret)
		} else {
			_ = os.Unsetenv("JWT_SECRET")
		}
	}()

	testSecret := "super-secure-key-that-is-at-least-32-bytes-long"
	_ = os.Setenv("JWT_SECRET", testSecret)

	cfg := config.Load()
	if cfg.JWTSecret != testSecret {
		t.Fatalf("expected JWTSecret %q, got %q", testSecret, cfg.JWTSecret)
	}
}
