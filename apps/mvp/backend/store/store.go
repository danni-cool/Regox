package store

import (
	"sync"
	"time"
)

type Product struct {
	ID          string
	Name        string
	Price       float64
	Description string
	ImageURL    string
	Category    string
	Stock       int
}

type Review struct {
	ID        string
	ProductID string
	Author    string
	Rating    int
	Body      string
	CreatedAt time.Time
}

type NewsItem struct {
	ID          string
	Title       string
	Summary     string
	Body        string
	PublishedAt time.Time
}

type CartItem struct {
	ProductID string
	Quantity  int
}

type Cart struct {
	SessionID string
	Items     []CartItem
	UpdatedAt time.Time
}

type Order struct {
	ID        string
	SessionID string
	Items     []CartItem
	Total     float64
	Status    string // pending | paid | failed
}

type Store struct {
	mu       sync.RWMutex
	products map[string]Product
	reviews  map[string][]Review // key: productID
	news     map[string]NewsItem
	carts    map[string]Cart  // key: sessionID
	orders   map[string]Order
}

func New() *Store {
	return &Store{
		products: make(map[string]Product),
		reviews:  make(map[string][]Review),
		news:     make(map[string]NewsItem),
		carts:    make(map[string]Cart),
		orders:   make(map[string]Order),
	}
}

func (s *Store) ListProducts() []Product {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Product, 0, len(s.products))
	for _, p := range s.products {
		out = append(out, p)
	}
	return out
}

func (s *Store) GetProduct(id string) (Product, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.products[id]
	return p, ok
}

func (s *Store) AddProduct(p Product) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.products[p.ID] = p
}

func (s *Store) ListReviews(productID string) []Review {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.reviews[productID]
}

func (s *Store) AddReview(r Review) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reviews[r.ProductID] = append(s.reviews[r.ProductID], r)
}

func (s *Store) ListNews() []NewsItem {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]NewsItem, 0, len(s.news))
	for _, n := range s.news {
		out = append(out, n)
	}
	return out
}

func (s *Store) GetNews(id string) (NewsItem, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n, ok := s.news[id]
	return n, ok
}

func (s *Store) AddNews(n NewsItem) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.news[n.ID] = n
}

func (s *Store) GetCart(sessionID string) (Cart, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.carts[sessionID]
	return c, ok
}

func (s *Store) AddToCart(sessionID, productID string, quantity int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cart := s.carts[sessionID]
	cart.SessionID = sessionID
	for i, item := range cart.Items {
		if item.ProductID == productID {
			cart.Items[i].Quantity += quantity
			cart.UpdatedAt = time.Now()
			s.carts[sessionID] = cart
			return
		}
	}
	cart.Items = append(cart.Items, CartItem{ProductID: productID, Quantity: quantity})
	cart.UpdatedAt = time.Now()
	s.carts[sessionID] = cart
}

func (s *Store) UpdateCartItem(sessionID, productID string, quantity int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cart := s.carts[sessionID]
	for i, item := range cart.Items {
		if item.ProductID == productID {
			if quantity <= 0 {
				cart.Items = append(cart.Items[:i], cart.Items[i+1:]...)
			} else {
				cart.Items[i].Quantity = quantity
			}
			cart.UpdatedAt = time.Now()
			s.carts[sessionID] = cart
			return
		}
	}
}

func (s *Store) RemoveCartItem(sessionID, productID string) {
	s.UpdateCartItem(sessionID, productID, 0)
}

func (s *Store) ClearCart(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.carts, sessionID)
}

func (s *Store) CreateOrder(id, sessionID string, items []CartItem, total float64, status string) Order {
	s.mu.Lock()
	defer s.mu.Unlock()
	o := Order{ID: id, SessionID: sessionID, Items: items, Total: total, Status: status}
	s.orders[id] = o
	return o
}
