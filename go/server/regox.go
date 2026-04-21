package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// Manifest is the build output consumed by the Go server at runtime.
type Manifest struct {
	Pages        map[string]PageEntry `json:"pages"`
	IslandChunks map[string]string    `json:"islandChunks"`
	MainScript   string               `json:"mainScript,omitempty"`
	StyleSheet   string               `json:"styleSheet,omitempty"`
}

// PageEntry describes one page's rendering mode and its Island components.
type PageEntry struct {
	Mode       string   `json:"mode"`                 // ssr | isr | csr | ssg
	Islands    []string `json:"islands"`              // Island component names used on this page
	Revalidate int      `json:"revalidate,omitempty"` // ISR TTL in seconds
}

// State is the server-side data injected into __REGOX_STATE__ for Islands.
type State map[string]any

// LoadManifest reads and parses manifest.json from the given path.
func LoadManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	if m.IslandChunks == nil {
		m.IslandChunks = make(map[string]string)
	}
	return &m, nil
}

// RequestCtx wraps *http.Request, giving resolvers typed access to cookies,
// headers, path values, and middleware-injected context values.
type RequestCtx struct {
	r    *http.Request
	tags []string
}

// NewRequestCtx creates a RequestCtx from a raw *http.Request.
// Called by the router; not intended for direct app use.
func NewRequestCtx(r *http.Request) *RequestCtx { return &RequestCtx{r: r} }

func (c *RequestCtx) Context() context.Context                 { return c.r.Context() }
func (c *RequestCtx) Cookie(name string) (*http.Cookie, error) { return c.r.Cookie(name) }
func (c *RequestCtx) Header(key string) string                 { return c.r.Header.Get(key) }
func (c *RequestCtx) PathValue(name string) string             { return c.r.PathValue(name) }
func (c *RequestCtx) Value(key any) any                        { return c.r.Context().Value(key) }
func (c *RequestCtx) Request() *http.Request                   { return c.r }

// Tag associates the current ISR page with one or more cache invalidation tags.
// Ignored for non-ISR pages.
func (c *RequestCtx) Tag(tags ...string) { c.tags = append(c.tags, tags...) }

// --- Sentinel errors returned by resolvers ---

type redirectErr struct {
	url  string
	code int
}

func (e *redirectErr) Error() string { return fmt.Sprintf("redirect %d → %s", e.code, e.url) }

type statusErr struct{ code int }

func (e *statusErr) Error() string { return fmt.Sprintf("HTTP %d", e.code) }

// Redirect returns an error that causes the router to issue an HTTP redirect.
// Use instead of http.Redirect inside a resolver.
func Redirect(url string, code int) error { return &redirectErr{url, code} }

// NotFound returns an error that causes the router to serve a 404 response.
func NotFound() error { return &statusErr{http.StatusNotFound} }

// Status returns an error that causes the router to respond with the given HTTP status code.
func Status(code int) error { return &statusErr{code} }
