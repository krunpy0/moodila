// Package config reads runtime configuration from the environment, with an
// optional .env file loaded first for local development.
package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

// Config holds all runtime settings for the API.
type Config struct {
	Port                 string
	DatabaseURL          string
	JWTSecret            string
	CORSOrigin           string
	APIPublicURL         string
	AppEnv               string
	S3Endpoint           string
	S3Region             string
	S3Bucket             string
	S3AccessKeyID        string
	S3SecretAccessKey    string
	S3SessionToken       string
	S3PublicBaseURL      string
	S3ForcePathStyle     bool
	ResetTokenTTLMinutes         int
	AccountDeleteTokenTTLMinutes int
	ResendAPIKey                 string
	ResendFromEmail              string
	AppBaseURL                   string
}

// Load reads configuration, loading backend/.env first (if present) so local
// values are available without exporting them by hand.
func Load() Config {
	loadDotEnv(".env")

	return Config{
		Port:                         getenv("PORT", "8080"),
		DatabaseURL:                  os.Getenv("DATABASE_URL"),
		JWTSecret:                    os.Getenv("JWT_SECRET"),
		CORSOrigin:                   getenv("CORS_ORIGIN", "http://localhost:5173"),
		APIPublicURL:                 strings.TrimRight(getenv("API_PUBLIC_URL", "http://localhost:8080"), "/"),
		AppEnv:                       getenv("APP_ENV", "development"),
		S3Endpoint:                   strings.TrimRight(os.Getenv("S3_ENDPOINT"), "/"),
		S3Region:                     getenv("S3_REGION", "us-east-1"),
		S3Bucket:                     getenv("S3_BUCKET", "entry-photos"),
		S3AccessKeyID:                getenv("ACCESS_KEY_ID", os.Getenv("AWS_ACCESS_KEY_ID")),
		S3SecretAccessKey:            getenv("SECRET_ACCESS_KEY", os.Getenv("AWS_SECRET_ACCESS_KEY")),
		S3SessionToken:               getenv("AWS_SESSION_TOKEN", ""),
		S3PublicBaseURL:              strings.TrimRight(os.Getenv("S3_PUBLIC_BASE_URL"), "/"),
		S3ForcePathStyle:             strings.EqualFold(os.Getenv("S3_FORCE_PATH_STYLE"), "true"),
		ResetTokenTTLMinutes:         parseInt(getenv("RESET_TOKEN_TTL_MINUTES", "30"), 30),
		AccountDeleteTokenTTLMinutes: parseInt(getenv("ACCOUNT_DELETE_TOKEN_TTL_MINUTES", "30"), 30),
		ResendAPIKey:                 os.Getenv("RESEND_API_KEY"),
		ResendFromEmail:              getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
		AppBaseURL:                   strings.TrimRight(getenv("APP_BASE_URL", "http://localhost:5173"), "/"),
	}
}



func parseBool(v string) bool {
	return strings.EqualFold(strings.TrimSpace(v), "true") || v == "1"
}

func parseInt(v string, def int) int {
	if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 {
		return n
	}
	return def
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
