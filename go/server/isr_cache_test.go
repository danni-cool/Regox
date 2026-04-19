package server_test

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	server "regox.dev/server"
)

func TestISRCache_Miss(t *testing.T) {
	c := server.NewISRCache()
	_, ok := c.Get("/shop")
	if ok {
		t.Error("expected cache miss on empty cache")
	}
}

func TestISRCache_HitBeforeTTL(t *testing.T) {
	c := server.NewISRCache()
	c.Set("/shop", []byte("<html>shop</html>"), 10)

	html, ok := c.Get("/shop")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if string(html) != "<html>shop</html>" {
		t.Errorf("unexpected html: %s", html)
	}
}

func TestISRCache_StaleAfterTTL(t *testing.T) {
	c := server.NewISRCache()
	c.Set("/shop", []byte("<html>old</html>"), 0) // TTL=0 → expires immediately

	time.Sleep(10 * time.Millisecond)
	html, ok := c.Get("/shop")
	// stale-while-revalidate: still returns stale HTML
	if !ok {
		t.Fatal("expected stale cache entry to still be returned")
	}
	if string(html) != "<html>old</html>" {
		t.Errorf("unexpected html: %s", html)
	}
}

func TestISRCache_IsStale(t *testing.T) {
	c := server.NewISRCache()
	c.Set("/shop", []byte("<html>old</html>"), 0)
	time.Sleep(10 * time.Millisecond)

	if !c.IsStale("/shop") {
		t.Error("expected entry to be stale after TTL")
	}
}

func TestISRCache_RevalidateLock(t *testing.T) {
	c := server.NewISRCache()
	c.Set("/shop", []byte("<html>old</html>"), 0)
	time.Sleep(10 * time.Millisecond)

	var calls atomic.Int32
	revalidate := func() ([]byte, error) {
		time.Sleep(20 * time.Millisecond)
		calls.Add(1)
		return []byte("<html>new</html>"), nil
	}

	// Fire two concurrent revalidations — only one should actually run
	go c.Revalidate("/shop", 10, revalidate)
	go c.Revalidate("/shop", 10, revalidate)
	time.Sleep(100 * time.Millisecond)

	if calls.Load() != 1 {
		t.Errorf("expected exactly 1 revalidation call, got %d", calls.Load())
	}
}

func TestISRCache_RevalidateFailureExtendsEntry(t *testing.T) {
	c := server.NewISRCache()
	c.Set("/shop", []byte("<html>old</html>"), 0)
	time.Sleep(10 * time.Millisecond)

	revalidate := func() ([]byte, error) {
		return nil, fmt.Errorf("upstream down")
	}
	c.Revalidate("/shop", 10, revalidate)
	time.Sleep(50 * time.Millisecond)

	// Stale entry should still be there
	html, ok := c.Get("/shop")
	if !ok || string(html) != "<html>old</html>" {
		t.Error("expected stale entry to be retained after revalidation failure")
	}
}
