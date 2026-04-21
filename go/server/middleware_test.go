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
