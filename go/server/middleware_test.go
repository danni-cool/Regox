package server_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	server "regox.dev/server"
)

func TestRequestCtx_Header(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Foo", "bar")
	ctx := server.NewRequestCtx(req)
	if got := ctx.Header("X-Foo"); got != "bar" {
		t.Errorf("Header: got %q, want %q", got, "bar")
	}
}

func TestRequestCtx_Cookie(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "tok123"})
	ctx := server.NewRequestCtx(req)
	c, err := ctx.Cookie("session")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.Value != "tok123" {
		t.Errorf("Cookie: got %q, want %q", c.Value, "tok123")
	}
}

func TestRequestCtx_PathValue(t *testing.T) {
	req := httptest.NewRequest("GET", "/products/42", nil)
	ctx := server.NewRequestCtx(req)
	_ = ctx.PathValue("id") // no panic is the goal; empty string outside mux is fine
}

func TestRequestCtx_Context(t *testing.T) {
	type key struct{}
	req := httptest.NewRequest("GET", "/", nil)
	req = req.WithContext(context.WithValue(req.Context(), key{}, "hello"))
	ctx := server.NewRequestCtx(req)
	if got := ctx.Context().Value(key{}); got != "hello" {
		t.Errorf("Context().Value: got %v, want hello", got)
	}
}

func TestRedirect_IsError(t *testing.T) {
	err := server.Redirect("/login", 302)
	if err == nil {
		t.Fatal("Redirect() should return non-nil error")
	}
}

func TestNotFound_IsError(t *testing.T) {
	if server.NotFound() == nil {
		t.Fatal("NotFound() should return non-nil error")
	}
}

func TestStatus_IsError(t *testing.T) {
	if server.Status(403) == nil {
		t.Fatal("Status() should return non-nil error")
	}
}

func TestRouter_Resolver_Redirect(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/login-required": {Mode: "ssr"}})
	r := server.NewRouter(m)
	r.SSR("/login-required", echoPage("secret"), func(ctx *server.RequestCtx) (any, error) {
		return nil, server.Redirect("/login", http.StatusFound)
	})

	req := httptest.NewRequest("GET", "/login-required", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("expected 302, got %d", w.Code)
	}
	if loc := w.Header().Get("Location"); loc != "/login" {
		t.Errorf("expected Location: /login, got %q", loc)
	}
}

func TestRouter_Resolver_NotFound(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/item": {Mode: "ssr"}})
	r := server.NewRouter(m)
	r.SSR("/item", echoPage("item"), func(ctx *server.RequestCtx) (any, error) {
		return nil, server.NotFound()
	})

	req := httptest.NewRequest("GET", "/item", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestRouter_Resolver_CustomStatus(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/private": {Mode: "ssr"}})
	r := server.NewRouter(m)
	r.SSR("/private", echoPage("private"), func(ctx *server.RequestCtx) (any, error) {
		return nil, server.Status(http.StatusForbidden)
	})

	req := httptest.NewRequest("GET", "/private", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestRequestCtx_Tag_Accumulates(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	ctx := server.NewRequestCtx(req)
	ctx.Tag("product", "product:123")
	tags := ctx.Tags()
	if len(tags) != 2 {
		t.Fatalf("Tags: got %d tags, want 2", len(tags))
	}
	if tags[0] != "product" || tags[1] != "product:123" {
		t.Errorf("Tags: got %v, want [product product:123]", tags)
	}
}

