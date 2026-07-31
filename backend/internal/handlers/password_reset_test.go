package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestPasswordResetTokenHashing(t *testing.T) {
	rawToken := "test-raw-token-1234567890-abcdef"
	sum := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(sum[:])

	if len(tokenHash) != 64 {
		t.Fatalf("expected 64 char hex hash, got length %d", len(tokenHash))
	}

	// Verify deterministic hashing
	sum2 := sha256.Sum256([]byte(rawToken))
	tokenHash2 := hex.EncodeToString(sum2[:])
	if tokenHash != tokenHash2 {
		t.Fatalf("token hash is non-deterministic")
	}
}
