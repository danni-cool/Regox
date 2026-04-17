# Regox

> **React on Go. No Node in production.**

Regox is a full-stack web framework built for teams whose backend is Go. You write your UI in React, run your server in Go, and ship production as a single Go binary — no Node.js runtime required. A shared OpenAPI contract keeps your frontend and backend in sync automatically.

[简体中文 README](./README.zh-CN.md)

---

## Why Regox

If your team checks these boxes:

- Deep investment in Go (infrastructure, observability, deployment, performance tuning all built around it)
- React is your frontend standard, and you don't want to migrate to Vue, Svelte, or server templates
- You don't want a Node.js runtime in production alongside your Go services

Then today's options don't quite fit:

| Approach | Why it falls short |
|---|---|
| Next.js | Requires Node at runtime, means maintaining two stacks in parallel |
| Pure Go with embedded JS (goja / wazero) | Limited React 18+ support, an order of magnitude slower than Node |
| Go API + separate Next.js deployment | Two services to operate, caching and rate-limiting duplicated |
| Go-native templates (templ) | Abandons the React ecosystem, rewrites the entire UI layer |

Regox exists to keep the React developer experience while moving the runtime entirely to Go.

---

## Core Principles

### 1. Node at build time, Go at runtime

Node.js is demoted to a build tool, just like Vite or Webpack. Your production image contains only your Go binary and static assets.

```
Build time:
  React source ──[ Node + Vite + Regox plugins ]──> Go templates + Manifest + JS bundles

Runtime:
  HTTP request ──> Go server ──> Template render ──> Streaming HTML response
```

### 2. OpenAPI as the single contract

A single OpenAPI spec, generated from your Go backend, drives every consumer:

```
                    [ OpenAPI Spec ]
                           │
              ┌────────────┴────────────┐
              ↓                         ↓
        Go structs                 TS types
      (backend impl)           (frontend types)
                                        │
                                        ↓
                                 Typed fetcher
                               (frontend calls)
```

Change a Go struct once, and your TypeScript types, API documentation, and test mocks all update in lockstep.

### 3. Four rendering modes, chosen per page

| Mode | How it works | Best for | Single-machine throughput |
|---|---|---|---|
| **SSG** | Node renders HTML at build time, Go serves static files | Docs, marketing pages, blogs | 50k+ QPS |
| **Templated SSR** | React compiled into Go templates at build, Go fills in data at runtime | Product pages, listings, SEO-heavy content | 20k+ QPS |
| **ISR** | Templated SSR plus a Go cache layer with background revalidation | Content with moderate update frequency | Near SSG |
| **CSR** | Go serves a shell and APIs, browser renders everything | Admin panels, interactive tools | Static file speed |

For the rare "heavy SEO + heavy dynamism" page, you can opt into a Node sidecar for genuine React Streaming SSR. Most apps won't need it.

### 4. Streaming by default

Out-of-order HTML streaming is on by default. Mark async boundaries in React with `<StreamBoundary>`, the build tool splits your template, and the Go runtime fetches data in parallel with goroutines, flushing fragments as each one resolves.

The browser-side output is equivalent to what React 18's `renderToPipeableStream` produces — without needing a Node runtime to produce it.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         Build time                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   frontend/pages/*.tsx ──┐                                       │
│   frontend/islands/*.tsx ├──> Vite + Regox plugin                │
│                          │                                         │
│                          ├──> dist/templates/*.html (Go templates)│
│                          ├──> dist/assets/*.js (hydration bundles)│
│                          └──> dist/manifest.json                   │
│                                                                     │
│   backend/**/*.go ───────┬──> Go compiler                         │
│                          └──> OpenAPI spec (via Huma)             │
│                                                                     │
│   openapi.yaml ──────────┬──> Go structs (oapi-codegen)           │
│                          └──> TS types (openapi-typescript)        │
│                                                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                            Runtime                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                    │
│                    ┌─────────────────────┐                        │
│    HTTP request ──>│  Go Regox server    │                        │
│                    │                      │                        │
│                    │  ├─ Router           │                        │
│                    │  ├─ Page resolvers   │<── DB / cache / RPC    │
│                    │  ├─ Template engine  │                        │
│                    │  └─ Stream writer    │                        │
│                    └──────────┬───────────┘                        │
│                               │                                     │
│                ┌──────────────┴──────────────┐                      │
│                ↓                             ↓                      │
│         Streaming HTML              JSON API responses              │
│                                                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Quick Tour (design draft)

