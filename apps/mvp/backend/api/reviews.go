package api

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"regox.dev/mvp/store"
)

type reviewsCache struct {
	mu    sync.RWMutex
	items map[string]reviewsCacheEntry
}

type reviewsCacheEntry struct {
	reviews []store.Review
	expiry  time.Time
}

var globalReviewsCache = &reviewsCache{items: make(map[string]reviewsCacheEntry)}

func (c *reviewsCache) get(productID string) ([]store.Review, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.items[productID]
	if !ok || time.Now().After(entry.expiry) {
		return nil, false
	}
	return entry.reviews, true
}

func (c *reviewsCache) set(productID string, reviews []store.Review, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[productID] = reviewsCacheEntry{reviews: reviews, expiry: time.Now().Add(ttl)}
}

func RegisterReviewsHandler(mux *http.ServeMux, s *store.Store) {
	mux.HandleFunc("GET /products/{id}/reviews", func(w http.ResponseWriter, r *http.Request) {
		productID := r.PathValue("id")
		reviews, ok := globalReviewsCache.get(productID)
		if !ok {
			reviews = s.ListReviews(productID)
			globalReviewsCache.set(productID, reviews, 120*time.Second)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(reviews) //nolint:errcheck
	})
}
