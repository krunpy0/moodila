// Package config reads runtime configuration from the environment, with an
// optional .env file loaded first for local development.
package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config holds all runtime settings for the API.
type Config struct {
	Port                         string
	DatabaseURL                  string
	JWTSecret                    string
	CORSOrigin                   string
	APIPublicURL                 string
	AppEnv                       string
	S3Endpoint                   string
	S3Region                     string
	S3Bucket                     string
	S3AccessKeyID                string
	S3SecretAccessKey            string
	S3SessionToken               string
	S3PublicBaseURL              string
	S3ForcePathStyle             bool
	S3IsPrivate                  bool
	ResetTokenTTLMinutes         int
	AccountDeleteTokenTTLMinutes int
	ResendAPIKey                 string
	ResendFromEmail              string
	AppBaseURL                   string
	TLSCert                      string
	TLSKey                       string
	GDriveCredentialsJSON        string
	GDriveCredentialsFile        string
	GDriveRefreshToken           string
	GoogleClientID               string
	GoogleClientSecret           string
	GDriveFolderID               string
	BackupIntervalHours          int
	BackupRetentionDays          int
	EnableAutoBackup             bool
	CookieSecure                 bool
	CookieSameSite               string
	CookieDomain                 string
	VAPIDPublicKey               string
	VAPIDPrivateKey              string
	VAPIDSubscriber              string
	SentryDSN                    string
	SentryEnvironment            string
	SentryRelease                string
	SentryTracesSampleRate       float64
}

// Load reads configuration, loading backend/.env first (if present) so local
// values are available without exporting them by hand.
func Load() Config {
	loadDotEnv()

	appEnv := getenv("APP_ENV", "development")
	defaultSecure := strings.EqualFold(appEnv, "production")
	if secEnv := os.Getenv("COOKIE_SECURE"); secEnv != "" {
		defaultSecure = parseBool(secEnv)
	}

	return Config{
		Port:                         getenv("PORT", "8080"),
		DatabaseURL:                  os.Getenv("DATABASE_URL"),
		JWTSecret:                    os.Getenv("JWT_SECRET"),
		CORSOrigin:                   getenv("CORS_ORIGIN", "http://localhost:5173"),
		APIPublicURL:                 strings.TrimRight(getenv("API_PUBLIC_URL", "http://localhost:8080"), "/"),
		AppEnv:                       appEnv,
		S3Endpoint:                   strings.TrimRight(os.Getenv("S3_ENDPOINT"), "/"),
		S3Region:                     getenv("S3_REGION", "us-east-1"),
		S3Bucket:                     getenv("S3_BUCKET", "entry-photos"),
		S3AccessKeyID:                getenv("ACCESS_KEY_ID", os.Getenv("AWS_ACCESS_KEY_ID")),
		S3SecretAccessKey:            getenv("SECRET_ACCESS_KEY", os.Getenv("AWS_SECRET_ACCESS_KEY")),
		S3SessionToken:               getenv("AWS_SESSION_TOKEN", ""),
		S3PublicBaseURL:              strings.TrimRight(os.Getenv("S3_PUBLIC_BASE_URL"), "/"),
		S3ForcePathStyle:             strings.EqualFold(os.Getenv("S3_FORCE_PATH_STYLE"), "true"),
		S3IsPrivate:                  parseBool(getenv("S3_IS_PRIVATE", "false")),
		ResetTokenTTLMinutes:         parseInt(getenv("RESET_TOKEN_TTL_MINUTES", "30"), 30),
		AccountDeleteTokenTTLMinutes: parseInt(getenv("ACCOUNT_DELETE_TOKEN_TTL_MINUTES", "30"), 30),
		ResendAPIKey:                 os.Getenv("RESEND_API_KEY"),
		ResendFromEmail:              getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
		AppBaseURL:                   strings.TrimRight(getenv("APP_BASE_URL", "http://localhost:5173"), "/"),
		TLSCert:                      os.Getenv("TLS_CERT"),
		TLSKey:                       os.Getenv("TLS_KEY"),
		GDriveCredentialsJSON:        os.Getenv("GDRIVE_CREDENTIALS_JSON"),
		GDriveCredentialsFile:        os.Getenv("GDRIVE_CREDENTIALS_FILE"),
		GDriveRefreshToken:           getenv("GDRIVE_REFRESH_TOKEN", os.Getenv("GOOGLE_REFRESH_TOKEN")),
		GoogleClientID:               getenv("GDRIVE_CLIENT_ID", os.Getenv("GOOGLE_CLIENT_ID")),
		GoogleClientSecret:           getenv("GDRIVE_CLIENT_SECRET", os.Getenv("GOOGLE_CLIENT_SECRET")),
		GDriveFolderID:               os.Getenv("GDRIVE_FOLDER_ID"),
		BackupIntervalHours:          parseInt(getenv("BACKUP_INTERVAL_HOURS", "3"), 3),
		BackupRetentionDays:          parseInt(getenv("BACKUP_RETENTION_DAYS", "7"), 7),
		EnableAutoBackup:             parseBool(getenv("ENABLE_AUTO_BACKUP", "true")),
		CookieSecure:                 defaultSecure,
		CookieSameSite:               getenv("COOKIE_SAMESITE", "none"),
		CookieDomain:                 os.Getenv("COOKIE_DOMAIN"),
		VAPIDPublicKey:               os.Getenv("VAPID_PUBLIC_KEY"),
		VAPIDPrivateKey:              os.Getenv("VAPID_PRIVATE_KEY"),
		VAPIDSubscriber:              getenv("VAPID_SUBSCRIBER", "mailto:admin@moodila.app"),
		SentryDSN:                    strings.TrimSpace(os.Getenv("SENTRY_DSN")),
		SentryEnvironment:            getenv("SENTRY_ENVIRONMENT", appEnv),
		SentryRelease:                getenv("SENTRY_RELEASE", "moodshare@1.0.0"),
		SentryTracesSampleRate:       parseFloat(os.Getenv("SENTRY_TRACES_SAMPLE_RATE"), defaultTracesSampleRate(appEnv)),
	}
}

