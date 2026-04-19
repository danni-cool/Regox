package server_test

import (
	"context"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/a-h/templ"
	server "regox.dev/server"
)

func staticComponent(html string) templ.Component {
	return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		_, err := io.WriteString(w, html)
		return err
	})
}

func TestRenderPage_InjectsState(t *testing.T) {
	w := httptest.NewRecorder()
	comp := staticComponent("<html><body><p>hello</p></body></html>")
	data := map[string]any{"key": "value"}

	if err := server.RenderPage(w, comp, data); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	if !strings.Contains(body, `id="__REGOX_STATE__"`) {
		t.Error("expected __REGOX_STATE__ script tag in output")
	}
	if !strings.Contains(body, `"key":"value"`) {
		t.Error("expected serialized state in script tag")
	}
}

func TestRenderPage_StateBeforeBody(t *testing.T) {
	w := httptest.NewRecorder()
	comp := staticComponent("<html><body><p>hi</p></body></html>")

	if err := server.RenderPage(w, comp, map[string]any{"x": 1}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	body := w.Body.String()
	stateIdx := strings.Index(body, "__REGOX_STATE__")
	bodyIdx := strings.Index(body, "</body>")
	if stateIdx == -1 || bodyIdx == -1 || stateIdx > bodyIdx {
		t.Errorf("expected __REGOX_STATE__ to appear before </body>: stateIdx=%d bodyIdx=%d", stateIdx, bodyIdx)
	}
}

func TestRenderPage_NilData(t *testing.T) {
	w := httptest.NewRecorder()
	comp := staticComponent("<html><body></body></html>")

	if err := server.RenderPage(w, comp, nil); err != nil {
		t.Fatalf("unexpected error with nil data: %v", err)
	}

	body := w.Body.String()
	if strings.Contains(body, "__REGOX_STATE__") {
		t.Error("expected no state tag when data is nil")
	}
}

func TestRenderPage_NoBodyTag_ReturnsError(t *testing.T) {
	w := httptest.NewRecorder()
	comp := staticComponent("<div>no body tag</div>")

	err := server.RenderPage(w, comp, map[string]any{"key": "value"})
	if err == nil {
		t.Error("expected error when HTML has no </body> tag")
	}
}
