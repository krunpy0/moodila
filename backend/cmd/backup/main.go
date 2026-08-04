package main

import (
	"context"
	"log"

	"moodshare/internal/backup"
	"moodshare/internal/config"
)

func main() {
	log.Println("Starting Google Drive manual database backup...")

	cfg := config.Load()

	bCfg := backup.Config{
		DatabaseURL:       cfg.DatabaseURL,
		CredentialsJSON:   cfg.GDriveCredentialsJSON,
		CredentialsFile:   cfg.GDriveCredentialsFile,
		OAuthClientID:     cfg.GoogleClientID,
		OAuthClientSecret: cfg.GoogleClientSecret,
		OAuthRefreshToken: cfg.GDriveRefreshToken,
		FolderID:          cfg.GDriveFolderID,
		IntervalHours:     cfg.BackupIntervalHours,
		RetentionDays:     cfg.BackupRetentionDays,
		Enabled:           true,
	}

	if err := backup.PerformBackup(context.Background(), bCfg); err != nil {
		log.Fatalf("Backup failed: %v", err)
	}

	log.Println("Backup finished successfully!")
}
