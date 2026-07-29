package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"moodshare/internal/config"
	"moodshare/internal/db"
	"moodshare/internal/handlers"
	"moodshare/internal/middleware"
	"moodshare/internal/repository"
	"moodshare/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/time/rate"
)

func main() {
	cfg := config.Load()

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
			if err := db.Migrate(mctx, pool, "migrations"); err != nil {
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
	uploadLimiter := middleware.RateLimit(rate.Every(4*time.Second), 10, middleware.UserOrIPKey)
	mutationLimiter := middleware.RateLimit(rate.Every(2*time.Second), 15, middleware.UserOrIPKey)
	readLimiter := middleware.RateLimit(rate.Every(600*time.Millisecond), 30, middleware.UserOrIPKey)
	healthLimiter := middleware.RateLimit(rate.Every(200*time.Millisecond), 50, middleware.IPKey)

	router.GET("/health", healthLimiter, handlers.Health{Pool: pool}.Get)
	auth := handlers.Auth{
		Users:     repository.Users{Pool: pool},
		JWTSecret: cfg.JWTSecret,
	}
	router.POST("/auth/register", authLimiter, auth.Register)
	router.POST("/auth/login", authLimiter, auth.Login)
	router.GET("/auth/session", middleware.Auth(cfg.JWTSecret), readLimiter, auth.Session)
	entries := handlers.Entries{Entries: repository.Entries{Pool: pool}}
	storageHandler := handlers.Storage{Storage: storage.S3{
		Endpoint: cfg.S3Endpoint, Region: cfg.S3Region, Bucket: cfg.S3Bucket,
		AccessKeyID: cfg.S3AccessKeyID, SecretAccessKey: cfg.S3SecretAccessKey,
		SessionToken: cfg.S3SessionToken, PublicBaseURL: cfg.S3PublicBaseURL,
		ForcePathStyle: cfg.S3ForcePathStyle,
	}, JWTSecret: cfg.JWTSecret, UploadAPIURL: cfg.APIPublicURL}
	notificationsRepo := repository.Notifications{Pool: pool}
	notificationsHandler := handlers.Notifications{Notifications: notificationsRepo}
	announcementsRepo := repository.Announcements{Pool: pool}
	announcementsHandler := handlers.Announcements{Announcements: announcementsRepo}
	usersRepo := repository.Users{Pool: pool}
	friends := handlers.Friends{Friends: repository.Friends{Pool: pool}, Notifications: notificationsRepo}
	users := handlers.Users{Users: usersRepo, Entries: repository.Entries{Pool: pool}, Friends: repository.Friends{Pool: pool}}
	feed := handlers.Feed{Feed: repository.Feed{Pool: pool}, Notifications: notificationsRepo}
	authorized := router.Group("/", middleware.Auth(cfg.JWTSecret))
	authorized.POST("/entries", mutationLimiter, entries.Save)
	authorized.DELETE("/entries/:id", mutationLimiter, entries.Delete)
	authorized.DELETE("/entries", mutationLimiter, entries.Delete)
	authorized.PATCH("/entries/:id/visibility", mutationLimiter, entries.Visibility)
	authorized.POST("/storage/entry-photos/upload-url", uploadLimiter, storageHandler.SignUpload)
	authorized.POST("/storage/entry-audio/upload-url", uploadLimiter, storageHandler.SignAudioUpload)
	authorized.PUT("/storage/entry-photos/upload/:token", uploadLimiter, storageHandler.Upload)
	authorized.GET("/entries/me", readLimiter, entries.Me)
	authorized.GET("/entries/friend/:friend_id", readLimiter, entries.Friend)
	authorized.GET("/entries/summary", readLimiter, entries.Summary)
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
	authorized.GET("/feed/:entry_id/comments", readLimiter, feed.GetComments)
	authorized.POST("/feed/:entry_id/comments", mutationLimiter, feed.AddComment)
	authorized.DELETE("/feed/comments/:comment_id", mutationLimiter, feed.DeleteComment)
	authorized.GET("/notifications", readLimiter, notificationsHandler.List)
	authorized.GET("/notifications/unread-count", readLimiter, notificationsHandler.UnreadCount)
	authorized.POST("/notifications/mark-read", mutationLimiter, notificationsHandler.MarkRead)
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

	log.Printf("MoodShare API listening on :%s (env=%s)", cfg.Port, cfg.AppEnv)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
