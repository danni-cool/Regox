package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"regox.dev/mvp/api"
	"regox.dev/mvp/store"
)

func TestReviewsHandler(t *testing.T) {
	s := store.New()
	store.Seed(s)

	mux := http.NewServeMux()
	api.RegisterReviewsHandler(mux, s)

	req := httptest.NewRequest("GET", "/products/prod-01/reviews", nil)
	req.SetPathValue("id", "prod-01")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var reviews []map[string]any
	if err := json.NewDecoder(w.Body).Decode(&reviews); err != nil {
		t.Fatal(err)
	}
	if len(reviews) != 2 {
		t.Fatalf("expected 2 reviews, got %d", len(reviews))
	}
}

func TestReviewsHandlerCache(t *testing.T) {
	s := store.New()
	store.Seed(s)

	mux := http.NewServeMux()
	api.RegisterReviewsHandler(mux, s)

	req1 := httptest.NewRequest("GET", "/products/prod-01/reviews", nil)
	req1.SetPathValue("id", "prod-01")
	w1 := httptest.NewRecorder()
	mux.ServeHTTP(w1, req1)

	req2 := httptest.NewRequest("GET", "/products/prod-01/reviews", nil)
	req2.SetPathValue("id", "prod-01")
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, req2)

	if w1.Code != 200 || w2.Code != 200 {
		t.Fatal("expected 200 from both requests")
	}
}
