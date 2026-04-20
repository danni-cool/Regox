package store_test

import (
	"testing"

	"regox.dev/mvp/store"
)

func TestSeed(t *testing.T) {
	s := store.New()
	store.Seed(s)

	products := s.ListProducts()
	if len(products) != 10 {
		t.Fatalf("expected 10 products, got %d", len(products))
	}

	reviews := s.ListReviews(products[0].ID)
	if len(reviews) != 2 {
		t.Fatalf("expected 2 reviews per product, got %d", len(reviews))
	}
}

func TestGetProduct(t *testing.T) {
	s := store.New()
	store.Seed(s)
	products := s.ListProducts()
	p, ok := s.GetProduct(products[0].ID)
	if !ok {
		t.Fatal("expected product to exist")
	}
	if p.Name == "" {
		t.Fatal("product name should not be empty")
	}
}

func TestCart(t *testing.T) {
	s := store.New()
	s.AddToCart("sess-1", "prod-1", 2)
	cart, ok := s.GetCart("sess-1")
	if !ok {
		t.Fatal("expected cart to exist")
	}
	if len(cart.Items) != 1 || cart.Items[0].Quantity != 2 {
		t.Fatalf("unexpected cart state: %+v", cart)
	}
}

func TestAddToCartAccumulates(t *testing.T) {
	s := store.New()
	s.AddToCart("sess-1", "prod-1", 2)
	s.AddToCart("sess-1", "prod-1", 3)
	cart, _ := s.GetCart("sess-1")
	if cart.Items[0].Quantity != 5 {
		t.Fatalf("expected quantity 5, got %d", cart.Items[0].Quantity)
	}
}

func TestUpdateCartItem(t *testing.T) {
	s := store.New()
	s.AddToCart("sess-1", "prod-1", 2)
	s.UpdateCartItem("sess-1", "prod-1", 5)
	cart, _ := s.GetCart("sess-1")
	if cart.Items[0].Quantity != 5 {
		t.Fatalf("expected quantity 5, got %d", cart.Items[0].Quantity)
	}
}

func TestRemoveCartItem(t *testing.T) {
	s := store.New()
	s.AddToCart("sess-1", "prod-1", 2)
	s.RemoveCartItem("sess-1", "prod-1")
	cart, _ := s.GetCart("sess-1")
	if len(cart.Items) != 0 {
		t.Fatalf("expected empty cart, got %+v", cart.Items)
	}
}

func TestClearCart(t *testing.T) {
	s := store.New()
	s.AddToCart("sess-1", "prod-1", 2)
	s.ClearCart("sess-1")
	_, ok := s.GetCart("sess-1")
	if ok {
		t.Fatal("expected cart to be cleared")
	}
}

func TestCreateOrder(t *testing.T) {
	s := store.New()
	s.AddToCart("sess-1", "prod-1", 2)
	cart, _ := s.GetCart("sess-1")
	o := s.CreateOrder("order-1", "sess-1", cart.Items, 99.99, "paid")
	if o.ID != "order-1" || o.Status != "paid" {
		t.Fatalf("unexpected order: %+v", o)
	}
}

func TestListNews(t *testing.T) {
	s := store.New()
	store.Seed(s)
	news := s.ListNews()
	if len(news) != 5 {
		t.Fatalf("expected 5 news items, got %d", len(news))
	}
}
