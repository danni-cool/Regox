package resolvers

import (
	"sort"

	"regox.dev/mvp/generated"
	"regox.dev/mvp/store"
	server "regox.dev/server"
)

func NewProductList(s *store.Store) func(*server.RequestCtx) (any, error) {
	return func(ctx *server.RequestCtx) (any, error) {
		products := s.ListProducts()
		sort.Slice(products, func(i, j int) bool {
			return products[i].ID < products[j].ID
		})
		return generated.ProductsPageData{
			Products: toGenProducts(products),
		}, nil
	}
}
