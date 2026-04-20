package api

import (
	"encoding/json"
	"net/http"

	"regox.dev/mvp/store"
)

const sessionCookieName = "regox_session"

func getSessionID(r *http.Request) string {
	c, err := r.Cookie(sessionCookieName)
	if err != nil || c.Value == "" {
		return ""
	}
	return c.Value
}

func ensureSession(w http.ResponseWriter, r *http.Request) string {
	id := getSessionID(r)
	if id != "" {
		return id
	}
	// simple deterministic session: use remote addr as demo-quality session ID
	id = r.RemoteAddr
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	return id
}

func RegisterCartHandler(mux *http.ServeMux, s *store.Store) {
	mux.HandleFunc("GET /cart/items", func(w http.ResponseWriter, r *http.Request) {
		sessionID := ensureSession(w, r)
		cart, _ := s.GetCart(sessionID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cart.Items) //nolint:errcheck
	})

	mux.HandleFunc("POST /cart/items", func(w http.ResponseWriter, r *http.Request) {
		sessionID := ensureSession(w, r)
		var body struct {
			ProductID string `json:"productID"`
			Quantity  int    `json:"quantity"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ProductID == "" || body.Quantity <= 0 {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		s.AddToCart(sessionID, body.ProductID, body.Quantity)
		cart, _ := s.GetCart(sessionID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(cart.Items) //nolint:errcheck
	})

	mux.HandleFunc("PUT /cart/items/{productID}", func(w http.ResponseWriter, r *http.Request) {
		sessionID := ensureSession(w, r)
		productID := r.PathValue("productID")
		var body struct {
			Quantity int `json:"quantity"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Quantity < 0 {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		if body.Quantity == 0 {
			s.RemoveCartItem(sessionID, productID)
		} else {
			s.UpdateCartItem(sessionID, productID, body.Quantity)
		}
		cart, _ := s.GetCart(sessionID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cart.Items) //nolint:errcheck
	})

	mux.HandleFunc("DELETE /cart/items/{productID}", func(w http.ResponseWriter, r *http.Request) {
		sessionID := ensureSession(w, r)
		productID := r.PathValue("productID")
		s.RemoveCartItem(sessionID, productID)
		w.WriteHeader(http.StatusNoContent)
	})
}
