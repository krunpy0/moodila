package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"moodshare/internal/config"
	"moodshare/internal/db"
	"moodshare/internal/models"
	"moodshare/internal/repository"

	"github.com/gin-gonic/gin"
)

func TestHiddenEntriesE2E(t *testing.T) {
	_ = os.Chdir("../..")
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		t.Skip("DATABASE_URL not set — skipping DB integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		t.Skipf("DB connection failed: %v — skipping test", err)
	}
	defer pool.Close()
	_ = db.Migrate(ctx, pool, "migrations")

	usersRepo := repository.Users{Pool: pool}
	entriesRepo := repository.Entries{Pool: pool}
	friendsRepo := repository.Friends{Pool: pool}
	feedRepo := repository.Feed{Pool: pool}

	// Create test user A and user B
	ts := time.Now().UnixNano()
	userA, err := usersRepo.Create(ctx, "userA_"+string(rune(ts))+"@test.com", "userA_hidden_"+time.Now().Format("150405"), "User A", "pass")
	if err != nil {
		t.Fatalf("create user A: %v", err)
	}
	defer pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userA.ID)

	userB, err := usersRepo.Create(ctx, "userB_"+string(rune(ts))+"@test.com", "userB_hidden_"+time.Now().Format("150405"), "User B", "pass")
	if err != nil {
		t.Fatalf("create user B: %v", err)
	}
	defer pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userB.ID)

	// Make A and B friends
	req, err := friendsRepo.Request(ctx, userA.ID, userB.ID)
	if err != nil {
		t.Fatalf("friend request: %v", err)
	}
	if _, err := friendsRepo.Respond(ctx, req.ID, userB.ID, "accepted"); err != nil {
		t.Fatalf("accept friend: %v", err)
	}

	date1 := "2026-07-01"
	date2 := "2026-07-02"
	isFalse := false
	isTrue := true

	// User A creates Entry 1 (public, is_hidden=false)
	entry1, err := entriesRepo.Save(ctx, userA.ID, date1, 4, []string{"Calm"}, "Public note", nil, &isFalse)
	if err != nil {
		t.Fatalf("save entry 1: %v", err)
	}

	// User A creates Entry 2 (hidden, is_hidden=true)
	entry2, err := entriesRepo.Save(ctx, userA.ID, date2, 5, []string{"Secret"}, "Hidden note", nil, &isTrue)
	if err != nil {
		t.Fatalf("save entry 2: %v", err)
	}

	// 1. Friend B views User A's calendar -> should see Entry 1, but NOT Entry 2
	friendEntries, err := entriesRepo.VisibleByMonth(ctx, userA.ID, "2026-07", "2026-08")
	if err != nil {
		t.Fatalf("VisibleByMonth: %v", err)
	}
	if len(friendEntries) != 1 || friendEntries[0].Date != date1 {
		t.Fatalf("expected only public entry1 for friend, got %#v", friendEntries)
	}

	// 2. Friend B views Feed -> should see Entry 1, but NOT Entry 2
	feedList, err := feedRepo.List(ctx, userB.ID)
	if err != nil {
		t.Fatalf("Feed.List: %v", err)
	}
	var bSeesEntry2 bool
	for _, fe := range feedList {
		if fe.ID == entry2.ID {
			bSeesEntry2 = true
		}
	}
	if bSeesEntry2 {
		t.Fatalf("friend B should not see hidden entry2 in feed")
	}

	// 3. User A views own calendar -> sees BOTH Entry 1 and Entry 2
	myEntries, err := entriesRepo.ByMonth(ctx, userA.ID, "2026-07", "2026-08")
	if err != nil {
		t.Fatalf("ByMonth for owner: %v", err)
	}
	if len(myEntries) != 2 {
		t.Fatalf("owner user A should see both entries, got %d", len(myEntries))
	}

	// 4. Test HTTP Handler PATCH /entries/:id/visibility
	gin.SetMode(gin.TestMode)
	entriesHandler := Entries{Entries: entriesRepo}

	// User B tries to hide User A's entry -> 403 Forbidden
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: entry1.ID}}
	c.Set("userID", userB.ID)
	c.Request, _ = http.NewRequest(http.MethodPatch, "/entries/"+entry1.ID+"/visibility", bytes.NewBufferString(`{"is_hidden":true}`))
	c.Request.Header.Set("Content-Type", "application/json")
	entriesHandler.Visibility(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when non-owner updates visibility, got %d", w.Code)
	}

	// User A hides Entry 1 via PATCH endpoint -> 200 OK
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: entry1.ID}}
	c.Set("userID", userA.ID)
	c.Request, _ = http.NewRequest(http.MethodPatch, "/entries/"+entry1.ID+"/visibility", bytes.NewBufferString(`{"is_hidden":true}`))
	c.Request.Header.Set("Content-Type", "application/json")
	entriesHandler.Visibility(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK when owner updates visibility, got %d: %s", w.Code, w.Body.String())
	}

	var updatedEntry models.Entry
	if err := json.Unmarshal(w.Body.Bytes(), &updatedEntry); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !updatedEntry.IsHidden {
		t.Fatalf("expected entry1 to be hidden now")
	}

	// 5. Check non-existent entry -> 404 Not Found
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: "00000000-0000-0000-0000-000000000000"}}
	c.Set("userID", userA.ID)
	c.Request, _ = http.NewRequest(http.MethodPatch, "/entries/00000000-0000-0000-0000-000000000000/visibility", bytes.NewBufferString(`{"is_hidden":true}`))
	c.Request.Header.Set("Content-Type", "application/json")
	entriesHandler.Visibility(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for non-existent entry, got %d", w.Code)
	}
}
