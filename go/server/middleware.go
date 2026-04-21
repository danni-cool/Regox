package server

import "net/http"

// MiddlewareFunc wraps an http.Handler with additional behaviour (auth, logging, etc.).
type MiddlewareFunc func(http.Handler) http.Handler

// Use registers one or more middleware functions that run before every matched route.
// Middleware is applied in registration order (first registered = outermost).
func (r *Router) Use(mw ...MiddlewareFunc) {
	r.middlewares = append(r.middlewares, mw...)
}

func (r *Router) applyMiddleware(h http.Handler) http.Handler {
	for i := len(r.middlewares) - 1; i >= 0; i-- {
		h = r.middlewares[i](h)
	}
	return h
}
