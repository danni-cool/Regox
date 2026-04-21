package resolvers

import (
	"fmt"

	"regox.dev/mvp/generated"
	"regox.dev/mvp/store"
	server "regox.dev/server"
)

func NewProductDetail(s *store.Store) func(*server.RequestCtx) (any, error) {
	return func(ctx *server.RequestCtx) (any, error) {
		id := ctx.PathValue("id")
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
