package resolvers

import (
	"context"
	"net/http"
	"sort"

	"regox.dev/mvp/generated"
	"regox.dev/mvp/store"
)

func NewHomePage(s *store.Store) func(context.Context, *http.Request) (any, error) {
	return func(ctx context.Context, r *http.Request) (any, error) {
		allProducts := s.ListProducts()
		sort.Slice(allProducts, func(i, j int) bool {
			return allProducts[i].ID < allProducts[j].ID
		})
		featured := allProducts
		if len(featured) > 3 {
			featured = featured[:3]
		}

		allNews := s.ListNews()
		sort.Slice(allNews, func(i, j int) bool {
			return allNews[i].PublishedAt.After(allNews[j].PublishedAt)
		})
		latest := allNews
		if len(latest) > 3 {
			latest = latest[:3]
		}

		return generated.HomePageData{
			FeaturedProducts: toGenProducts(featured),
			LatestNews:       toGenNews(latest),
		}, nil
	}
}

func toGenProducts(products []store.Product) []generated.Product {
	out := make([]generated.Product, len(products))
	for i, p := range products {
		out[i] = generated.Product{
			Id:          p.ID,
			Name:        p.Name,
			Price:       float32(p.Price),
			Description: p.Description,
			ImageURL:    p.ImageURL,
			Category:    p.Category,
			Stock:       p.Stock,
		}
	}
	return out
}

func toGenReviews(reviews []store.Review) []generated.Review {
	out := make([]generated.Review, len(reviews))
	for i, r := range reviews {
		out[i] = generated.Review{
			Id:        r.ID,
			ProductID: r.ProductID,
			Author:    r.Author,
			Rating:    r.Rating,
			Body:      r.Body,
			CreatedAt: r.CreatedAt,
		}
	}
	return out
}

func toGenNews(news []store.NewsItem) []generated.NewsItem {
	out := make([]generated.NewsItem, len(news))
	for i, n := range news {
		out[i] = generated.NewsItem{
			Id:          n.ID,
			Title:       n.Title,
			Summary:     n.Summary,
			Body:        n.Body,
			PublishedAt: n.PublishedAt,
		}
	}
	return out
}
