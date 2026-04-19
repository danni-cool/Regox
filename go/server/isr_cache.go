package server

import (
	"log"
	"sync"
	"time"
)

type ISRCache struct {
	store        sync.Map // key: string → *cacheEntry
	revalidating sync.Map // key: string → struct{} (lock flag)
}

type cacheEntry struct {
	html      []byte
	expiresAt time.Time
}

func NewISRCache() *ISRCache {
	return &ISRCache{}
}

// Get returns cached HTML if present (even if stale).
func (c *ISRCache) Get(key string) ([]byte, bool) {
	v, ok := c.store.Load(key)
	if !ok {
		return nil, false
	}
	return v.(*cacheEntry).html, true
}

// IsStale returns true if the entry exists but TTL has expired.
func (c *ISRCache) IsStale(key string) bool {
	v, ok := c.store.Load(key)
	if !ok {
		return false
	}
	return time.Now().After(v.(*cacheEntry).expiresAt)
}

// Set stores HTML with the given TTL in seconds.
func (c *ISRCache) Set(key string, html []byte, ttlSeconds int) {
	c.store.Store(key, &cacheEntry{
		html:      html,
		expiresAt: time.Now().Add(time.Duration(ttlSeconds) * time.Second),
	})
}

// Revalidate runs fn in a background goroutine if no revalidation is already in progress.
// On failure, the existing entry's TTL is extended by ttlSeconds to prevent thundering herd.
func (c *ISRCache) Revalidate(key string, ttlSeconds int, fn func() ([]byte, error)) {
	if _, loaded := c.revalidating.LoadOrStore(key, struct{}{}); loaded {
		return // already revalidating
	}
	go func() {
		defer c.revalidating.Delete(key)
		html, err := fn()
		if err != nil {
			log.Printf("[regox] ISR revalidation failed for %s: %v — extending stale entry", key, err)
			if v, ok := c.store.Load(key); ok {
				entry := v.(*cacheEntry)
				c.store.Store(key, &cacheEntry{
					html:      entry.html,
					expiresAt: time.Now().Add(time.Duration(ttlSeconds) * time.Second),
				})
			}
			return
		}
		c.Set(key, html, ttlSeconds)
	}()
}
