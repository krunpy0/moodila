package push

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"moodshare/internal/config"
	"moodshare/internal/models"
	"moodshare/internal/repository"

	"golang.org/x/crypto/hkdf"
)

type Service struct {
	repo       repository.PushSubscriptions
	vapidPub   string
	vapidPriv  string
	subscriber string
	privKey    *ecdsa.PrivateKey
	httpClient *http.Client
}


func NewService(cfg config.Config, repo repository.PushSubscriptions) (*Service, error) {
	pub := strings.TrimSpace(cfg.VAPIDPublicKey)
	priv := strings.TrimSpace(cfg.VAPIDPrivateKey)
	sub := strings.TrimSpace(cfg.VAPIDSubscriber)

	if pub == "" || priv == "" {
		generated, err := GenerateVAPIDKeys()
		if err != nil {
			return nil, fmt.Errorf("failed to generate fallback VAPID keys: %w", err)
		}
		pub = generated.PublicKey
		priv = generated.PrivateKey
	}

	parsedPriv, err := ParseVAPIDKeys(pub, priv)
	if err != nil {
		return nil, fmt.Errorf("invalid VAPID keys: %w", err)
	}

	return &Service{
		repo:       repo,
		vapidPub:   pub,
		vapidPriv:  priv,
		subscriber: sub,
		privKey:    parsedPriv,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}, nil
}

func (s *Service) VAPIDPublicKey() string {
	return s.vapidPub
}

