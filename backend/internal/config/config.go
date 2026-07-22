// Package config reads runtime configuration from the environment, with an
// optional .env file loaded first for local development.
package config

import (
	"bufio"
	"os"
	"strings"
)

// Config holds all runtime settings for the API.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	CORSOrigin  string
	AppEnv      string
}

// Load reads configuration, loading backend/.env first (if present) so local
// values are available without exporting them by hand.
func Load() Config {
	loadDotEnv(".env")

	return Config{
		Port:        getenv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   getenv("JWT_SECRET", "dev-secret-change-me"),
		CORSOrigin:  getenv("CORS_ORIGIN", "http://localhost:5173"),
		AppEnv:      getenv("APP_ENV", "development"),
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// loadDotEnv loads KEY=VALUE lines from path into the process environment,
// without overriding variables that are already set. A missing file is fine.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.Trim(strings.TrimSpace(val), `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, val)
		}
	}
}
