package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"regox.dev/mvp/store"
)

func RegisterOrdersHandler(mux *http.ServeMux, s *store.Store) {
	mux.HandleFunc("POST /orders", func(w http.ResponseWriter, r *http.Request) {
		sessionID := ensureSession(w, r)
		cart, ok := s.GetCart(sessionID)
		if !ok || len(cart.Items) == 0 {
			http.Error(w, "cart is empty", http.StatusBadRequest)
			return
		}

		var total float64
		for _, item := range cart.Items {
			p, found := s.GetProduct(item.ProductID)
			if found {
				total += p.Price * float64(item.Quantity)
			}
		}

		orderID := fmt.Sprintf("order-%d", time.Now().UnixMilli())
		order := s.CreateOrder(orderID, sessionID, cart.Items, total, "paid")
		s.ClearCart(sessionID)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{ //nolint:errcheck
			"orderId": order.ID,
			"total":   order.Total,
			"status":  order.Status,
		})
	})
}

func RegisterProductsAPIHandler(mux *http.ServeMux, s *store.Store) {
	mux.HandleFunc("GET /products", func(w http.ResponseWriter, r *http.Request) {
		products := s.ListProducts()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(products) //nolint:errcheck
	})

	mux.HandleFunc("GET /products/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		p, ok := s.GetProduct(id)
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(p) //nolint:errcheck
	})
}

func RegisterNewsAPIHandler(mux *http.ServeMux, s *store.Store) {
	mux.HandleFunc("GET /news", func(w http.ResponseWriter, r *http.Request) {
		news := s.ListNews()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(news) //nolint:errcheck
	})
}
