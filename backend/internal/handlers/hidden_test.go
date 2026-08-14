package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		t.Skipf("DB connection failed: %v — skipping test", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool, nil); err != nil {
		t.Fatalf("migrate: %v", err)
	}


	usersRepo := repository.Users{Pool: pool}
	entriesRepo := repository.Entries{Pool: pool}
	friendsRepo := repository.Friends{Pool: pool}
	feedRepo := repository.Feed{Pool: pool}

	// Create test user A and user B
	ts := time.Now().UnixNano()
	userA, err := usersRepo.Create(ctx, fmt.Sprintf("usera_%d@test.com", ts), fmt.Sprintf("usera_%d", ts%1000000), "User A", "pass")
	if err != nil {
		t.Fatalf("create user A: %v", err)
	}
	defer pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userA.ID)

	userB, err := usersRepo.Create(ctx, fmt.Sprintf("userb_%d@test.com", ts), fmt.Sprintf("userb_%d", ts%1000000), "User B", "pass")
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
	date3 := "2026-07-03"
	date4 := "2026-07-04"
	isFalse := false
	isTrue := true

	// User A creates Entry 1 (public, is_hidden=false)
	entry1, _, err := entriesRepo.Save(ctx, userA.ID, date1, 4, []string{"Calm"}, "Public note", nil, nil, nil, &isFalse, nil)
	if err != nil {
		t.Fatalf("save entry 1: %v", err)
	}

	// User A creates Entry 2 (hidden, is_hidden=true)
	entry2, _, err := entriesRepo.Save(ctx, userA.ID, date2, 5, []string{"Secret"}, "Hidden note", nil, nil, nil, &isTrue, nil)
	if err != nil {
		t.Fatalf("save entry 2: %v", err)
	}

	// 1. Friend B views User A's calendar -> should see Entry 1, but NOT Entry 2
	friendEntries, err := entriesRepo.VisibleByMonth(ctx, userA.ID, userB.ID, "2026-07", "2026-08")
	if err != nil {
		t.Fatalf("VisibleByMonth: %v", err)
	}
	if len(friendEntries) != 1 || friendEntries[0].Date != date1 {
		t.Fatalf("expected only public entry1 for friend, got %#v", friendEntries)
	}

	// 2. Friend B views Feed (includeSelf = false) -> should see Entry 1, but NOT Entry 2
	feedList, _, err := feedRepo.List(ctx, userB.ID, 10, "", false)
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

	// 2b. User A views Feed with includeSelf = true -> should see User A's entries
	feedListA, _, err := feedRepo.List(ctx, userA.ID, 10, "", true)
	if err != nil {
		t.Fatalf("Feed.List for owner with includeSelf=true: %v", err)
	}
	var aSeesEntry1 bool
	for _, fe := range feedListA {
		if fe.ID == entry1.ID {
			aSeesEntry1 = true
		}
	}
	if !aSeesEntry1 {
		t.Fatalf("user A should see own entry1 in feed when includeSelf=true")
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

	// Unhide entry1 for subsequent tests
	_, _ = entriesRepo.UpdateVisibility(ctx, userA.ID, entry1.ID, false)

	// Create User C (friend of A)
	userC, err := usersRepo.Create(ctx, fmt.Sprintf("userc_%d@test.com", ts), fmt.Sprintf("userc_%d", (ts+1)%1000000), "User C", "pass")
	if err != nil {
		t.Fatalf("create user C: %v", err)
	}
	defer pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userC.ID)


	reqC, err := friendsRepo.Request(ctx, userA.ID, userC.ID)
	if err != nil {
		t.Fatalf("friend request C: %v", err)
	}
	if _, err := friendsRepo.Respond(ctx, reqC.ID, userC.ID, "accepted"); err != nil {
		t.Fatalf("accept friend C: %v", err)
	}

	// 5. Account-level default test:
	// User A sets friend B default to hide_by_default = true
	friendsHandler := Friends{Friends: friendsRepo, Entries: entriesRepo}
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Params = []gin.Param{{Key: "id", Value: userB.ID}}
	c.Set("userID", userA.ID)
	c.Request, _ = http.NewRequest(http.MethodPatch, "/friends/"+userB.ID+"/visibility-default", bytes.NewBufferString(`{"hide_by_default":true}`))
	c.Request.Header.Set("Content-Type", "application/json")
	friendsHandler.SetVisibilityDefault(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 when setting visibility default, got %d: %s", w.Code, w.Body.String())
	}

	// Verify defaults via GET /friends/visibility-defaults
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Set("userID", userA.ID)
	c.Request, _ = http.NewRequest(http.MethodGet, "/friends/visibility-defaults", nil)
	friendsHandler.GetVisibilityDefaults(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 from GetVisibilityDefaults, got %d: %s", w.Code, w.Body.String())
	}
	var defaults []models.FriendVisibilityDefault
	if err := json.Unmarshal(w.Body.Bytes(), &defaults); err != nil {
		t.Fatalf("unmarshal defaults: %v", err)
	}
	var bHiddenByDefault, cHiddenByDefault bool
	for _, d := range defaults {
		if d.ID == userB.ID {
			bHiddenByDefault = d.HideByDefault
		}
		if d.ID == userC.ID {
			cHiddenByDefault = d.HideByDefault
		}
	}
	if !bHiddenByDefault || cHiddenByDefault {
		t.Fatalf("expected B hidden by default (true) and C visible (false), got B=%v, C=%v", bHiddenByDefault, cHiddenByDefault)
	}

	// User A creates Entry 3 (no overrides) -> B should NOT see it, C SHOULD see it
	_, _, err = entriesRepo.Save(ctx, userA.ID, date3, 3, []string{"Work"}, "Entry 3 default", nil, nil, nil, &isFalse, nil)
	if err != nil {
		t.Fatalf("save entry 3: %v", err)
	}

	// Check B visibility for entry 3
	bEntries, err := entriesRepo.VisibleByMonth(ctx, userA.ID, userB.ID, "2026-07", "2026-08")
	if err != nil {
		t.Fatalf("VisibleByMonth for B: %v", err)
	}
	for _, e := range bEntries {
		if e.Date == date3 {
			t.Fatalf("Friend B should NOT see entry 3 due to account-level hide_by_default")
		}
	}

	// Check C visibility for entry 3
	cEntries, err := entriesRepo.VisibleByMonth(ctx, userA.ID, userC.ID, "2026-07", "2026-08")
	if err != nil {
		t.Fatalf("VisibleByMonth for C: %v", err)
	}
	var cSees3 bool
	for _, e := range cEntries {
		if e.Date == date3 {
			cSees3 = true
		}
	}
	if !cSees3 {
		t.Fatalf("Friend C SHOULD see entry 3 (default visible)")
	}

	// 6. Post-level override test:
	// User A creates Entry 4 with override: Friend B is explicitly visible (is_hidden = false), Friend C is hidden (is_hidden = true)
	_, _, err = entriesRepo.Save(ctx, userA.ID, date4, 5, []string{"Special"}, "Entry 4 overrides", nil, nil, nil, &isFalse, []models.EntryFriendOverride{
		{FriendID: userB.ID, IsHidden: false},
		{FriendID: userC.ID, IsHidden: true},
	})
	if err != nil {
		t.Fatalf("save entry 4: %v", err)
	}

	// B should see entry 4 (override unhides)
	bEntries4, err := entriesRepo.VisibleByMonth(ctx, userA.ID, userB.ID, "2026-07", "2026-08")
	if err != nil {
		t.Fatalf("VisibleByMonth for B: %v", err)
	}
	var bSees4 bool
	for _, e := range bEntries4 {
		if e.Date == date4 {
			bSees4 = true
		}
	}
	if !bSees4 {
		t.Fatalf("Friend B SHOULD see entry 4 due to explicit is_hidden=false override")
	}

	// C should NOT see entry 4 (override hides)
	cEntries4, err := entriesRepo.VisibleByMonth(ctx, userA.ID, userC.ID, "2026-07", "2026-08")
	if err != nil {
		t.Fatalf("VisibleByMonth for C: %v", err)
	}
	for _, e := range cEntries4 {
		if e.Date == date4 {
			t.Fatalf("Friend C should NOT see entry 4 due to explicit is_hidden=true override")
		}
	}

	// 7. Check HasCustomVisibility badge in ByMonth for author
	authorEntries, err := entriesRepo.ByMonth(ctx, userA.ID, "2026-07", "2026-08")
	if err != nil {
		t.Fatalf("ByMonth for author: %v", err)
	}
	for _, e := range authorEntries {
		if e.Date == date4 && !e.HasCustomVisibility {
			t.Fatalf("entry 4 should have has_custom_visibility = true for author")
		}
		if e.Date == date3 && e.HasCustomVisibility {
			t.Fatalf("entry 3 should have has_custom_visibility = false for author")
		}
	}

	// 8. Test validation in Entries.Save HTTP handler:
	// 8a. Duplicate friend_id in overrides -> 400 Bad Request
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Set("userID", userA.ID)
	c.Request, _ = http.NewRequest(http.MethodPost, "/entries", bytes.NewBufferString(`{
		"date": "2026-07-05",
		"mood": 4,
		"friend_overrides": [
			{"friend_id": "`+userB.ID+`", "is_hidden": true},
			{"friend_id": "`+userB.ID+`", "is_hidden": false}
		]
	}`))
	c.Request.Header.Set("Content-Type", "application/json")
	entriesHandler.Save(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for duplicate friend override, got %d: %s", w.Code, w.Body.String())
	}

	// 8b. Non-friend in overrides -> 400 Bad Request
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Set("userID", userA.ID)
	c.Request, _ = http.NewRequest(http.MethodPost, "/entries", bytes.NewBufferString(`{
		"date": "2026-07-05",
		"mood": 4,
		"friend_overrides": [
			{"friend_id": "00000000-0000-0000-0000-000000000001", "is_hidden": true}
		]
	}`))
	c.Request.Header.Set("Content-Type", "application/json")
	entriesHandler.Save(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for non-friend in overrides, got %d: %s", w.Code, w.Body.String())
	}

	// 9. Check unfriend cleans up visibility rows
	friendshipID := req.ID
	err = friendsRepo.Delete(ctx, userA.ID, friendshipID)
	if err != nil {
		t.Fatalf("unfriend A and B: %v", err)
	}

	var countDefaults, countOverrides int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM user_friend_visibility WHERE user_id = $1 AND friend_id = $2", userA.ID, userB.ID).Scan(&countDefaults)
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM entry_friend_visibility WHERE friend_id = $1", userB.ID).Scan(&countOverrides)
	if countDefaults != 0 || countOverrides != 0 {
		t.Fatalf("expected 0 visibility rows after unfriend, got defaults=%d, overrides=%d", countDefaults, countOverrides)
	}
}

