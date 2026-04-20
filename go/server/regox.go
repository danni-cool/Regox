package server

import (
	"encoding/json"
	"os"
)

// Manifest is the build output consumed by the Go server at runtime.
type Manifest struct {
	Pages        map[string]PageEntry `json:"pages"`
	IslandChunks map[string]string    `json:"islandChunks"`
	MainScript   string               `json:"mainScript,omitempty"`
}

// PageEntry describes one page's rendering mode and its Island components.
type PageEntry struct {
	Mode       string   `json:"mode"`                 // ssr | isr | csr | ssg
	Islands    []string `json:"islands"`              // Island component names used on this page
	Revalidate int      `json:"revalidate,omitempty"` // ISR TTL in seconds
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
	if m.IslandChunks == nil {
		m.IslandChunks = make(map[string]string)
	}
	return &m, nil
}
