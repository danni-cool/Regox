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

func TestCreateOrderEmptyCart(t *testing.T) {
	s := store.New()
	mux := http.NewServeMux()
	api.RegisterOrdersHandler(mux, s)
	api.RegisterCartHandler(mux, s)

	req := httptest.NewRequest("POST", "/orders", nil)
	req.AddCookie(&http.Cookie{Name: "regox_session", Value: "sess-order-1"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Fatalf("expected 400 for empty cart, got %d", w.Code)
	}
}

func TestCreateOrderSuccess(t *testing.T) {
	s := store.New()
	store.Seed(s)
	s.AddToCart("sess-order-2", "prod-01", 1)

	mux := http.NewServeMux()
	api.RegisterOrdersHandler(mux, s)
	api.RegisterCartHandler(mux, s)

	req := httptest.NewRequest("POST", "/orders", bytes.NewReader(nil))
	req.AddCookie(&http.Cookie{Name: "regox_session", Value: "sess-order-2"})
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 201 {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var result map[string]any
	json.NewDecoder(w.Body).Decode(&result) //nolint:errcheck
	if result["status"] != "paid" {
		t.Fatalf("expected status paid, got %v", result["status"])
	}

	// Cart should be cleared after order
	cart, _ := s.GetCart("sess-order-2")
	if len(cart.Items) != 0 {
		t.Fatal("cart should be empty after order")
	}
}
