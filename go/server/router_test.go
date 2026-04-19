package server_test

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/a-h/templ"
	server "regox.dev/server"
)

func makeManifest(pages map[string]server.PageEntry) *server.Manifest {
	return &server.Manifest{Pages: pages, IslandChunks: map[string]string{}}
}

func echoPage(text string) func(context.Context, any) (templ.Component, error) {
	return func(ctx context.Context, data any) (templ.Component, error) {
		return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
			_, err := fmt.Fprintf(w, "<html><body>%s</body></html>", text)
			return err
		}), nil
	}
}

func okResolver(ctx context.Context, r *http.Request) (any, error) {
	return map[string]any{"ok": true}, nil
}

func errorResolver(ctx context.Context, r *http.Request) (any, error) {
	return nil, fmt.Errorf("upstream error")
}

func TestRouter_SSR(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{
		"/hello": {Mode: "ssr"},
	})
	router := server.NewRouter(m)
	router.SSR("/hello", echoPage("hello world"), okResolver)

	req := httptest.NewRequest("GET", "/hello", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "hello world") {
		t.Error("expected page content in body")
	}
	if !strings.Contains(w.Body.String(), "__REGOX_STATE__") {
		t.Error("expected __REGOX_STATE__ in SSR response")
	}
}

func TestRouter_CSR(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{
		"/": {Mode: "csr"},
	})
	router := server.NewRouter(m)
	router.CSR("/", "<html><body>csr shell</body></html>")

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "csr shell") {
		t.Error("expected CSR shell HTML")
	}
}

func TestRouter_NotFound_Default(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{})
	router := server.NewRouter(m)

	req := httptest.NewRequest("GET", "/nonexistent", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestRouter_SSR_ResolverError_Returns500(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{
		"/bad": {Mode: "ssr"},
	})
	router := server.NewRouter(m)
	router.SSR("/bad", echoPage("bad"), errorResolver)

	req := httptest.NewRequest("GET", "/bad", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestRouter_NotFound_Custom(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{})
	router := server.NewRouter(m)
	router.NotFound(echoPage("not found page"), func(ctx context.Context, r *http.Request) (any, error) {
		return nil, nil
	})

	req := httptest.NewRequest("GET", "/missing", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "not found page") {
		t.Error("expected custom not-found page content")
	}
}

func TestRouter_ISR_CacheMiss(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{
		"/shop": {Mode: "isr", Revalidate: 60},
	})
	router := server.NewRouter(m)
	router.ISR("/shop", echoPage("shop content"), okResolver)

	req := httptest.NewRequest("GET", "/shop", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "shop content") {
		t.Error("expected page content in ISR response")
	}
}
