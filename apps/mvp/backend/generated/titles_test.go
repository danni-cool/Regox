package generated_test

import (
	"testing"

	"regox.dev/mvp/generated"
)

func TestProductDetailPageData_Title(t *testing.T) {
	d := generated.ProductDetailPageData{
		Product: generated.Product{Name: "Wireless Headphones"},
	}
	if d.Title() != "Wireless Headphones" {
		t.Errorf("expected Title() = 'Wireless Headphones', got %q", d.Title())
	}
}

func TestNewsDetailPageData_Title(t *testing.T) {
	d := generated.NewsDetailPageData{
		NewsItem: generated.NewsItem{Title: "Big Sale Today"},
	}
	if d.Title() != "Big Sale Today" {
		t.Errorf("expected Title() = 'Big Sale Today', got %q", d.Title())
	}
}