> The APIs below are a design draft. They illustrate the target developer experience and will evolve during implementation.

### Project structure

```
my-app/
├── frontend/
│   ├── pages/
│   │   └── product/
│   │       └── [id].tsx           # React page component
│   ├── islands/
│   │   └── CartButton.tsx         # interactive component
│   └── components/
│       └── ...
│
├── backend/
│   ├── resolvers/
│   │   └── product.go             # page data resolvers
│   ├── api/
│   │   └── product.go             # REST API handlers
│   └── main.go
│
├── openapi.yaml                   # auto-generated, version-controlled
├── regox.config.ts                # build configuration
└── go.mod
```

### A page, end to end

**1. Define the page in React**

```tsx
// frontend/pages/product/[id].tsx
import { StreamBoundary } from '@regox/react';
import { CartButton } from '@/islands/CartButton';
import type { ProductPageData } from '@/generated/types';

export default function ProductPage({ product, reviews }: ProductPageData) {
  return (
    <Layout>
      <h1>{product.title}</h1>
      <p>{product.description}</p>
      <CartButton productId={product.id} price={product.price} />

      <StreamBoundary slot="reviews" fallback={<ReviewsSkeleton />}>
        <ReviewsList reviews={reviews} />
      </StreamBoundary>
    </Layout>
  );
}
```

**2. Define the resolver in Go**

```go
// backend/resolvers/product.go
package resolvers

type ProductPageData struct {
    Product ProductInfo   `json:"product"`
    Reviews []Review      `json:"reviews" regox:"stream"` // streaming boundary
}

//regox:page /product/:id
func ProductPage(ctx regox.Context, params ProductParams) (*ProductPageData, error) {
    product, err := db.GetProduct(ctx, params.ID)
    if err != nil {
        return nil, err
    }

    // Streaming fields resolve in parallel without blocking the shell
    return &ProductPageData{
        Product: product,
        Reviews: regox.Async(func() []Review {
            return db.GetReviews(ctx, params.ID)
        }),
    }, nil
}
```

**3. Build output**

```
dist/
├── manifest.json
├── templates/
│   └── product-[id]/
│       ├── shell.html         # with {{.Product.*}} placeholders
│       └── reviews.html       # streaming fragment template
├── assets/
│   ├── islands/
│   │   └── cart-button.[hash].js
│   └── vendor.[hash].js
```

**4. Runtime behavior**

```
GET /product/abc123
  │
  ├─ [2ms]   Go renders shell, flushes (browser starts downloading JS/CSS)
  ├─ [30ms]  Product data ready, renders and flushes main content
  ├─ [150ms] Reviews ready, renders streaming fragment, flushes
  └─ [151ms] Response complete
```

---

## Stack

### Runtime

