package middleware

import (
	"fmt"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type clientEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// Limiter manages rate limiters for individual client keys (e.g. IP or User ID).
type Limiter struct {
	mu       sync.RWMutex
	limiters map[string]*clientEntry
	r        rate.Limit
	burst    int
	ttl      time.Duration
}

// NewLimiter creates a new Limiter and starts a background goroutine to clean up stale entries.
func NewLimiter(r rate.Limit, burst int, ttl time.Duration) *Limiter {
	l := &Limiter{
		limiters: make(map[string]*clientEntry),
		r:        r,
		burst:    burst,
		ttl:      ttl,
	}

	go l.startCleanup()
	return l
}

func (l *Limiter) getLimiter(key string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	entry, exists := l.limiters[key]
	if !exists {
		limiter := rate.NewLimiter(l.r, l.burst)
		l.limiters[key] = &clientEntry{
			limiter:  limiter,
			lastSeen: now,
		}
		return limiter
	}

	entry.lastSeen = now
	return entry.limiter
}

func (l *Limiter) startCleanup() {
	ticker := time.NewTicker(l.ttl / 2)
	for range ticker.C {
		l.mu.Lock()
		now := time.Now()
		for key, entry := range l.limiters {
			if now.Sub(entry.lastSeen) > l.ttl {
				delete(l.limiters, key)
			}
		}
		l.mu.Unlock()
	}
}

// KeyFunc extracts a key from the gin Context to identify a client (e.g. IP or User ID).
type KeyFunc func(c *gin.Context) string

// IPKey returns the client's IP address.
func IPKey(c *gin.Context) string {
	return "ip:" + c.ClientIP()
}

// UserOrIPKey returns the authenticated user ID if present, otherwise client IP.
func UserOrIPKey(c *gin.Context) string {
	userID := c.GetString("userID")
	if userID != "" {
		return "user:" + userID
	}
	return "ip:" + c.ClientIP()
}

// RateLimit returns a Gin middleware that rate limits requests based on keyFunc.
func RateLimit(r rate.Limit, burst int, keyFunc KeyFunc) gin.HandlerFunc {
	limiterManager := NewLimiter(r, burst, 10*time.Minute)

	return func(c *gin.Context) {
		key := keyFunc(c)
		limiter := limiterManager.getLimiter(key)

		now := time.Now()
		res := limiter.ReserveN(now, 1)

		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", burst))

		if !res.OK() {
			c.Header("Retry-After", "60")
			c.Header("X-RateLimit-Remaining", "0")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded, please try again later",
			})
			return
		}

		delay := res.DelayFrom(now)
		if delay > 0 {
			// Limit exceeded, cancel reservation and reject
			res.CancelAt(now)
			retryAfterSec := int(math.Ceil(delay.Seconds()))
			if retryAfterSec < 1 {
				retryAfterSec = 1
			}

			c.Header("Retry-After", fmt.Sprintf("%d", retryAfterSec))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", now.Add(delay).Unix()))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded, please try again later",
			})
			return
		}

		// Allowed request
		tokens := limiter.TokensAt(now)
		remaining := int(tokens)
		if remaining < 0 {
			remaining = 0
		}

		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Next()
	}
}
