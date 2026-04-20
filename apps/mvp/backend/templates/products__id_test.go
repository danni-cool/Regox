package templates_test

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"regox.dev/mvp/generated"
	"regox.dev/mvp/templates"
)

func TestProductDetailPageRendersReviews(t *testing.T) {
	data := generated.ProductDetailPageData{
		Product: generated.Product{
			Id:          "prod-01",
			Name:        "Test Product",
			Price:       9.99,
			Description: "A test product",
			ImageURL:    "https://example.com/img.jpg",
			Category:    "Electronics",
			Stock:       5,
		},
		Reviews: []generated.Review{
			{
				Id:        "rev-01",
				Author:    "Alice",
				Rating:    5,
				Body:      "Excellent product!",
				CreatedAt: time.Now(),
			},
		},
	}

	var buf bytes.Buffer
	err := templates.ProductDetailPage(data).Render(context.Background(), &buf)
	if err != nil {
		t.Fatal(err)
	}
	html := buf.String()

	if !strings.Contains(html, "Alice") {
		t.Error("expected review author 'Alice' in rendered HTML")
	}
	if !strings.Contains(html, "Excellent product!") {
		t.Error("expected review body in rendered HTML")
	}
}

func TestProductDetailPageTitleContainsProductName(t *testing.T) {
	data := generated.ProductDetailPageData{
		Product: generated.Product{
			Id:    "prod-01",
			Name:  "My Fancy Widget",
			Price: 9.99,
			Stock: 1,
		},
		Reviews: []generated.Review{},
	}

	var buf bytes.Buffer
	err := templates.ProductDetailPage(data).Render(context.Background(), &buf)
	if err != nil {
		t.Fatal(err)
	}
	// The component itself doesn't set <title> — that's Layout's job.
	// But the h1 must contain the product name for SEO crawler visibility.
	html := buf.String()
	if !strings.Contains(html, "My Fancy Widget") {
		t.Error("expected product name in rendered HTML h1")
	}
}
