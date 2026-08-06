package backup

import (
	"compress/gzip"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"moodshare/internal/db"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// Config holds settings for Google Drive PostgreSQL backups.
type Config struct {
	DatabaseURL       string
	CredentialsJSON   string // Raw JSON string or path to JSON file
	CredentialsFile   string // Path to credentials file
	OAuthClientID     string // OAuth2 Client ID
	OAuthClientSecret string // OAuth2 Client Secret
	OAuthRefreshToken string // OAuth2 Refresh Token
	FolderID          string // Google Drive Folder ID
	IntervalHours     int    // Interval between backups in hours (default 3)
	RetentionDays     int    // Days to keep backups on Google Drive (default 7)
	Enabled           bool
}

// StartScheduler launches a background goroutine that runs database backups
// every IntervalHours (default: 3 hours).
func StartScheduler(ctx context.Context, cfg Config) {
	if !cfg.Enabled {
		log.Println("[backup] Automatic Google Drive backups are disabled (ENABLE_AUTO_BACKUP != true)")
		return
	}

	if cfg.DatabaseURL == "" {
		log.Println("[backup] warning: DATABASE_URL not set — backup scheduler disabled")
		return
	}

	if cfg.OAuthRefreshToken == "" && cfg.CredentialsJSON == "" && cfg.CredentialsFile == "" {
		log.Println("[backup] warning: No Google Drive credentials set (need GDRIVE_REFRESH_TOKEN or GDRIVE_CREDENTIALS_JSON/FILE) — backup scheduler disabled")
		return
	}

	if cfg.FolderID == "" {
		log.Println("[backup] warning: GDRIVE_FOLDER_ID not set — backup scheduler disabled")
		return
	}

	interval := cfg.IntervalHours
	if interval <= 0 {
		interval = 3
	}

	log.Printf("[backup] Automatic Google Drive backup scheduler started (interval: %d hours, retention: %d days)", interval, cfg.RetentionDays)

	// Run immediate backup asynchronously on startup
	go func() {
		if err := PerformBackup(ctx, cfg); err != nil {
			log.Printf("[backup] error running initial backup: %v", err)
		}
	}()

	ticker := time.NewTicker(time.Duration(interval) * time.Hour)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				log.Println("[backup] Backup scheduler stopped")
				return
			case <-ticker.C:
				log.Println("[backup] Starting scheduled 3-hour database backup...")
				if err := PerformBackup(ctx, cfg); err != nil {
					log.Printf("[backup] scheduled backup failed: %v", err)
				}
			}
		}
	}()
}

// PerformBackup creates a dump, uploads it to Google Drive, and cleans up old backups.
func PerformBackup(ctx context.Context, cfg Config) error {
	startTime := time.Now()
	filename := fmt.Sprintf("moodila_backup_%s.sql.gz", startTime.Format("2006-01-02_15-04-05"))
	tmpFile := filepath.Join(os.TempDir(), filename)

	defer os.Remove(tmpFile)

	log.Printf("[backup] Dump file target: %s", tmpFile)

	// 1. Create SQL dump file (gzipped)
	if err := createDump(ctx, cfg.DatabaseURL, tmpFile); err != nil {
		return fmt.Errorf("failed to create database dump: %w", err)
	}

	fi, err := os.Stat(tmpFile)
	if err != nil {
		return fmt.Errorf("stat dump file error: %w", err)
	}
	log.Printf("[backup] Database dump created successfully (%d bytes)", fi.Size())

	// 2. Init Google Drive service
	driveSvc, err := initDriveService(ctx, cfg)
	if err != nil {
		return fmt.Errorf("google drive authentication failed: %w", err)
	}

	// 3. Upload dump file to Google Drive
	f, err := os.Open(tmpFile)
	if err != nil {
		return fmt.Errorf("failed to open dump file for reading: %w", err)
	}
	defer f.Close()

	driveFile := &drive.File{
		Name:    filename,
		Parents: []string{cfg.FolderID},
	}

	res, err := driveSvc.Files.Create(driveFile).Media(f).Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("failed to upload backup to Google Drive: %w", err)
	}

	log.Printf("[backup] Backup uploaded to Google Drive! File ID: %s, Name: %s (duration: %v)", res.Id, res.Name, time.Since(startTime).Round(time.Millisecond))

	// 4. Enforce Retention Policy
	if cfg.RetentionDays > 0 {
		if err := enforceRetentionPolicy(ctx, driveSvc, cfg.FolderID, cfg.RetentionDays); err != nil {
			log.Printf("[backup] warning: retention cleanup error: %v", err)
		}
	}

	return nil
}

