//go:generate go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen -config oapi-codegen.yaml ../openapi.yaml

package main

import (
	"context"
	"log"
	"net/http"

	"github.com/a-h/templ"
	"regox.dev/mvp/api"
	"regox.dev/mvp/generated"
	"regox.dev/mvp/regoxroutes"
	"regox.dev/mvp/resolvers"
	"regox.dev/mvp/store"
	"regox.dev/mvp/templates"
	server "regox.dev/server"
)


// appResolvers implements regoxroutes.PageResolvers.
type appResolvers struct{ store *store.Store }

func (a *appResolvers) HomePage(ctx *server.RequestCtx) (any, error) {
	return resolvers.NewHomePage(a.store)(ctx)
}
func (a *appResolvers) ProductsPage(ctx *server.RequestCtx) (any, error) {
	return resolvers.NewProductList(a.store)(ctx)
}
func (a *appResolvers) ProductDetailPage(ctx *server.RequestCtx) (any, error) {
	return resolvers.NewProductDetail(a.store)(ctx)
}

func main() {
	s := store.New()
	store.Seed(s)
	log.Printf("store seeded: %d products", len(s.ListProducts()))

	manifest, err := server.LoadManifest("../frontend/dist/manifest.json")
	if err != nil {
		log.Fatalf("failed to load manifest: %v", err)
	}
	log.Printf("manifest loaded: %d pages", len(manifest.Pages))

	r := server.NewRouter(manifest)
	r.SetLayout(func(title string) templ.Component {
		return templates.Layout(title, manifest.StyleSheet)
	})

	assetsFS := http.FileServer(http.Dir("../frontend/dist/assets"))
	r.Static("/assets/", assetsFS)

	// API sub-mux (StripPrefix removes /api so handlers use bare paths)
	apiMux := http.NewServeMux()
	api.RegisterReviewsHandler(apiMux, s)
	api.RegisterCartHandler(apiMux, s)
	api.RegisterOrdersHandler(apiMux, s)
	api.RegisterProductsAPIHandler(apiMux, s)
	api.RegisterNewsAPIHandler(apiMux, s)
	r.Mount("/api/", apiMux)

	// All React-backed pages auto-registered from generated route table.
	// CSR → static HTML shell; SSR/ISR → appResolvers provides data.
	if err := regoxroutes.RegisterRoutes(r, &appResolvers{store: s}); err != nil {
		log.Fatalf("failed to register routes: %v", err)
	}

	// Go-only pages (no React page file) — registered manually.
	r.ISR("/news", func(ctx context.Context, data any) (templ.Component, error) {
		d := data.(generated.NewsPageData)
		return templates.NewsListPage(d), nil
	}, resolvers.NewNewsList(s))

	r.ISR("/news/{id}", func(ctx context.Context, data any) (templ.Component, error) {
		d := data.(generated.NewsDetailPageData)
		return templates.NewsDetailPage(d), nil
	}, resolvers.NewNewsDetail(s))

	r.NotFound(func(ctx context.Context, data any) (templ.Component, error) {
		return templates.NotFound(), nil
	}, func(ctx *server.RequestCtx) (any, error) {
		return nil, nil
	})

	r.Error(func(ctx context.Context, data any) (templ.Component, error) {
		msg, _ := data.(string)
		if msg == "" {
			msg = "Something went wrong."
		}
		return templates.ErrorPage(msg), nil
	}, func(ctx *server.RequestCtx, err error) (any, error) {
		return err.Error(), nil
	})

	log.Println("regox mvp listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
