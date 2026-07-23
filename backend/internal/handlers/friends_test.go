package handlers

import "testing"

func TestValidUUID(t *testing.T) {
	if !validUUID("550e8400-e29b-41d4-a716-446655440000") {
		t.Fatal("valid UUID rejected")
	}
	if validUUID("not-a-uuid") {
		t.Fatal("invalid UUID accepted")
	}
}
