//go:generate go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen -config oapi-codegen.yaml ../openapi.yaml

package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/a-h/templ"
	"regox.dev/mvp/templates"
	server "regox.dev/server"
)

func main() {
	manifest, err := server.LoadManifest("../frontend/dist/manifest.json")
	if err != nil {
		log.Fatalf("failed to load manifest: %v", err)
	}
	log.Printf("manifest loaded: %d pages", len(manifest.Pages))

	shell, err := os.ReadFile("../frontend/dist/index.html")
	if err != nil {
		log.Printf("warning: no CSR shell found: %v", err)
		shell = []byte("<html><body><!-- CSR shell not built yet --></body></html>")
	}

	r := server.NewRouter(manifest)
	r.SetLayout(func(title string) templ.Component {
		return templates.Layout(title)
	})

	// Serve built assets (JS, CSS, images) from frontend/dist
	assetsFS := http.FileServer(http.Dir("../frontend/dist/assets"))
	r.Static("/assets/", assetsFS)

	// TODO(Task 8): replace with M5 routes (homepage, /products, /products/{id}, /news, /news/{id}, /cart + API)
	r.CSR("/", string(shell))

	r.NotFound(func(ctx context.Context, data any) (templ.Component, error) {
		return templates.NotFound(), nil
	}, func(ctx context.Context, req *http.Request) (any, error) {
		return nil, nil
	})

	r.Error(func(ctx context.Context, data any) (templ.Component, error) {
		msg, _ := data.(string)
		if msg == "" {
			msg = "Something went wrong."
		}
		return templates.ErrorPage(msg), nil
	}, func(ctx context.Context, req *http.Request, err error) (any, error) {
		return err.Error(), nil
	})

	log.Println("regox mvp listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