- **[Go 1.22+](https://go.dev/)** — the runtime
- **[Huma](https://huma.rocks/)** — Go HTTP framework with OpenAPI generation
- **[templ](https://templ.guide/)** — high-performance template engine (optional, alternative to `html/template`)
- **[Vite](https://vitejs.dev/)** — frontend build tool
- **[React 18+](https://react.dev/)** — UI framework

### Codegen toolchain

- **[oapi-codegen](https://github.com/oapi-codegen/oapi-codegen)** — OpenAPI to Go
- **[openapi-typescript](https://github.com/drwpow/openapi-typescript)** — OpenAPI to TypeScript

---

## Roadmap

### Phase 0 — Design & prototyping (current)

- [x] Architecture design and technology choices
- [x] Core abstractions defined
- [ ] Prototype validation of key technical risks
  - [ ] React-to-Go-template compiler (sentinel-value approach)
  - [ ] Out-of-order streaming in Go
  - [ ] OpenAPI multi-target codegen pipeline

### Phase 1 — MVP (goal: ship one working application)

- [ ] Vite plugin: compile pages into Go templates
- [ ] Go runtime: manifest loader, page resolver, template engine
- [ ] Basic rendering modes: SSG, templated SSR, CSR
- [ ] End-to-end OpenAPI contract (Go to TS)
- [ ] Scaffolding: `regox create`, `regox scaffold page`
- [ ] Dev mode: Vite HMR plus Go `air` integration

### Phase 2 — Streaming & islands

- [ ] `<StreamBoundary>` component and compiler support
- [ ] Concurrent streaming in Go (goroutines plus channels)
- [ ] Islands architecture: partial hydration, lazy loading
- [ ] Asset optimization: HTTP/2 push, 103 Early Hints

### Phase 3 — ISR & production hardening

- [ ] ISR cache state machine: stale-while-revalidate, tag invalidation
- [ ] Multi-instance coordination via Redis (deduplicated revalidation)
- [ ] Observability: OpenTelemetry, structured logs, Prometheus metrics
- [ ] Deployment: Docker, Kubernetes, single-binary

### Phase 4 — Ecosystem & documentation

- [ ] Complete docs site (built with Regox itself)
- [ ] Example apps: blog, e-commerce, internal dashboards
- [ ] Migration guides: from Next.js, Nuxt, pure Go templates
- [ ] Community plugin system

### Exploration (not yet committed)

- Edge deployment adapters (Cloudflare Workers / Fastly Go runtime)
- Limited React Server Components support (via Node sidecar)
- Visual editor (drag-and-drop layout, auto-generated components)

---

## Design Trade-offs

### What we prioritize

- **Simple runtime first.** Production is one Go binary. Minimum operational surface area.
- **Convention over configuration.** File-based routing, naming conventions, automatic codegen.
- **Explicit over magical.** Type contracts and streaming boundaries are all declared, not inferred.
- **Progressive adoption.** Start with one page, not a full-stack rewrite.

### What we give up

- **Arbitrary React runtime behavior.** Some hooks, context usage, and third-party components don't fit the SSR compilation model.
- **Native React Server Components.** RSC is deeply coupled to Node, which conflicts with our core premise.
- **Zero build step.** A Node build stage is required — this is the cost of a pure-Go runtime.
- **Replacing Next.js.** If your team isn't invested in Go, Next.js is the better choice.

---

## Who Should Use This

### Good fit

- Go is your primary backend language with real engineering maturity behind it
- React is your frontend standard and you want to keep its ecosystem
- Runtime footprint matters to you (container memory, cold start, binary shipping)
- You're at the scale where you'd build your own infrastructure anyway (dozens of pages, 10k+ QPS)

### Poor fit

- Node-only team with no Go expertise — Next.js is a better fit
- Hard dependency on React Server Components — use Next.js 14+
- Heavy reliance on a React library that requires server-side hook behavior (e.g., Radix Portal server rendering)
- Small app with a handful of pages and no long-term roadmap — Vite plus a Go API is simpler

---

## Project Status

**⚠️ Current phase: design & prototype validation (Phase 0)**

Regox has no usable release yet. This README describes the target architecture and design intent. It exists to align contributors and collect feedback.

If you disagree with a design decision, have experience with similar architectures, or want to help validate a tricky piece, open an issue.

---

## FAQ

**Why not just use Next.js with a Go API backend?**
You can, and for many teams you should. Regox exists when the cost of running two runtimes — duplicated observability, caching, rate limiting, deployment pipelines — outweighs the benefit of having Next.js-native features. If your Go infrastructure is mature and you'd rather extend it than parallel it, Regox is built for you.

**Can every React component be compiled into a Go template?**
No. The compiler targets a restricted subset: pure render components, simple conditionals and loops, prop-driven output. Hooks, refs, portals, and stateful third-party components belong in islands — rendered on the client, not compiled server-side.

**How does this compare to Astro, Qwik, or Marko?**
Those frameworks all run on Node. The only meaningful difference is that Regox runs on Go, which means you inherit Go's concurrency model, deployment story, and observability ecosystem. If your team is already in the Node ecosystem, Astro or Qwik are more mature choices.

**Why OpenAPI instead of gRPC or GraphQL?**
OpenAPI is the most pragmatic contract format for REST APIs with a browser client. Go tooling is mature (Huma, oapi-codegen), TypeScript tooling is mature (openapi-typescript), and the spec is human-readable for review. gRPC needs a grpc-web gateway for browsers. GraphQL's streaming and caching story gets complicated under SSR.

---

## Contributing

Regox is in its earliest design phase. The best way to contribute right now is to challenge decisions in GitHub issues. Before each phase begins, we'll publish an RFC and collect feedback before implementation starts.

Code contribution guidelines will land when Phase 1 kicks off.

---

## License

TBD (candidates: Apache 2.0 or MIT)

---

<p align="center">
  <i>Regox — React on Go. No Node in production.</i>
</p>