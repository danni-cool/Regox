package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/a-h/templ"
)

// RenderPage renders a templ component to w, injecting __REGOX_STATE__ and any
// extraHTML before </body>. If data is nil, no state script is injected.
// Returns an error if data is non-nil and the HTML has no </body> tag.
func RenderPage(w http.ResponseWriter, component templ.Component, data any, extraHTML ...string) error {
	var buf bytes.Buffer
	if err := component.Render(context.Background(), &buf); err != nil {
		return fmt.Errorf("render: %w", err)
	}

	html := buf.String()

	inject := strings.Join(extraHTML, "\n")
	if data != nil {
		stateJSON, err := json.Marshal(data)
		if err != nil {
			return fmt.Errorf("marshal state: %w", err)
		}
		if !strings.Contains(html, "</body>") {
			return fmt.Errorf("render: component HTML missing </body> tag — cannot inject __REGOX_STATE__")
		}
		script := fmt.Sprintf(
			`<script id="__REGOX_STATE__" type="application/json">%s</script>`,
			string(stateJSON),
		)
		inject = script + inject
	}

	if inject != "" {
		html = strings.Replace(html, "</body>", inject+"</body>", 1)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, err := io.WriteString(w, html)
	return err
}
