package server_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	server "regox.dev/server"
)

// These tests will compile once Task 3 changes ResolverFunc to func(*RequestCtx) (any, error).

func TestRouter_Middleware_RunsBeforeHandler(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/guarded": {Mode: "ssr"}})
	r := server.NewRouter(m)

	var order []string
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			order = append(order, "mw1")
			next.ServeHTTP(w, req)
		})
	})
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			order = append(order, "mw2")
			next.ServeHTTP(w, req)
		})
	})
	r.SSR("/guarded", echoPage("ok"), func(ctx *server.RequestCtx) (any, error) {
		order = append(order, "resolver")
		return nil, nil
	})

	req := httptest.NewRequest("GET", "/guarded", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	want := []string{"mw1", "mw2", "resolver"}
	for i, s := range want {
		if i >= len(order) || order[i] != s {
			t.Errorf("middleware order: got %v, want %v", order, want)
			break
		}
	}
}

func TestRouter_Middleware_CanRedirect(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/private": {Mode: "ssr"}})
	r := server.NewRouter(m)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			http.Redirect(w, req, "/login", http.StatusFound)
		})
	})
	r.SSR("/private", echoPage("secret"), func(ctx *server.RequestCtx) (any, error) {
		return nil, nil
	})

	req := httptest.NewRequest("GET", "/private", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("expected 302, got %d", w.Code)
	}
}