// createDump attempts pg_dump first; falls back to pure Go SQL exporter.
func createDump(ctx context.Context, dbURL, outputPath string) error {
	outFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("cannot create output file: %w", err)
	}
	defer outFile.Close()

	gzWriter := gzip.NewWriter(outFile)
	defer gzWriter.Close()

	// Method A: Check if pg_dump is available in system PATH
	if _, lookErr := exec.LookPath("pg_dump"); lookErr == nil {
		log.Println("[backup] Using system 'pg_dump' utility")
		cmd := exec.CommandContext(ctx, "pg_dump", "--dbname="+dbURL, "--clean", "--if-exists")
		cmd.Stdout = gzWriter
		var stderr strings.Builder
		cmd.Stderr = &stderr

		if err := cmd.Run(); err == nil {
			return nil
		} else {
			log.Printf("[backup] pg_dump failed (%v: %s), falling back to Go SQL exporter", err, stderr.String())
		}
	}

	// Method B: Pure Go SQL Exporter fallback
	log.Println("[backup] Using built-in Go SQL database exporter")
	return dumpGoNative(ctx, dbURL, gzWriter)
}

// dumpGoNative exports Postgres schema & data directly via SQL queries.
func dumpGoNative(ctx context.Context, dbURL string, w io.Writer) error {
	pool, err := db.Connect(ctx, dbURL)
	if err != nil {
		return fmt.Errorf("db connect error: %w", err)
	}
	defer pool.Close()

	header := fmt.Sprintf("-- Moodila Database Dump\n-- Date: %s\n\nSET statement_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n-- Temporarily disable foreign key checks during import\nSET session_replication_role = 'replica';\n\n", time.Now().Format(time.RFC3339))
	if _, err := io.WriteString(w, header); err != nil {
		return err
	}

	tables, err := getTablesInDependencyOrder(ctx, pool)
	if err != nil {
		return fmt.Errorf("failed to determine table order: %w", err)
	}

	for _, table := range tables {
		// Write table dump header
		tableHeader := fmt.Sprintf("\n--\n-- Data for Name: %s;\n--\n", table)
		if _, err := io.WriteString(w, tableHeader); err != nil {
			return err
		}

		// Query rows from table
		qRows, err := pool.Query(ctx, fmt.Sprintf(`SELECT * FROM "%s";`, table))
		if err != nil {
			log.Printf("[backup] warning: error querying table %s: %v", table, err)
			continue
		}

		fieldDescs := qRows.FieldDescriptions()
		var colNames []string
		for _, fd := range fieldDescs {
			colNames = append(colNames, fmt.Sprintf(`"%s"`, fd.Name))
		}
		colsJoined := strings.Join(colNames, ", ")

		for qRows.Next() {
			vals, err := qRows.Values()
			if err != nil {
				continue
			}

			var escapedVals []string
			for _, v := range vals {
				escapedVals = append(escapedVals, formatSQLValue(v))
			}

			insertStmt := fmt.Sprintf("INSERT INTO \"%s\" (%s) VALUES (%s);\n", table, colsJoined, strings.Join(escapedVals, ", "))
			if _, err := io.WriteString(w, insertStmt); err != nil {
				qRows.Close()
				return err
			}
		}
		qRows.Close()
	}

	footer := "\n-- Re-enable foreign key checks after import\nSET session_replication_role = 'origin';\n"
	if _, err := io.WriteString(w, footer); err != nil {
		return err
	}

	return nil
}

