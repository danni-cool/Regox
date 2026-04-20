package resolvers

import (
	"context"
	"fmt"
	"net/http"

	"regox.dev/mvp/generated"
	"regox.dev/mvp/store"
)

func NewProductDetail(s *store.Store) func(context.Context, *http.Request) (any, error) {
	return func(ctx context.Context, r *http.Request) (any, error) {
		id := r.PathValue("id")
		if id == "" {
			return nil, fmt.Errorf("missing product id")
		}
		p, ok := s.GetProduct(id)
		if !ok {
			return nil, fmt.Errorf("product not found: %s", id)
		}
		return generated.ProductDetailPageData{
			Product: generated.Product{
				Id:          p.ID,
				Name:        p.Name,
				Price:       float32(p.Price),
				Description: p.Description,
				ImageURL:    p.ImageURL,
				Category:    p.Category,
				Stock:       p.Stock,
			},
			Reviews: toGenReviews(s.ListReviews(id)),
		}, nil
	}
}