func defaultTracesSampleRate(appEnv string) float64 {
	if strings.EqualFold(appEnv, "production") {
		return 0.1
	}
	return 0.0
}

func parseFloat(v string, def float64) float64 {
	if v == "" {
		return def
	}
	if n, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil && n >= 0.0 && n <= 1.0 {
		return n
	}
	return def
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

// loadDotEnv loads KEY=VALUE lines from .env into the process environment,
// searching the current directory, parent directories, and backend subfolder,
// without overriding variables that are already set.
func loadDotEnv(paths ...string) {
	var envFiles []string
	if len(paths) > 0 {
		envFiles = paths
	} else {
		candidates := []string{
			".env",
			"backend/.env",
			"../.env",
			"../../.env",
			"../../../.env",
		}
		for _, p := range candidates {
			if info, err := os.Stat(p); err == nil && !info.IsDir() {
				envFiles = append(envFiles, p)
				break
			}
		}

		if len(envFiles) == 0 {
			if cwd, err := os.Getwd(); err == nil {
				dir := cwd
				for i := 0; i < 5; i++ {
					envPath := filepath.Join(dir, ".env")
					if info, err := os.Stat(envPath); err == nil && !info.IsDir() {
						envFiles = append(envFiles, envPath)
						break
					}
					backendEnvPath := filepath.Join(dir, "backend", ".env")
					if info, err := os.Stat(backendEnvPath); err == nil && !info.IsDir() {
						envFiles = append(envFiles, backendEnvPath)
						break
					}
					parent := filepath.Dir(dir)
					if parent == dir {
						break
					}
					dir = parent
				}
			}
		}
	}

	for _, path := range envFiles {
		f, err := os.Open(path)
		if err != nil {
			continue
		}
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
		_ = f.Close()
	}
}
