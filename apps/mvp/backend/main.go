package main

import (
	"log"
	"net/http"

	server "regox.dev/server"
)

func main() {
	manifest, err := server.LoadManifest("../frontend/dist/manifest.json")
	if err != nil {
		log.Fatalf("failed to load manifest: %v", err)
	}
	_ = manifest

	// TODO: wire up router, page resolvers, template engine
	log.Println("regox mvp listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
