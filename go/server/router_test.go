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

func okResolver(ctx *server.RequestCtx) (any, error) {
	return map[string]any{"ok": true}, nil
}

func errorResolver(ctx *server.RequestCtx) (any, error) {
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
	router.NotFound(echoPage("not found page"), func(ctx *server.RequestCtx) (any, error) {
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

// titledData implements server.Titler to provide a dynamic page title.
type titledData struct{ name string }

func (d titledData) Title() string { return d.name }

func titledResolver(ctx *server.RequestCtx) (any, error) {
	return titledData{name: "Widget Pro"}, nil
}

func layoutWithTitle(title string) templ.Component {
	return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		inner := templ.GetChildren(ctx)
		fmt.Fprintf(w, "<html><head><title>%s</title></head><body>", title)
		if inner != nil {
			inner.Render(ctx, w) //nolint:errcheck
		}
		fmt.Fprintf(w, "</body></html>")
		return nil
	})
}

func TestRouter_SSR_InjectsMainScript(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/p": {Mode: "ssr"}})
	m.MainScript = "/assets/index-TEST.js"
	router := server.NewRouter(m)
	router.SSR("/p", echoPage("hello"), okResolver)

	req := httptest.NewRequest("GET", "/p", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body := w.Body.String()
	if !strings.Contains(body, `src="/assets/index-TEST.js"`) {
		t.Errorf("expected main script tag in SSR response, got: %s", body)
	}
}

func TestRouter_SSR_TitlerInterface_InjectsTitle(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/product": {Mode: "ssr"}})
	router := server.NewRouter(m)
	router.SetLayout(layoutWithTitle)
	router.SSR("/product", echoPage("product body"), titledResolver)

	req := httptest.NewRequest("GET", "/product", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body := w.Body.String()
	if !strings.Contains(body, "<title>Widget Pro</title>") {
		t.Errorf("expected <title>Widget Pro</title> in response, got: %s", body)
	}
}

func TestManifestRouteToGoPattern(t *testing.T) {
	cases := []struct {
		in  string
		out string
	}{
		{"/", "/"},
		{"/cart", "/cart"},
		{"/products/[id]", "/products/{id}"},
		{"/news/[slug]/comments/[cid]", "/news/{slug}/comments/{cid}"},
	}
	for _, c := range cases {
		got := server.ManifestRouteToGoPattern(c.in)
		if got != c.out {
			t.Errorf("ManifestRouteToGoPattern(%q) = %q, want %q", c.in, got, c.out)
		}
	}
}

func TestRouter_AutoRegisterCSR_RegistersCSRPages(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{
		"/cart":     {Mode: "csr"},
		"/products": {Mode: "isr"},
		"/":         {Mode: "ssr"},
	})
	router := server.NewRouter(m)
	router.SetLayout(layoutWithTitle)

	if err := router.AutoRegisterCSR(); err != nil {
		t.Fatalf("AutoRegisterCSR: %v", err)
	}

	// CSR route registered → 200
	req := httptest.NewRequest("GET", "/cart", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for CSR /cart, got %d", w.Code)
	}
	// ISR/SSR routes not auto-registered → 404
	req2 := httptest.NewRequest("GET", "/products", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusNotFound {
		t.Errorf("expected 404 for unregistered /products, got %d", w2.Code)
	}
}

func TestRouter_AutoRegisterCSR_ConvertsParamSyntax(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{
		"/users/[id]": {Mode: "csr"},
	})
	router := server.NewRouter(m)
	router.SetLayout(layoutWithTitle)

	if err := router.AutoRegisterCSR(); err != nil {
		t.Fatalf("AutoRegisterCSR: %v", err)
	}

	req := httptest.NewRequest("GET", "/users/42", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for /users/42, got %d", w.Code)
	}
}

func TestRouter_AutoRegisterCSR_ErrorWithoutLayout(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/cart": {Mode: "csr"}})
	router := server.NewRouter(m)

	if err := router.AutoRegisterCSR(); err == nil {
		t.Error("expected error when layout not set")
	}
}

func TestRouter_AutoRegisterCSR_ShellContainsMainScript(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{"/app": {Mode: "csr"}})
	m.MainScript = "/assets/index-TEST.js"
	router := server.NewRouter(m)
	router.SetLayout(layoutWithTitle)

	if err := router.AutoRegisterCSR(); err != nil {
		t.Fatalf("AutoRegisterCSR: %v", err)
	}

	req := httptest.NewRequest("GET", "/app", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if !strings.Contains(w.Body.String(), "/assets/index-TEST.js") {
		t.Error("expected main script in CSR shell")
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

func TestRouter_ISR_TagsStoredOnCacheMiss(t *testing.T) {
	m := makeManifest(map[string]server.PageEntry{
		"/shop": {Mode: "isr", Revalidate: 60},
	})
	router := server.NewRouter(m)
	router.ISR("/shop", echoPage("shop"), func(ctx *server.RequestCtx) (any, error) {
		ctx.Tag("shop", "shop:featured")
		return map[string]any{"ok": true}, nil
	})

	// First request: cache miss, page renders and tags are stored
	req := httptest.NewRequest("GET", "/shop", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on first request, got %d", w.Code)
	}

	// Invalidate by tag
	router.Revalidate(server.ByTag("shop"))

	// Second request: cache miss again (entry was evicted), page re-renders
	req2 := httptest.NewRequest("GET", "/shop", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Errorf("expected 200 after revalidation, got %d", w2.Code)
	}
	if !strings.Contains(w2.Body.String(), "shop") {
		t.Error("expected page content after cache eviction")
	}
}
