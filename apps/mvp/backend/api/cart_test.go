package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"regox.dev/mvp/api"
	"regox.dev/mvp/store"
)

func TestCartGetEmpty(t *testing.T) {
	s := store.New()
	mux := http.NewServeMux()
	api.RegisterCartHandler(mux, s)

	req := httptest.NewRequest("GET", "/cart/items", nil)
	req.AddCookie(&http.Cookie{Name: "regox_session", Value: "sess-1"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var items []any
	json.NewDecoder(w.Body).Decode(&items) //nolint:errcheck
	if len(items) != 0 {
		t.Fatalf("expected empty cart, got %d items", len(items))
	}
}

func TestCartAddItem(t *testing.T) {
	s := store.New()
	store.Seed(s)
	mux := http.NewServeMux()
	api.RegisterCartHandler(mux, s)

	body, _ := json.Marshal(map[string]any{"productID": "prod-01", "quantity": 2})
	req := httptest.NewRequest("POST", "/cart/items", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "regox_session", Value: "sess-2"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 201 {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var items []map[string]any
	json.NewDecoder(w.Body).Decode(&items) //nolint:errcheck
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
}

func TestCartDeleteItem(t *testing.T) {
	s := store.New()
	store.Seed(s)
	s.AddToCart("sess-3", "prod-01", 1)

	mux := http.NewServeMux()
	api.RegisterCartHandler(mux, s)

	req := httptest.NewRequest("DELETE", "/cart/items/prod-01", nil)
	req.SetPathValue("productID", "prod-01")
	req.AddCookie(&http.Cookie{Name: "regox_session", Value: "sess-3"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 204 {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}
