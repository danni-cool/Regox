package server

import (
	"log"
	"sync"
	"time"
)

type ISRCache struct {
	store        sync.Map // key: string → *cacheEntry
	revalidating sync.Map // key: string → struct{} (lock flag)
	tagIndex     sync.Map // tag → *sync.Map (path → struct{})
	pathTags     sync.Map // path → []string
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

// SetWithTags stores HTML with TTL and associates the entry with cache invalidation tags.
func (c *ISRCache) SetWithTags(key string, html []byte, ttlSeconds int, tags []string) {
	c.Set(key, html, ttlSeconds)
	if len(tags) == 0 {
		return
	}
	c.pathTags.Store(key, tags)
	for _, tag := range tags {
		actual, _ := c.tagIndex.LoadOrStore(tag, &sync.Map{})
		actual.(*sync.Map).Store(key, struct{}{})
	}
}

// InvalidateByPath evicts specific paths from the cache and cleans up their tag index entries.
func (c *ISRCache) InvalidateByPath(paths ...string) {
	for _, p := range paths {
		c.store.Delete(p)
		if tags, ok := c.pathTags.LoadAndDelete(p); ok {
			for _, tag := range tags.([]string) {
				if idx, ok := c.tagIndex.Load(tag); ok {
					idx.(*sync.Map).Delete(p)
				}
			}
		}
	}
}

// InvalidateByTag evicts all paths associated with any of the given tags.
func (c *ISRCache) InvalidateByTag(tags ...string) {
	for _, tag := range tags {
		idx, ok := c.tagIndex.Load(tag)
		if !ok {
			continue
		}
		idx.(*sync.Map).Range(func(path, _ any) bool {
			c.InvalidateByPath(path.(string))
			return true
		})
		c.tagIndex.Delete(tag)
	}
}

// RevalidateWithTags is like Revalidate but fn also returns tags to update the index.
func (c *ISRCache) RevalidateWithTags(key string, ttlSeconds int, fn func() ([]byte, []string, error)) {
	if _, loaded := c.revalidating.LoadOrStore(key, struct{}{}); loaded {
		return
	}
	go func() {
		defer c.revalidating.Delete(key)
		html, tags, err := fn()
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
		c.SetWithTags(key, html, ttlSeconds, tags)
	}()
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
