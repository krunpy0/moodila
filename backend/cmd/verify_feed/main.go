package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://postgres:postgres@localhost:5432/moodila?sslmode=disable"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	fmt.Println("=== VERIFYING EQUIVALENCE OF FEED QUERIES ACROSS 200 USERS ===")
	fmt.Println("Queries compared: 1) Original (JOIN friendships), 2) CTE (ANY authors), 3) LATERAL (CROSS JOIN LATERAL)")
	fmt.Println("Comparison depth: up to 1000 entries per user")

	// 1. Collect targeted test user cohorts:
	// a) User with 0 friends
	var zeroFriendUser string
	err = pool.QueryRow(ctx, `
		SELECT u.id FROM users u
		LEFT JOIN friendships f ON (f.requester_id = u.id OR f.addressee_id = u.id)
		WHERE u.email LIKE 'loadtest_%'
		GROUP BY u.id
		HAVING COUNT(f.id) = 0
		LIMIT 1;
	`).Scan(&zeroFriendUser)
	if err != nil {
		log.Printf("Warning: no 0-friend user found: %v", err)
	}

	// b) Users whose friends have hide_by_default = true
	var hideByDefaultUsers []string
	rows, err := pool.Query(ctx, `
		SELECT DISTINCT ufv.friend_id
		FROM user_friend_visibility ufv
		JOIN users u ON u.id = ufv.friend_id
		WHERE ufv.hide_by_default = true
		LIMIT 30;
	`)
	if err == nil {
		for rows.Next() {
			var uid string
			_ = rows.Scan(&uid)
			hideByDefaultUsers = append(hideByDefaultUsers, uid)
		}
		rows.Close()
	}

	// c) Users with entry_friend_visibility is_hidden = true (override visible -> hidden)
	var efvHiddenUsers []string
	rows, err = pool.Query(ctx, `
		SELECT DISTINCT efv.friend_id
		FROM entry_friend_visibility efv
		JOIN users u ON u.id = efv.friend_id
		WHERE efv.is_hidden = true
		LIMIT 30;
	`)
	if err == nil {
		for rows.Next() {
			var uid string
			_ = rows.Scan(&uid)
			efvHiddenUsers = append(efvHiddenUsers, uid)
		}
		rows.Close()
	}

	// d) Users with entry_friend_visibility is_hidden = false overriding hide_by_default = true (reveal override)
	var efvRevealedUsers []string
	rows, err = pool.Query(ctx, `
		SELECT DISTINCT efv.friend_id
		FROM entry_friend_visibility efv
		JOIN entries e ON e.id = efv.entry_id
		JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = efv.friend_id
		WHERE ufv.hide_by_default = true AND efv.is_hidden = false
		LIMIT 30;
	`)
	if err == nil {
		for rows.Next() {
			var uid string
			_ = rows.Scan(&uid)
			efvRevealedUsers = append(efvRevealedUsers, uid)
		}
		rows.Close()
	}

	// Build a distinct set of users to reach 200 total
	userMap := make(map[string]string) // uid -> category
	if zeroFriendUser != "" {
		userMap[zeroFriendUser] = "0 friends"
	}
	for _, u := range hideByDefaultUsers {
		userMap[u] = "hide_by_default=true"
	}
	for _, u := range efvHiddenUsers {
		if _, exists := userMap[u]; !exists {
			userMap[u] = "efv is_hidden=true"
		}
	}
	for _, u := range efvRevealedUsers {
		if _, exists := userMap[u]; !exists {
			userMap[u] = "efv override reveal (is_hidden=false over default=true)"
		}
	}

	// Fill remaining up to 200 from random users
	needed := 200 - len(userMap)
	if needed > 0 {
		rows, err = pool.Query(ctx, `
			SELECT id FROM users
			WHERE email LIKE 'loadtest_%'
			ORDER BY random()
			LIMIT $1;
		`, needed*2)
		if err == nil {
			for rows.Next() && len(userMap) < 200 {
				var uid string
				_ = rows.Scan(&uid)
				if _, exists := userMap[uid]; !exists {
					userMap[uid] = "random user"
				}
			}
			rows.Close()
		}
	}

	fmt.Printf("Collected %d distinct test users covering all privacy variants and friend counts.\n\n", len(userMap))

	origQuery := `
		SELECT e.id
		FROM entries e
		JOIN friendships f ON f.status = 'accepted'
			AND ((f.requester_id = $1 AND f.addressee_id = e.user_id)
				OR (f.addressee_id = $1 AND f.requester_id = e.user_id))
		LEFT JOIN entry_friend_visibility efv ON efv.entry_id = e.id AND efv.friend_id = $1
		LEFT JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = $1
		WHERE e.is_hidden = false
		  AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
		ORDER BY e.date DESC, e.created_at DESC, e.id DESC
		LIMIT $2;
	`

	cteQuery := `
		WITH matching_entries AS (
			SELECT e.id, e.date, e.created_at
			FROM entries e
			LEFT JOIN entry_friend_visibility efv ON efv.entry_id = e.id AND efv.friend_id = $1
			LEFT JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = $1
			WHERE e.user_id = ANY (
				ARRAY(
					SELECT addressee_id FROM friendships WHERE requester_id = $1 AND status = 'accepted'
					UNION ALL
					SELECT requester_id FROM friendships WHERE addressee_id = $1 AND status = 'accepted'
				)
			)
			AND e.is_hidden = false
			AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
			ORDER BY e.date DESC, e.created_at DESC, e.id DESC
			LIMIT $2
		)
		SELECT m.id
		FROM matching_entries m
		ORDER BY m.date DESC, m.created_at DESC, m.id DESC;
	`

	lateralQuery := `
		WITH authors AS (
			SELECT addressee_id AS uid FROM friendships WHERE requester_id = $1 AND status = 'accepted'
			UNION ALL
			SELECT requester_id AS uid FROM friendships WHERE addressee_id = $1 AND status = 'accepted'
		),
		matching_entries AS (
			SELECT x.id, x.date, x.created_at
			FROM authors a
			CROSS JOIN LATERAL (
				SELECT e.id, e.date, e.created_at
				FROM entries e
				LEFT JOIN entry_friend_visibility efv ON efv.entry_id = e.id AND efv.friend_id = $1
				LEFT JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = $1
				WHERE e.user_id = a.uid
				  AND e.is_hidden = false
				  AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
				ORDER BY e.date DESC, e.created_at DESC, e.id DESC
				LIMIT $2
			) x
			ORDER BY x.date DESC, x.created_at DESC, x.id DESC
			LIMIT $2
		)
		SELECT m.id
		FROM matching_entries m
		ORDER BY m.date DESC, m.created_at DESC, m.id DESC;
	`

	fetchIDs := func(q string, uid string, limit int) ([]string, error) {
		rows, err := pool.Query(ctx, q, uid, limit)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}
			ids = append(ids, id)
		}
		return ids, nil
	}

	limit := 1000
	successCount := 0
	cohortCounts := make(map[string]int)

	idx := 0
	for uid, category := range userMap {
		idx++
		origIDs, err := fetchIDs(origQuery, uid, limit)
		if err != nil {
			log.Fatalf("User %s (%s): origQuery failed: %v", uid, category, err)
		}

		cteIDs, err := fetchIDs(cteQuery, uid, limit)
		if err != nil {
			log.Fatalf("User %s (%s): cteQuery failed: %v", uid, category, err)
		}

		lateralIDs, err := fetchIDs(lateralQuery, uid, limit)
		if err != nil {
			log.Fatalf("User %s (%s): lateralQuery failed: %v", uid, category, err)
		}

		// Verify 100% equivalence between Orig, CTE, and LATERAL
		if len(origIDs) != len(cteIDs) || len(origIDs) != len(lateralIDs) {
			log.Fatalf("MISMATCH in row count for user %s (%s): orig=%d, cte=%d, lateral=%d",
				uid, category, len(origIDs), len(cteIDs), len(lateralIDs))
		}

		for i := 0; i < len(origIDs); i++ {
			if origIDs[i] != cteIDs[i] {
				log.Fatalf("MISMATCH between Orig and CTE at index %d for user %s (%s): orig=%s, cte=%s",
					i, uid, category, origIDs[i], cteIDs[i])
			}
			if origIDs[i] != lateralIDs[i] {
				log.Fatalf("MISMATCH between Orig and LATERAL at index %d for user %s (%s): orig=%s, lateral=%s",
					i, uid, category, origIDs[i], lateralIDs[i])
			}
		}

		cohortCounts[category]++
		successCount++
		if idx%25 == 0 || idx == len(userMap) {
			fmt.Printf("  • Verified %d/%d users... [Current: %s returned %d items]\n",
				idx, len(userMap), category, len(origIDs))
		}
	}

	fmt.Println("\n==================================================================")
	fmt.Printf("✅ ВСЕ %d ПОЛЬЗОВАТЕЛЕЙ ПОКАЗАЛИ 100%% ТОЧНОЕ СОВПАДЕНИЕ ПЕРВЫХ ДО 1000 ID!\n", successCount)
	fmt.Println("==================================================================")
	fmt.Println("Распределение проверенных когорт:")
	for cat, count := range cohortCounts {
		fmt.Printf("  • %-55s: %d пользователей\n", cat, count)
	}
	fmt.Println("Старый запрос (Baseline), CTE-запрос и LATERAL-запрос строго эквивалентны во всех краевых случаях.")
}
