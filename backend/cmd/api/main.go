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

	router.GET("/health", handlers.Health{Pool: pool}.Get)
	auth := handlers.Auth{
		Users:     repository.Users{Pool: pool},
		JWTSecret: cfg.JWTSecret,
	}
	router.POST("/auth/register", auth.Register)
	router.POST("/auth/login", auth.Login)
	router.GET("/auth/session", middleware.Auth(cfg.JWTSecret), auth.Session)
	entries := handlers.Entries{Entries: repository.Entries{Pool: pool}}
	storageHandler := handlers.Storage{Storage: storage.S3{
		Endpoint: cfg.S3Endpoint, Region: cfg.S3Region, Bucket: cfg.S3Bucket,
		AccessKeyID: cfg.S3AccessKeyID, SecretAccessKey: cfg.S3SecretAccessKey,
		SessionToken: cfg.S3SessionToken, PublicBaseURL: cfg.S3PublicBaseURL,
		ForcePathStyle: cfg.S3ForcePathStyle,
	}, JWTSecret: cfg.JWTSecret, UploadAPIURL: cfg.APIPublicURL}
	friends := handlers.Friends{Friends: repository.Friends{Pool: pool}}
	users := handlers.Users{Users: repository.Users{Pool: pool}, Entries: repository.Entries{Pool: pool}, Friends: repository.Friends{Pool: pool}}
	feed := handlers.Feed{Feed: repository.Feed{Pool: pool}}
	authorized := router.Group("/", middleware.Auth(cfg.JWTSecret))
	authorized.POST("/entries", entries.Save)
	authorized.POST("/storage/entry-photos/upload-url", storageHandler.SignUpload)
	authorized.PUT("/storage/entry-photos/upload/:token", storageHandler.Upload)
	authorized.GET("/entries/me", entries.Me)
	authorized.GET("/entries/friend/:friend_id", entries.Friend)
	authorized.GET("/entries/summary", entries.Summary)
	authorized.GET("/users/search", friends.Search)
	authorized.GET("/users/me", users.Me)
	authorized.PATCH("/users/me", users.UpdateMe)
	authorized.GET("/users/:id/profile", users.FriendProfile)
	authorized.POST("/friends/request", friends.Request)
	authorized.POST("/friends/accept", friends.Accept)
	authorized.POST("/friends/decline", friends.Decline)
	authorized.GET("/friends", friends.Accepted)
	authorized.GET("/friends/pending", friends.Pending)
	authorized.GET("/feed", feed.List)
	authorized.POST("/feed/:entry_id/like", feed.Like)

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
