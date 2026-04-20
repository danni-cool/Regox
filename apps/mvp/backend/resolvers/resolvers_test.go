package resolvers_test

import (
	"context"
	"net/http/httptest"
	"testing"

	"regox.dev/mvp/generated"
	"regox.dev/mvp/resolvers"
	"regox.dev/mvp/store"
)

func setupStore() *store.Store {
	s := store.New()
	store.Seed(s)
	return s
}

func TestHomePage(t *testing.T) {
	s := setupStore()
	resolver := resolvers.NewHomePage(s)
	req := httptest.NewRequest("GET", "/", nil)
	data, err := resolver(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	pageData := data.(generated.HomePageData)
	if len(pageData.FeaturedProducts) != 3 {
		t.Fatalf("expected 3 featured products, got %d", len(pageData.FeaturedProducts))
	}
	if len(pageData.LatestNews) != 3 {
		t.Fatalf("expected 3 latest news, got %d", len(pageData.LatestNews))
	}
}

func TestProductsPage(t *testing.T) {
	s := setupStore()
	resolver := resolvers.NewProductList(s)
	req := httptest.NewRequest("GET", "/products", nil)
	data, err := resolver(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	pageData := data.(generated.ProductsPageData)
	if len(pageData.Products) != 10 {
		t.Fatalf("expected 10 products, got %d", len(pageData.Products))
	}
}

func TestProductDetail(t *testing.T) {
	s := setupStore()
	resolver := resolvers.NewProductDetail(s)
	req := httptest.NewRequest("GET", "/products/prod-01", nil)
	req.SetPathValue("id", "prod-01")
	data, err := resolver(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	pageData := data.(generated.ProductDetailPageData)
	if pageData.Product.Id == "" {
		t.Fatal("product ID should not be empty")
	}
	if len(pageData.Reviews) != 2 {
		t.Fatalf("expected 2 reviews in page data, got %d", len(pageData.Reviews))
	}
	if pageData.Reviews[0].Author == "" {
		t.Fatal("review author should not be empty")
	}
}
