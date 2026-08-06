package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"moodshare/internal/backup"
	"moodshare/internal/config"
	"moodshare/internal/db"
	"moodshare/internal/handlers"
	"moodshare/internal/mailer"
	"moodshare/internal/middleware"
	"moodshare/internal/repository"
	"moodshare/internal/services/push"
	"moodshare/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/time/rate"
)

func main() {
	cfg := config.Load()

	// Start Google Drive database backup background scheduler (every 3 hours)
	backupCtx, backupCancel := context.WithCancel(context.Background())
	defer backupCancel()
	backup.StartScheduler(backupCtx, backup.Config{
		DatabaseURL:       cfg.DatabaseURL,
		CredentialsJSON:   cfg.GDriveCredentialsJSON,
		CredentialsFile:   cfg.GDriveCredentialsFile,
		OAuthClientID:     cfg.GoogleClientID,
		OAuthClientSecret: cfg.GoogleClientSecret,
		OAuthRefreshToken: cfg.GDriveRefreshToken,
		FolderID:          cfg.GDriveFolderID,
		IntervalHours:     cfg.BackupIntervalHours,
		RetentionDays:     cfg.BackupRetentionDays,
		Enabled:           cfg.EnableAutoBackup,
	})

	// Connect to Postgres (Supabase). The server still starts if the DB is
	// unreachable so the rest of the app can be developed/tested; /health
	// reports the actual DB status.
	var pool *pgxpool.Pool
	if cfg.DatabaseURL == "" {
		log.Println("warning: DATABASE_URL not set — starting without database (set it in backend/.env)")
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		p, err := db.Connect(ctx, cfg.DatabaseURL)
		cancel()
		if err != nil {
			log.Printf("warning: could not connect to database: %v", err)
		} else {
			pool = p
			defer pool.Close()
			log.Println("connected to database")

			mctx, mcancel := context.WithTimeout(context.Background(), 30*time.Second)
			if err := db.Migrate(mctx, pool, nil); err != nil {
				log.Printf("warning: migrations failed: %v", err)
			} else {
				log.Println("migrations up to date")
			}
			mcancel()
		}
	}

	router := gin.New()
	router.Use(gin.Recovery(), middleware.Logger, middleware.CORS(cfg.CORSOrigin))

	// Tier-based Rate Limiters
	authLimiter := middleware.RateLimit(rate.Every(12*time.Second), 5, middleware.IPKey)
	forgotLimiter := middleware.RateLimit(rate.Every(60*time.Second), 1, middleware.IPKey)
	deleteConfirmLimiter := middleware.RateLimit(rate.Every(10*time.Minute), 3, middleware.IPKey)
	passwordChangeLimiter := middleware.RateLimit(rate.Every(60*time.Second), 5, middleware.UserOrIPKey)
	uploadLimiter := middleware.RateLimit(rate.Every(4*time.Second), 10, middleware.UserOrIPKey)
	mutationLimiter := middleware.RateLimit(rate.Every(2*time.Second), 15, middleware.UserOrIPKey)
	readLimiter := middleware.RateLimit(rate.Every(600*time.Millisecond), 30, middleware.UserOrIPKey)
	healthLimiter := middleware.RateLimit(rate.Every(200*time.Millisecond), 50, middleware.IPKey)

	mailClient := mailer.New(cfg.ResendAPIKey, cfg.ResendFromEmail, cfg.AppEnv == "development")

	pushSubscriptionsRepo := repository.PushSubscriptions{Pool: pool}
	pushService, err := push.NewService(cfg, pushSubscriptionsRepo)
	if err != nil {
		log.Printf("warning: push service initialization failed: %v", err)
	}

	router.GET("/health", healthLimiter, handlers.Health{Pool: pool}.Get)
	auth := handlers.Auth{
		Users:           repository.Users{Pool: pool},
		PasswordReset:   repository.PasswordReset{Pool: pool},
		AccountDeletion: repository.AccountDeletion{Pool: pool},
		Mailer:          mailClient,
		Config:          cfg,
		JWTSecret:       cfg.JWTSecret,
	}
	router.POST("/auth/register", authLimiter, auth.Register)
	router.POST("/auth/login", authLimiter, auth.Login)
	router.POST("/auth/refresh", authLimiter, auth.Refresh)
	router.POST("/auth/forgot-password", forgotLimiter, auth.ForgotPassword)
	router.POST("/auth/reset-password", authLimiter, auth.ResetPassword)
	router.POST("/auth/account/delete-confirm", deleteConfirmLimiter, auth.DeleteAccountConfirm)
	router.POST("/auth/logout", mutationLimiter, auth.Logout)
	router.GET("/auth/session", middleware.Auth(cfg.JWTSecret), readLimiter, auth.Session)
	storageS3 := storage.S3{
		Endpoint: cfg.S3Endpoint, Region: cfg.S3Region, Bucket: cfg.S3Bucket,
		AccessKeyID: cfg.S3AccessKeyID, SecretAccessKey: cfg.S3SecretAccessKey,
		SessionToken: cfg.S3SessionToken, PublicBaseURL: cfg.S3PublicBaseURL,
		ForcePathStyle: cfg.S3ForcePathStyle, IsPrivate: cfg.S3IsPrivate,
	}
	entries := handlers.Entries{Entries: repository.Entries{Pool: pool}, Storage: storageS3}
	storageHandler := handlers.Storage{Storage: storageS3, JWTSecret: cfg.JWTSecret, UploadAPIURL: cfg.APIPublicURL}
	notificationsRepo := repository.Notifications{Pool: pool, PushSender: pushService}
	notificationsHandler := handlers.Notifications{Notifications: notificationsRepo, Storage: storageS3}
	pushNotificationsHandler := handlers.PushNotifications{Repo: pushSubscriptionsRepo, PushService: pushService}
	announcementsRepo := repository.Announcements{Pool: pool}
	announcementsHandler := handlers.Announcements{Announcements: announcementsRepo}
	usersRepo := repository.Users{Pool: pool}
	friends := handlers.Friends{Friends: repository.Friends{Pool: pool}, Notifications: notificationsRepo, Storage: storageS3}
	users := handlers.Users{Users: usersRepo, Entries: repository.Entries{Pool: pool}, Friends: repository.Friends{Pool: pool}, Storage: storageS3}
	feed := handlers.Feed{Feed: repository.Feed{Pool: pool}, Notifications: notificationsRepo, Storage: storageS3}
	authorized := router.Group("/", middleware.Auth(cfg.JWTSecret), middleware.CSRF())
	authorized.PATCH("/auth/password", passwordChangeLimiter, auth.ChangePassword)
	authorized.POST("/auth/account/delete-request", passwordChangeLimiter, auth.DeleteAccountRequest)
	authorized.POST("/entries", mutationLimiter, entries.Save)
	authorized.DELETE("/entries/:id", mutationLimiter, entries.Delete)
	authorized.DELETE("/entries", mutationLimiter, entries.Delete)
	authorized.PATCH("/entries/:id/visibility", mutationLimiter, entries.Visibility)
	authorized.POST("/storage/entry-photos/upload-url", uploadLimiter, storageHandler.SignUpload)
	authorized.POST("/storage/entry-audio/upload-url", uploadLimiter, storageHandler.SignAudioUpload)
	authorized.PUT("/storage/entry-photos/upload/:token", uploadLimiter, storageHandler.Upload)
	authorized.POST("/storage/delete", mutationLimiter, storageHandler.DeleteObject)

	statsHandler := handlers.Stats{Entries: repository.Entries{Pool: pool}}
	authorized.GET("/entries/me", readLimiter, entries.Me)
	authorized.GET("/entries/friend/:friend_id", readLimiter, entries.Friend)
	authorized.GET("/entries/summary", readLimiter, entries.Summary)
	authorized.GET("/stats", readLimiter, statsHandler.Get)
	authorized.GET("/users/search", readLimiter, friends.Search)
	authorized.GET("/users/me", readLimiter, users.Me)
	authorized.PATCH("/users/me", mutationLimiter, users.UpdateMe)
	authorized.GET("/users/:id/profile", readLimiter, users.FriendProfile)
	authorized.POST("/friends/request", mutationLimiter, friends.Request)
	authorized.POST("/friends/accept", mutationLimiter, friends.Accept)
	authorized.POST("/friends/decline", mutationLimiter, friends.Decline)
	authorized.POST("/friends/cancel", mutationLimiter, friends.Cancel)
	authorized.DELETE("/friends/:id", mutationLimiter, friends.Unfriend)
	authorized.GET("/friends", readLimiter, friends.Accepted)
	authorized.GET("/friends/pending", readLimiter, friends.Pending)
	authorized.GET("/feed", readLimiter, feed.List)
	authorized.POST("/feed/:entry_id/like", mutationLimiter, feed.Like)
	authorized.GET("/feed/:entry_id/reactions", readLimiter, feed.GetReactions)
	authorized.GET("/feed/:entry_id/comments", readLimiter, feed.GetComments)
	authorized.POST("/feed/:entry_id/comments", mutationLimiter, feed.AddComment)
	authorized.DELETE("/feed/comments/:comment_id", mutationLimiter, feed.DeleteComment)
	authorized.GET("/notifications", readLimiter, notificationsHandler.List)
	authorized.GET("/notifications/unread-count", readLimiter, notificationsHandler.UnreadCount)
	authorized.POST("/notifications/mark-read", mutationLimiter, notificationsHandler.MarkRead)
	authorized.GET("/notifications/vapid-public-key", readLimiter, pushNotificationsHandler.VAPIDPublicKey)
	authorized.POST("/notifications/push-subscription", mutationLimiter, pushNotificationsHandler.Subscribe)
	authorized.DELETE("/notifications/push-subscription", mutationLimiter, pushNotificationsHandler.Unsubscribe)
	authorized.GET("/announcements/unread", readLimiter, announcementsHandler.GetUnread)
	authorized.POST("/announcements/:id/read", mutationLimiter, announcementsHandler.MarkRead)

	admin := router.Group("/admin", middleware.Auth(cfg.JWTSecret), middleware.Admin(usersRepo))
	admin.GET("/announcements", readLimiter, announcementsHandler.ListAdmin)
	admin.POST("/announcements", mutationLimiter, announcementsHandler.CreateAdmin)
	admin.PATCH("/announcements/:id", mutationLimiter, announcementsHandler.UpdateAdmin)
	admin.POST("/announcements/:id/publish", mutationLimiter, announcementsHandler.PublishAdmin)
	admin.POST("/announcements/:id/archive", mutationLimiter, announcementsHandler.ArchiveAdmin)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	shutdownComplete := make(chan struct{})
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		sig := <-quit
		log.Printf("Received signal %v, initiating graceful shutdown...", sig)

		backupCancel()

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP server Shutdown error: %v", err)
		} else {
			log.Println("HTTP server stopped gracefully")
		}

		close(shutdownComplete)
	}()

	if cfg.TLSCert != "" && cfg.TLSKey != "" {
		log.Printf("MoodShare API listening on HTTPS :%s (env=%s)", cfg.Port, cfg.AppEnv)
		if err := srv.ListenAndServeTLS(cfg.TLSCert, cfg.TLSKey); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	} else {
		log.Printf("MoodShare API listening on HTTP :%s (env=%s)", cfg.Port, cfg.AppEnv)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}

	<-shutdownComplete

	if pool != nil {
		pool.Close()
		log.Println("Database connection pool closed")
	}
	log.Println("Server exited cleanly")
}
