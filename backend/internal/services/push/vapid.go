package push

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"strings"
)

type KeyPair struct {
	PublicKey  string
	PrivateKey string
}

func GenerateVAPIDKeys() (*KeyPair, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	pubBytes := elliptic.Marshal(elliptic.P256(), key.X, key.Y)
	privBytes := key.D.Bytes()
	if len(privBytes) < 32 {
		padded := make([]byte, 32)
		copy(padded[32-len(privBytes):], privBytes)
		privBytes = padded
	}

	return &KeyPair{
		PublicKey:  base64.RawURLEncoding.EncodeToString(pubBytes),
		PrivateKey: base64.RawURLEncoding.EncodeToString(privBytes),
	}, nil
}

func parseBase64URL(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	if dec, err := base64.RawURLEncoding.DecodeString(s); err == nil {
		return dec, nil
	}
	if dec, err := base64.URLEncoding.DecodeString(s); err == nil {
		return dec, nil
	}
	if dec, err := base64.StdEncoding.DecodeString(s); err == nil {
		return dec, nil
	}
	return base64.RawStdEncoding.DecodeString(s)
}

func ParseVAPIDKeys(pubKeyB64, privKeyB64 string) (*ecdsa.PrivateKey, error) {
	pubBytes, err := parseBase64URL(pubKeyB64)
	if err != nil {
		return nil, fmt.Errorf("invalid public key base64: %w", err)
	}
	privBytes, err := parseBase64URL(privKeyB64)
	if err != nil {
		return nil, fmt.Errorf("invalid private key base64: %w", err)
	}

	x, y := elliptic.Unmarshal(elliptic.P256(), pubBytes)
	if x == nil || y == nil {
		return nil, errors.New("invalid P256 public key point")
	}

	d := new(big.Int).SetBytes(privBytes)

	privKey := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: elliptic.P256(),
			X:     x,
			Y:     y,
		},
		D: d,
	}
	return privKey, nil
}
