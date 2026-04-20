package server

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/a-h/templ"
)

type PageFunc func(context.Context, any) (templ.Component, error)
type ResolverFunc func(context.Context, *http.Request) (any, error)
type ErrorResolverFunc func(context.Context, *http.Request, error) (any, error)

type Router struct {
	mux          *http.ServeMux
	manifest     *Manifest
	isr          *ISRCache
	layout       func(title string) templ.Component
	notFoundPage PageFunc
	notFoundRes  ResolverFunc
	errorPage    PageFunc
	errorRes     ErrorResolverFunc
}

func NewRouter(manifest *Manifest) *Router {
	return &Router{
		mux:      http.NewServeMux(),
		manifest: manifest,
		isr:      NewISRCache(),
	}
}

func (r *Router) SetLayout(fn func(title string) templ.Component) {
	r.layout = fn
}

func (r *Router) SSR(pattern string, page PageFunc, resolver ResolverFunc) {
	r.mux.HandleFunc(pattern, func(w http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		data, err := resolver(ctx, req)
		if err != nil {
			r.serveError(w, req, err)
			return
		}
		comp, err := page(ctx, data)
		if err != nil {
			r.serveError(w, req, err)
			return
		}
		if r.layout != nil {
			comp = r.wrapLayout("", comp)
		}
		if err := RenderPage(w, comp, data); err != nil {
			log.Printf("[regox] render error: %v", err)
		}
	})
}

func (r *Router) ISR(pattern string, page PageFunc, resolver ResolverFunc) {
	ttl := 0
	if entry, ok := r.manifest.Pages[pattern]; ok {
		ttl = entry.Revalidate
	}
	r.mux.HandleFunc(pattern, func(w http.ResponseWriter, req *http.Request) {
		key := req.URL.Path
		html, hit := r.isr.Get(key)
		if hit && !r.isr.IsStale(key) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(html) //nolint:errcheck
			return
		}
		if hit && r.isr.IsStale(key) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(html) //nolint:errcheck
			r.isr.Revalidate(key, ttl, func() ([]byte, error) {
				return r.renderToBytes(req.Context(), page, resolver, req)
			})
			return
		}
		// Cache miss: render synchronously
		html, err := r.renderToBytes(req.Context(), page, resolver, req)
		if err != nil {
			r.serveError(w, req, err)
			return
		}
		r.isr.Set(key, html, ttl)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(html) //nolint:errcheck
	})
}

func (r *Router) Static(prefix string, handler http.Handler) {
	r.mux.Handle(prefix, http.StripPrefix(prefix, handler))
}

func (r *Router) CSR(pattern string, shell string) {
	r.mux.HandleFunc(pattern, func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		io.WriteString(w, shell) //nolint:errcheck
	})
}

func (r *Router) NotFound(page PageFunc, resolver ResolverFunc) {
	r.notFoundPage = page
	r.notFoundRes = resolver
}

func (r *Router) Error(page PageFunc, resolver ErrorResolverFunc) {
	r.errorPage = page
	r.errorRes = resolver
}

func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// Note: Go ServeMux sets path values (e.g. {id}) inside mux.ServeHTTP, not
	// in the handler returned by mux.Handler. We use Handler only to check for a
	// match, then delegate to mux.ServeHTTP so path values are properly set.
	_, pattern := r.mux.Handler(req)
	if pattern == "" {
		r.serveNotFound(w, req)
		return
	}
	r.mux.ServeHTTP(w, req)
}

func (r *Router) serveNotFound(w http.ResponseWriter, req *http.Request) {
	w.WriteHeader(http.StatusNotFound)
	if r.notFoundPage == nil {
		fmt.Fprint(w, "404 not found")
		return
	}
	data, err := r.notFoundRes(req.Context(), req)
	if err != nil {
		data = nil
	}
	comp, err := r.notFoundPage(req.Context(), data)
	if err != nil {
		fmt.Fprint(w, "404 not found")
		return
	}
	RenderPage(w, comp, data) //nolint:errcheck
}

func (r *Router) serveError(w http.ResponseWriter, req *http.Request, origErr error) {
	log.Printf("[regox] error serving %s: %v", req.URL.Path, origErr)
	w.WriteHeader(http.StatusInternalServerError)
	if r.errorPage == nil {
		fmt.Fprint(w, "500 internal server error")
		return
	}
	var data any
	if r.errorRes != nil {
		data, _ = r.errorRes(req.Context(), req, origErr)
	}
	comp, err := r.errorPage(req.Context(), data)
	if err != nil {
		fmt.Fprint(w, "500 internal server error")
		return
	}
	RenderPage(w, comp, data) //nolint:errcheck
}

func (r *Router) renderToBytes(ctx context.Context, page PageFunc, resolver ResolverFunc, req *http.Request) ([]byte, error) {
	data, err := resolver(ctx, req)
	if err != nil {
		return nil, err
	}
	comp, err := page(ctx, data)
	if err != nil {
		return nil, err
	}
	if r.layout != nil {
		comp = r.wrapLayout("", comp)
	}
	var buf bytes.Buffer
	if err := comp.Render(ctx, &buf); err != nil {
		return nil, fmt.Errorf("render: %w", err)
	}
	return buf.Bytes(), nil
}

func (r *Router) wrapLayout(title string, inner templ.Component) templ.Component {
	layoutComp := r.layout(title)
	return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		ctx = templ.WithChildren(ctx, inner)
		return layoutComp.Render(ctx, w)
	})
}
