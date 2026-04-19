package server_test

import (
	"os"
	"path/filepath"
	"testing"

	server "regox.dev/server"
)

func TestLoadManifest_CSR(t *testing.T) {
	dir := t.TempDir()
	content := `{
		"pages": {
			"/": { "mode": "csr", "islands": [] }
		},
		"islandChunks": {}
	}`
	path := filepath.Join(dir, "manifest.json")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test manifest: %v", err)
	}

	m, err := server.LoadManifest(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	page, ok := m.Pages["/"]
	if !ok {
		t.Fatal("expected page '/' in manifest")
	}
	if page.Mode != "csr" {
		t.Errorf("expected mode=csr, got %s", page.Mode)
	}
	if len(page.Islands) != 0 {
		t.Errorf("expected empty islands, got %v", page.Islands)
	}
	if m.IslandChunks == nil {
		t.Error("expected IslandChunks map, got nil")
	}
}

func TestLoadManifest_ISR(t *testing.T) {
	dir := t.TempDir()
	content := `{
		"pages": {
			"/product/[id]": { "mode": "isr", "revalidate": 300, "islands": ["CartButton"] }
		},
		"islandChunks": {
			"CartButton": "/assets/CartButton.js"
		}
	}`
	path := filepath.Join(dir, "manifest.json")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test manifest: %v", err)
	}

	m, err := server.LoadManifest(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	page := m.Pages["/product/[id]"]
	if page.Mode != "isr" {
		t.Errorf("expected mode=isr, got %s", page.Mode)
	}
	if page.Revalidate != 300 {
		t.Errorf("expected revalidate=300, got %d", page.Revalidate)
	}
	if len(page.Islands) != 1 || page.Islands[0] != "CartButton" {
		t.Errorf("expected islands=[CartButton], got %v", page.Islands)
	}
	if m.IslandChunks["CartButton"] != "/assets/CartButton.js" {
		t.Errorf("expected islandChunks[CartButton]=/assets/CartButton.js, got %s", m.IslandChunks["CartButton"])
	}
}

func TestLoadManifest_FileNotFound(t *testing.T) {
	_, err := server.LoadManifest("/nonexistent/path/manifest.json")
	if err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
}
