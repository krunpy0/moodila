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
	authorized := router.Group("/", middleware.Auth(cfg.JWTSecret))
	authorized.POST("/entries", entries.Save)
	authorized.GET("/entries/me", entries.Me)
	authorized.GET("/entries/summary", entries.Summary)

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