// getTablesInDependencyOrder fetches table names from public schema sorted in topological dependency order (parents before children).
func getTablesInDependencyOrder(ctx context.Context, pool *pgxpool.Pool) ([]string, error) {
	rows, err := pool.Query(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
	`)
	if err != nil {
		return nil, fmt.Errorf("query table names failed: %w", err)
	}
	defer rows.Close()

	var tables []string
	tableSet := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			tables = append(tables, name)
			tableSet[name] = true
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("scan table names failed: %w", err)
	}

	fkRows, err := pool.Query(ctx, `
		SELECT
			tc.table_name AS child_table,
			ccu.table_name AS parent_table
		FROM information_schema.table_constraints AS tc
		JOIN information_schema.key_column_usage AS kcu
		  ON tc.constraint_name = kcu.constraint_name
		 AND tc.table_schema = kcu.table_schema
		JOIN information_schema.constraint_column_usage AS ccu
		  ON ccu.constraint_name = tc.constraint_name
		 AND ccu.table_schema = tc.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND tc.table_schema = 'public';
	`)

	deps := make(map[string][]string)
	if err == nil {
		defer fkRows.Close()
		for fkRows.Next() {
			var child, parent string
			if err := fkRows.Scan(&child, &parent); err == nil {
				if child != parent && tableSet[child] && tableSet[parent] {
					deps[child] = append(deps[child], parent)
				}
			}
		}
	}

	return sortTablesTopologically(tables, deps), nil
}

// sortTablesTopologically sorts table names in dependency order (parents before children) deterministically.
func sortTablesTopologically(tables []string, deps map[string][]string) []string {
	cleanDeps := make(map[string]map[string]bool)
	for child, parents := range deps {
		if cleanDeps[child] == nil {
			cleanDeps[child] = make(map[string]bool)
		}
		for _, p := range parents {
			if p != child {
				cleanDeps[child][p] = true
			}
		}
	}

	inDegree := make(map[string]int)
	parentToChildren := make(map[string][]string)

	for _, t := range tables {
		parents := cleanDeps[t]
		inDegree[t] = len(parents)
		for p := range parents {
			parentToChildren[p] = append(parentToChildren[p], t)
		}
	}

	var available []string
	for _, t := range tables {
		if inDegree[t] == 0 {
			available = append(available, t)
		}
	}

	sort.Strings(available)

	visited := make(map[string]bool)
	var result []string

	for len(available) > 0 {
		curr := available[0]
		available = available[1:]

		if visited[curr] {
			continue
		}
		visited[curr] = true
		result = append(result, curr)

		for _, child := range parentToChildren[curr] {
			if !visited[child] {
				inDegree[child]--
				if inDegree[child] == 0 {
					available = append(available, child)
					sort.Strings(available)
				}
			}
		}
	}

	var remaining []string
	for _, t := range tables {
		if !visited[t] {
			remaining = append(remaining, t)
		}
	}
	sort.Strings(remaining)
	result = append(result, remaining...)

	return result
}

func formatSQLValue(val interface{}) string {
	if val == nil {
		return "NULL"
	}
	switch v := val.(type) {
	case string:
		escaped := strings.ReplaceAll(v, "'", "''")
		return fmt.Sprintf("'%s'", escaped)
	case time.Time:
		return fmt.Sprintf("'%s'", v.Format(time.RFC3339Nano))
	case []byte:
		// real byte slices (e.g. bytea columns) -> hex literal
		return fmt.Sprintf("'\\x%x'", v)
	case [16]byte:
		// pgx returns UUID columns as [16]byte
		u, err := uuid.FromBytes(v[:])
		if err != nil {
			return "NULL"
		}
		return fmt.Sprintf("'%s'", u.String())
	case bool:
		if v {
			return "TRUE"
		}
		return "FALSE"
	case []string:
		// text[] etc.
		var quoted []string
		for _, s := range v {
			esc := strings.ReplaceAll(s, `"`, `\"`)
			quoted = append(quoted, fmt.Sprintf(`"%s"`, esc))
		}
		return fmt.Sprintf("'{%s}'", strings.Join(quoted, ","))
	case []interface{}:
		var parts []string
		for _, item := range v {
			parts = append(parts, fmt.Sprintf("%v", item))
		}
		return fmt.Sprintf("'{%s}'", strings.Join(parts, ","))
	case int16, int32, int64, float32, float64, int:
		return fmt.Sprintf("%v", v)
	default:
		// last resort: stringify and quote, better than a bare Go-syntax literal
		escaped := strings.ReplaceAll(fmt.Sprintf("%v", v), "'", "''")
		return fmt.Sprintf("'%s'", escaped)
	}
}

