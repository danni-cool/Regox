package resolvers

import (
	"context"
	"net/http"

	"regox.dev/mvp/generated"
)

func ShopPage(ctx context.Context, r *http.Request) (any, error) {
	return generated.ShopPageData{
		Products: []generated.Product{
			{ID: "1", Title: "Widget A", Price: 10.00, InStock: true},
			{ID: "2", Title: "Widget B", Price: 20.00, InStock: false},
		},
	}, nil
}