func (s *Service) SendToUser(ctx context.Context, userID string, payload models.PushPayload) error {
	subs, err := s.repo.GetByUserID(ctx, userID)
	if err != nil || len(subs) == 0 {
		return err
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	for _, sub := range subs {
		go func(sub models.PushSubscription) {
			sendCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			err := s.sendPushNotification(sendCtx, sub, payloadBytes)
			if err != nil {
				// If push endpoint returned 404 Not Found or 410 Gone, subscription is invalid/expired
				if strings.Contains(err.Error(), "status 404") || strings.Contains(err.Error(), "status 410") {
					_ = s.repo.DeleteByEndpointGlobal(sendCtx, sub.Endpoint)
				}
			}
		}(sub)
	}
	return nil
}

func (s *Service) sendPushNotification(ctx context.Context, sub models.PushSubscription, payload []byte) error {
	reqBody, err := encryptAES128GCM(payload, sub.P256dh, sub.Auth)
	if err != nil {
		return fmt.Errorf("failed to encrypt payload: %w", err)
	}

	parsedURL, err := url.Parse(sub.Endpoint)
	if err != nil {
		return fmt.Errorf("invalid endpoint URL: %w", err)
	}
	origin := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)

	vapidJWT, err := s.createVAPIDToken(origin)
	if err != nil {
		return fmt.Errorf("failed to create VAPID JWT: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.Endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("TTL", "86400")
	req.Header.Set("Authorization", fmt.Sprintf("vapid t=%s, k=%s", vapidJWT, s.vapidPub))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	respBody, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("push service HTTP status %d: %s", resp.StatusCode, string(respBody))
}

func (s *Service) createVAPIDToken(origin string) (string, error) {
	header := `{"alg":"ES256","typ":"JWT"}`
	claims := fmt.Sprintf(`{"aud":%q,"exp":%d,"sub":%q}`, origin, time.Now().Add(12*time.Hour).Unix(), s.subscriber)

	headerB64 := parseBase64URLString([]byte(header))
	claimsB64 := parseBase64URLString([]byte(claims))

	tokenContent := headerB64 + "." + claimsB64

	hash := sha256.Sum256([]byte(tokenContent))
	r, st, err := ecdsa.Sign(rand.Reader, s.privKey, hash[:])
	if err != nil {
		return "", err
	}

	// Format signature as R || S (IEEE P1363: 32 bytes R, 32 bytes S)
	rBytes := r.Bytes()
	sBytes := st.Bytes()

	sigBytes := make([]byte, 64)
	copy(sigBytes[32-len(rBytes):32], rBytes)
	copy(sigBytes[64-len(sBytes):64], sBytes)

	sigB64 := parseBase64URLString(sigBytes)
	return tokenContent + "." + sigB64, nil
}

func parseBase64URLString(data []byte) string {
	return strings.TrimRight(base64URLEncode(data), "=")
}

func base64URLEncode(data []byte) string {
	var buf strings.Builder
	enc := []byte("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
	for i := 0; i < len(data); i += 3 {
		b := uint32(data[i]) << 16
		count := 1
		if i+1 < len(data) {
			b |= uint32(data[i+1]) << 8
			count = 2
		}
		if i+2 < len(data) {
			b |= uint32(data[i+2])
			count = 3
		}
		buf.WriteByte(enc[(b>>18)&63])
		buf.WriteByte(enc[(b>>12)&63])
		if count > 1 {
			buf.WriteByte(enc[(b>>6)&63])
		}
		if count > 2 {
			buf.WriteByte(enc[b&63])
		}
	}
	return buf.String()
}

func encryptAES128GCM(payload []byte, peerP256dhB64, peerAuthB64 string) ([]byte, error) {
	peerP256dh, err := parseBase64URL(peerP256dhB64)
	if err != nil {
		return nil, fmt.Errorf("invalid p256dh: %w", err)
	}
	peerAuth, err := parseBase64URL(peerAuthB64)
	if err != nil {
		return nil, fmt.Errorf("invalid auth: %w", err)
	}

	localKey, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}

	peerKey, err := ecdh.P256().NewPublicKey(peerP256dh)
	if err != nil {
		return nil, fmt.Errorf("invalid peer public key: %w", err)
	}

	sharedSecret, err := localKey.ECDH(peerKey)
	if err != nil {
		return nil, err
	}

	localPubBytes := localKey.PublicKey().Bytes()

	// 1. Derive ikm using HKDF-Extract with peerAuth
	authInfo := append([]byte("WebPush: info\x00"), peerP256dh...)
	authInfo = append(authInfo, localPubBytes...)

	ikmReader := hkdf.New(sha256.New, sharedSecret, peerAuth, authInfo)
	ikm := make([]byte, 32)
	if _, err := io.ReadFull(ikmReader, ikm); err != nil {
		return nil, err
	}

	// 2. Salt (16 random bytes)
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}

	// 3. Derive PRK from ikm and salt
	prkReader := hkdf.New(sha256.New, ikm, salt, []byte("Content-Encoding: aes128gcm\x00"))
	prk := make([]byte, 32)
	if _, err := io.ReadFull(prkReader, prk); err != nil {
		return nil, err
	}

	// 4. Derive CEK (16 bytes) and Nonce (12 bytes)
	cekReader := hkdf.New(sha256.New, prk, nil, []byte("Content-Encoding: aes128gcm\x00"))
	cek := make([]byte, 16)
	if _, err := io.ReadFull(cekReader, cek); err != nil {
		return nil, err
	}

	nonceReader := hkdf.New(sha256.New, prk, nil, []byte("Content-Encoding: nonce\x00"))
	nonce := make([]byte, 12)
	if _, err := io.ReadFull(nonceReader, nonce); err != nil {
		return nil, err
	}

	// 5. Encrypt payload (RFC 8188 record padding: payload + \x02)
	recordPlain := append(payload, 0x02)

	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nil, nonce, recordPlain, nil)

	// Header: salt (16 bytes) || record_size (4 bytes, default 4096 = 0x00001000) || idlen (1 byte = 65) || localPubBytes (65 bytes)
	var buf bytes.Buffer
	buf.Write(salt)

	rs := make([]byte, 4)
	binary.BigEndian.PutUint32(rs, 4096)
	buf.Write(rs)

	buf.WriteByte(byte(len(localPubBytes)))
	buf.Write(localPubBytes)
	buf.Write(ciphertext)

	return buf.Bytes(), nil
}
