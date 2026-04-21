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

func TestISRCache_InvalidateByPath(t *testing.T) {
	c := server.NewISRCache()
	c.Set("/product/1", []byte("html1"), 300)
	c.Set("/product/2", []byte("html2"), 300)

	c.InvalidateByPath("/product/1")

	if _, hit := c.Get("/product/1"); hit {
		t.Error("expected /product/1 to be evicted")
	}
	if _, hit := c.Get("/product/2"); !hit {
		t.Error("expected /product/2 to remain in cache")
	}
}

func TestISRCache_SetWithTags_InvalidateByTag(t *testing.T) {
	c := server.NewISRCache()
	c.SetWithTags("/product/1", []byte("html1"), 300, []string{"product", "product:1"})
	c.SetWithTags("/product/2", []byte("html2"), 300, []string{"product", "product:2"})
	c.SetWithTags("/news/1", []byte("html3"), 300, []string{"news"})

	c.InvalidateByTag("product")

	if _, hit := c.Get("/product/1"); hit {
		t.Error("expected /product/1 to be evicted by tag 'product'")
	}
	if _, hit := c.Get("/product/2"); hit {
		t.Error("expected /product/2 to be evicted by tag 'product'")
	}
	if _, hit := c.Get("/news/1"); !hit {
		t.Error("expected /news/1 to remain (different tag)")
	}
}

func TestISRCache_InvalidateByTag_Specific(t *testing.T) {
	c := server.NewISRCache()
	c.SetWithTags("/product/1", []byte("html1"), 300, []string{"product:1"})
	c.SetWithTags("/product/2", []byte("html2"), 300, []string{"product:2"})

	c.InvalidateByTag("product:1")

	if _, hit := c.Get("/product/1"); hit {
		t.Error("expected /product/1 to be evicted")
	}
	if _, hit := c.Get("/product/2"); !hit {
		t.Error("expected /product/2 to remain")
	}
}

func TestISRCache_RevalidateWithTags_UpdatesTagIndex(t *testing.T) {
	c := server.NewISRCache()
	c.SetWithTags("/p/1", []byte("v1"), 1, []string{"product:1"})

	done := make(chan struct{})
	c.RevalidateWithTags("/p/1", 60, func() ([]byte, []string, error) {
		defer close(done)
		return []byte("v2"), []string{"product:1"}, nil
	})
	<-done

	html, hit := c.Get("/p/1")
	if !hit {
		t.Fatal("expected cache entry after RevalidateWithTags")
	}
	if string(html) != "v2" {
		t.Errorf("expected v2, got %s", html)
	}
	// Tag index should still point to the entry
	c.InvalidateByTag("product:1")
	if _, hit := c.Get("/p/1"); hit {
		t.Error("expected entry evicted after tag invalidation post-revalidate")
	}
}
