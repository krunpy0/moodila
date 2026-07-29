// Package config reads runtime configuration from the environment, with an
// optional .env file loaded first for local development.
package config

import (
	"bufio"
	"net/http"
	"os"
	"strings"
)

// Config holds all runtime settings for the API.
type Config struct {
	Port              string
	DatabaseURL       string
	JWTSecret         string
	CORSOrigin        string
	APIPublicURL      string
	AppEnv            string
	CookieSameSite    http.SameSite
	CookieDomain      string
	CookieSecure      bool
	S3Endpoint        string
	S3Region          string
	S3Bucket          string
	S3AccessKeyID     string
	S3SecretAccessKey string
	S3SessionToken    string
	S3PublicBaseURL   string
	S3ForcePathStyle  bool
}

// Load reads configuration, loading backend/.env first (if present) so local
// values are available without exporting them by hand.
func Load() Config {
	loadDotEnv(".env")

	return Config{
		Port:              getenv("PORT", "8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		JWTSecret:         getenv("JWT_SECRET", "dev-secret-change-me"),
		CORSOrigin:        getenv("CORS_ORIGIN", "http://localhost:5173"),
		APIPublicURL:      strings.TrimRight(getenv("API_PUBLIC_URL", "http://localhost:8080"), "/"),
		AppEnv:            getenv("APP_ENV", "development"),
		CookieSameSite:    parseSameSite(getenv("COOKIE_SAMESITE", "lax")),
		CookieDomain:      getenv("COOKIE_DOMAIN", ""),
		CookieSecure:      parseBool(getenv("COOKIE_SECURE", "true")),
		S3Endpoint:        strings.TrimRight(os.Getenv("S3_ENDPOINT"), "/"),
		S3Region:          getenv("S3_REGION", "us-east-1"),
		S3Bucket:          getenv("S3_BUCKET", "entry-photos"),
		S3AccessKeyID:     getenv("ACCESS_KEY_ID", os.Getenv("AWS_ACCESS_KEY_ID")),
		S3SecretAccessKey: getenv("SECRET_ACCESS_KEY", os.Getenv("AWS_SECRET_ACCESS_KEY")),
		S3SessionToken:    getenv("AWS_SESSION_TOKEN", ""),
		S3PublicBaseURL:   strings.TrimRight(os.Getenv("S3_PUBLIC_BASE_URL"), "/"),
		S3ForcePathStyle:  strings.EqualFold(os.Getenv("S3_FORCE_PATH_STYLE"), "true"),
	}
}

func parseSameSite(v string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "none":
		return http.SameSiteNoneMode
	case "strict":
		return http.SameSiteStrictMode
	case "lax":
		return http.SameSiteLaxMode
	default:
		return http.SameSiteLaxMode
	}
}

func parseBool(v string) bool {
	return strings.EqualFold(strings.TrimSpace(v), "true") || v == "1"
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
