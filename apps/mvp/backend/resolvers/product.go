package resolvers

import (
	"context"
	"fmt"
	"net/http"

	"regox.dev/mvp/generated"
)

func ProductPage(ctx context.Context, r *http.Request) (any, error) {
	id := r.PathValue("id")
	if id == "" {
		return nil, fmt.Errorf("missing product id")
	}
	return generated.ProductPageData{
		Product: generated.Product{
			ID:      id,
			Title:   "Product " + id,
			Price:   99.00,
			InStock: true,
		},
	}, nil
}
