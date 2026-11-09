package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"sync/atomic"
	"testing"
	"time"

	"moodshare/internal/models"
	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type queryCounter struct{ count atomic.Int32 }

func (q *queryCounter) TraceQueryStart(ctx context.Context, _ *pgx.Conn, _ pgx.TraceQueryStartData) context.Context {
	q.count.Add(1)
	return ctx
}

func (*queryCounter) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

func TestPerformanceIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	counter := &queryCounter{}
	cfg.ConnConfig.Tracer = counter
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	name := fmt.Sprintf("perf%d", time.Now().UnixNano())
	var userID string
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, username) VALUES ($1, $2) RETURNING id`, name+"@test.invalid", name).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, userID)
	if _, err := pool.Exec(ctx, `INSERT INTO entries (user_id, date, mood, tags, text) VALUES ($1, CURRENT_DATE, 4, ARRAY['Calm'], 'Hello')`, userID); err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("userID", userID) })
	router.GET("/stats", Stats{Entries: repository.Entries{Pool: pool}}.Get)
	router.GET("/feed", Feed{Feed: repository.Feed{Pool: pool}}.List)
	request := func(path string, queries int) *httptest.ResponseRecorder {
		t.Helper()
		counter.count.Store(0)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != http.StatusOK {
			t.Fatalf("%s: status %d: %s", path, w.Code, w.Body.String())
		}
		if got := int(counter.count.Load()); got != queries {
			t.Fatalf("%s: expected %d SQL queries, got %d", path, queries, got)
		}
		return w
	}
	decodeStats := func(w *httptest.ResponseRecorder) models.StatsResponse {
		t.Helper()
		var stats models.StatsResponse
		if err := json.Unmarshal(w.Body.Bytes(), &stats); err != nil {
			t.Fatal(err)
		}
		return stats
	}
	full := decodeStats(request("/stats?period=month", 6))
	summary := decodeStats(request("/stats?scope=summary", 5))
	if summary.TotalEntries != 1 || summary.OverallAvgMood == nil || *summary.OverallAvgMood != 4 || len(summary.MoodSeries) != 0 {
		t.Fatalf("unexpected summary: %+v", summary)
	}
	full.MoodSeries = nil
	summary.MoodSeries = nil
	if !reflect.DeepEqual(full, summary) {
		t.Fatal("split summary differs from the legacy full response")
	}
	for _, period := range []string{"week", "month", "year", "all"} {
		series := decodeStats(request("/stats?scope=series&period="+period, 1))
		if series.Period != period || len(series.MoodSeries) == 0 {
			t.Fatalf("missing series for %s: %+v", period, series)
		}
		var entries int
		for _, point := range series.MoodSeries {
			entries += point.EntryCount
		}
		if entries != 1 {
			t.Fatalf("%s: expected 1 entry in series, got %d", period, entries)
		}
	}
	t.Log("four periods: 5 shared + 4 series = 9 SQL queries (previously 24)")
	var page map[string]json.RawMessage
	if err := json.Unmarshal(request("/feed?include_self=true", 2).Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if _, exists := page["entries"]; exists {
		t.Fatal("feed duplicates its items as entries")
	}
	var items []models.FeedEntry
	if err := json.Unmarshal(page["items"], &items); err != nil || len(items) != 1 {
		t.Fatalf("invalid feed: %s (%v)", page["items"], err)
	}

	t.Run("indexed user search preserves ranking and privacy", func(t *testing.T) {
		var ids []string
		for _, candidate := range [][2]string{
			{name + "_username", "Other"},
			{"other" + name, name + " display"},
			{"last" + name, "Before " + name + " 100%_"},
			{"blocked" + name, name + " blocked"},
			{"deleted" + name, name + " deleted"},
		} {
			var id string
			if err := pool.QueryRow(ctx, `INSERT INTO users (email, username, display_name) VALUES ($1, $2, $3) RETURNING id`, candidate[0]+"@test.invalid", candidate[0], candidate[1]).Scan(&id); err != nil {
				t.Fatal(err)
			}
			defer pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id)
			ids = append(ids, id)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2);
			UPDATE users SET deleted_at = now() WHERE id = $3`, ids[3], userID, ids[4]); err != nil {
			t.Fatal(err)
		}
		friends := repository.Friends{Pool: pool}
		found, err := friends.Search(ctx, userID, name)
		if err != nil || len(found) != 3 {
			t.Fatalf("search: %+v %v", found, err)
		}
		for i := range found {
			if found[i].ID != ids[i] {
				t.Fatalf("wrong rank %d: %+v", i, found)
			}
		}
		found, err = friends.Search(ctx, userID, "100%_")
		if err != nil || len(found) != 1 || found[0].ID != ids[2] {
			t.Fatalf("literal wildcard search: %+v %v", found, err)
		}
	})
}