// initDriveService initializes Google Drive API client using OAuth2 Refresh Token, Service Account JSON, base64, or file path.
func initDriveService(ctx context.Context, cfg Config) (*drive.Service, error) {
	// Method 1: OAuth2 Refresh Token (For Personal Google Accounts)
	if cfg.OAuthRefreshToken != "" && cfg.OAuthClientID != "" && cfg.OAuthClientSecret != "" {
		log.Println("[backup] Authenticating with Google Drive via OAuth2 Refresh Token (Personal Drive)")
		oauthCfg := &oauth2.Config{
			ClientID:     cfg.OAuthClientID,
			ClientSecret: cfg.OAuthClientSecret,
			Endpoint:     google.Endpoint,
			Scopes:       []string{drive.DriveFileScope},
		}
		tok := &oauth2.Token{
			RefreshToken: cfg.OAuthRefreshToken,
		}
		client := oauthCfg.Client(ctx, tok)
		return drive.NewService(ctx, option.WithHTTPClient(client))
	}

	var opts []option.ClientOption

	if cfg.CredentialsJSON != "" {
		trimmed := strings.TrimSpace(cfg.CredentialsJSON)
		var jsonBytes []byte

		if strings.HasPrefix(trimmed, "{") {
			jsonBytes = []byte(trimmed)
		} else if b, err := base64.StdEncoding.DecodeString(trimmed); err == nil && strings.HasPrefix(strings.TrimSpace(string(b)), "{") {
			jsonBytes = b
		} else if b, err := os.ReadFile(trimmed); err == nil {
			jsonBytes = b
		} else {
			return nil, fmt.Errorf("invalid GDRIVE_CREDENTIALS_JSON: must be raw JSON, Base64 string, or valid file path")
		}
		opts = append(opts, option.WithCredentialsJSON(jsonBytes))
	} else if cfg.CredentialsFile != "" {
		opts = append(opts, option.WithCredentialsFile(cfg.CredentialsFile))
	} else {
		return nil, fmt.Errorf("no google drive credentials specified (set GDRIVE_REFRESH_TOKEN or GDRIVE_CREDENTIALS_JSON/FILE)")
	}

	opts = append(opts, option.WithScopes(drive.DriveFileScope))
	return drive.NewService(ctx, opts...)
}

// enforceRetentionPolicy deletes files older than retentionDays from the specified folder.
func enforceRetentionPolicy(ctx context.Context, driveSvc *drive.Service, folderID string, retentionDays int) error {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	q := fmt.Sprintf("'%s' in parents and trashed = false", folderID)

	fileList, err := driveSvc.Files.List().Q(q).Fields("files(id, name, createdTime)").Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("list google drive files error: %w", err)
	}

	for _, file := range fileList.Files {
		created, err := time.Parse(time.RFC3339, file.CreatedTime)
		if err != nil {
			continue
		}
		if created.Before(cutoff) {
			log.Printf("[backup] Removing old backup file from Google Drive: %s (ID: %s, created: %s)", file.Name, file.Id, file.CreatedTime)
			if err := driveSvc.Files.Delete(file.Id).Context(ctx).Do(); err != nil {
				log.Printf("[backup] warning: failed to delete old file %s: %v", file.Id, err)
			}
		}
	}
	return nil
}
