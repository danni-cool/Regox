package server

import (
	"encoding/json"
	"os"
)

// Manifest is the build output consumed by the Go server at runtime.
type Manifest struct {
	Pages map[string]PageEntry `json:"pages"`
}

// PageEntry describes one page's build artifacts.
type PageEntry struct {
	Template string   `json:"template"` // path to Go template file
	Mode     string   `json:"mode"`     // ssr | isr | csr | ssg
	Bundles  []string `json:"bundles"`  // Island JS bundle paths (CDN or relative)
	Revalidate int    `json:"revalidate,omitempty"` // ISR TTL in seconds
}

// State is the server-side data injected into __REGOX_STATE__ for Islands.
type State map[string]any

// LoadManifest reads and parses manifest.json from the given path.
func LoadManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}
