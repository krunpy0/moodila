package backup

import (
	"reflect"
	"testing"
)

func TestSortTablesTopologically_Schema(t *testing.T) {
	t.Run("Moodila Schema Topological Order", func(t *testing.T) {
		tables := []string{
			"account_deletion_tokens",
			"announcement_reads",
			"announcements",
			"comments",
			"entries",
			"friendships",
			"likes",
			"notifications",
			"password_reset_tokens",
			"push_subscriptions",
			"schema_migrations",
			"users",
		}

		deps := map[string][]string{
			"entries":                 {"users"},
			"friendships":             {"users", "users"}, // requester_id, addressee_id
			"likes":                   {"entries", "users"},
			"comments":                {"entries", "users"},
			"notifications":           {"users", "users"}, // user_id, actor_id
			"announcement_reads":      {"announcements", "users"},
			"password_reset_tokens":   {"users"},
			"account_deletion_tokens": {"users"},
			"push_subscriptions":      {"users"},
		}

		sorted := sortTablesTopologically(tables, deps)

		if len(sorted) != len(tables) {
			t.Fatalf("expected %d tables, got %d", len(tables), len(sorted))
		}

		indexOf := make(map[string]int)
		for idx, tbl := range sorted {
			indexOf[tbl] = idx
		}

		// Verify parent tables appear before child tables
		assertions := []struct {
			child  string
			parent string
		}{
			{"entries", "users"},
			{"friendships", "users"},
			{"likes", "users"},
			{"likes", "entries"},
			{"comments", "users"},
			{"comments", "entries"},
			{"notifications", "users"},
			{"announcement_reads", "users"},
			{"announcement_reads", "announcements"},
			{"password_reset_tokens", "users"},
			{"account_deletion_tokens", "users"},
			{"push_subscriptions", "users"},
		}

		for _, a := range assertions {
			if indexOf[a.parent] >= indexOf[a.child] {
				t.Errorf("expected parent '%s' (idx %d) before child '%s' (idx %d)",
					a.parent, indexOf[a.parent], a.child, indexOf[a.child])
			}
		}
	})

	t.Run("Cycle Handling", func(t *testing.T) {
		tables := []string{"table_a", "table_b"}
		deps := map[string][]string{
			"table_a": {"table_b"},
			"table_b": {"table_a"},
		}

		sorted := sortTablesTopologically(tables, deps)
		if len(sorted) != 2 {
			t.Fatalf("expected all tables in output during cycle, got %v", sorted)
		}
	})

	t.Run("Self Dependency", func(t *testing.T) {
		tables := []string{"categories"}
		deps := map[string][]string{
			"categories": {"categories"},
		}

		sorted := sortTablesTopologically(tables, deps)
		expected := []string{"categories"}
		if !reflect.DeepEqual(sorted, expected) {
			t.Fatalf("expected %v, got %v", expected, sorted)
		}
	})
}

func TestFormatSQLValue(t *testing.T) {
	tests := []struct {
		name     string
		input    any
		expected string
	}{
		{
			name:     "nil value",
			input:    nil,
			expected: "NULL",
		},
		{
			name:     "string with single quote",
			input:    "it's cool",
			expected: "'it''s cool'",
		},
		{
			name:     "empty slice of strings",
			input:    []string{},
			expected: "'{}'",
		},
		{
			name:     "slice of strings with single quotes",
			input:    []string{"rock'n'roll", "don't"},
			expected: `'{"rock''n''roll","don''t"}'`,
		},
		{
			name:     "slice of strings with double quotes and backslash",
			input:    []string{`he said "hi"`, `a\b`},
			expected: `'{"he said \"hi\"","a\\b"}'`,
		},
		{
			name:     "slice of interface with single quotes",
			input:    []any{"tag's", 123},
			expected: `'{"tag''s","123"}'`,
		},
		{
			name:     "boolean true and false",
			input:    true,
			expected: "TRUE",
		},
		{
			name:     "integer",
			input:    42,
			expected: "42",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := formatSQLValue(tt.input)
			if actual != tt.expected {
				t.Errorf("formatSQLValue(%#v) = %q, want %q", tt.input, actual, tt.expected)
			}
		})
	}
}
