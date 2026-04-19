//go:generate go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen -config oapi-codegen.yaml ../openapi.yaml

package main

import (
	"encoding/json"
	"log"
	"net/http"

	server "regox.dev/server"
)

func main() {
	manifest, err := server.LoadManifest("../frontend/dist/manifest.json")
	if err != nil {
		log.Fatalf("failed to load manifest: %v", err)
	}
	log.Printf("manifest loaded: %d pages", len(manifest.Pages))

	mux := http.NewServeMux()

	// Direct health check — verifies Go server is up and manifest loaded
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Proxied through Vite /api/* — verifies Vite proxy works end-to-end
	mux.HandleFunc("GET /api/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "via": "go"})
	})

	log.Println("regox mvp listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
