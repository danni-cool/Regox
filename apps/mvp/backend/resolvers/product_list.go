package resolvers

import (
	"context"
	"net/http"
	"sort"

	"regox.dev/mvp/generated"
	"regox.dev/mvp/store"
)

func NewProductList(s *store.Store) func(context.Context, *http.Request) (any, error) {
	return func(ctx context.Context, r *http.Request) (any, error) {
		products := s.ListProducts()
		sort.Slice(products, func(i, j int) bool {
			return products[i].ID < products[j].ID
		})
		return generated.ProductsPageData{
			Products: toGenProducts(products),
		}, nil
	}
}
