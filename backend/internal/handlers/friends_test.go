package handlers

import (
	"strings"
	"testing"
)

func TestValidUUID(t *testing.T) {
	if !validUUID("550e8400-e29b-41d4-a716-446655440000") {
		t.Fatal("valid UUID rejected")
	}
	if validUUID("not-a-uuid") {
		t.Fatal("invalid UUID accepted")
	}
}

func TestCleanSearchQuery(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"   ", ""},
		{"@", ""},
		{"@username", "username"},
		{"  @alex  ", "alex"},
		{"Deleted User", "Deleted User"},
		{"  Some Name With Spaces  ", "Some Name With Spaces"},
		{"привет", "привет"},
		{"@привет_друг", "привет_друг"},
		{strings.Repeat("a", 70), strings.Repeat("a", 60)},
	}

	for _, tt := range tests {
		got := cleanSearchQuery(tt.input)
		if got != tt.expected {
			t.Errorf("cleanSearchQuery(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}
