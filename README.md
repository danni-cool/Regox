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

A hand-authored OpenAPI spec is the single source of truth. It drives both sides simultaneously, so frontend and backend can develop in parallel from day one:

```
              openapi.yaml  ← single source of truth
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
  oapi-codegen              openapi-typescript
  Go resolver interfaces    TS types + page data types
  + schema structs          + dev mock JSON
        │                         │
        ↓                         ↓
  backend impl              frontend pages
  (implement interface)     (import generated types)
```

Change the spec once, rerun `pnpm codegen`, and both sides report compile errors for anything that's out of sync.

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
│   openapi.yaml ──────────┬──> Go resolver interfaces (oapi-codegen)│
│   (source of truth)      └──> TS types + mocks (openapi-typescript)│
│                                                                     │
│   frontend/pages/*.tsx ──> Vite + Regox plugin                   │
│                          │                                          │
│                          ├── Island auto-detection (AST analysis)  │
│                          ├──> dist/templates/*.html (Go templates) │
│                          ├──> dist/assets/islands/*.js (bundles)   │
│                          └──> dist/manifest.json                   │
│                                                                     │
│   backend/**/*.go ───────> Go compiler                            │
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
├── openapi.yaml                   # source of truth — write this first
├── regox.config.ts                # build configuration
│
├── frontend/
│   ├── pages/
│   │   └── product/
│   │       └── [id].tsx           # React page component (standard React, no annotations)
│   ├── components/
│   │   └── CartButton.tsx         # compiler auto-detects this as an Island
│   └── generated/
│       └── types.ts               # from openapi-typescript, do not edit
│
├── backend/
│   ├── resolvers/
│   │   └── product.go             # implements generated PageResolvers interface
│   ├── generated/
│   │   └── resolvers.gen.go       # from oapi-codegen, do not edit
│   └── main.go
│
└── go.mod
```

### A page, end to end

#### 1. Write the OpenAPI spec

```yaml
# openapi.yaml
/internal/pages/product/{id}:
  get:
    operationId: GetProductPage
    responses:
      "200":
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ProductPageData"
```

Run `pnpm codegen` — TypeScript types and Go interfaces are generated automatically.

#### 2. Define the page in React

```tsx
// frontend/pages/product/[id].tsx
import type { ProductPageData } from '@/generated/types'  // generated
import { CartButton } from '@/components/CartButton'       // standard React component
import type { RegoxPageConfig } from 'regox'

export const regox = { mode: 'ssr' } satisfies RegoxPageConfig

export default function ProductPage({ product }: ProductPageData) {
  return (
    <main>
      <h1>{product.title}</h1>
      <p>{product.description}</p>
      {/* CartButton uses useState + onClick — compiler auto-extracts it as an Island */}
      <CartButton productId={product.id} price={product.price} />
    </main>
  )
}
```

#### 3. Implement the resolver in Go

```go
// backend/resolvers/product.go
package resolvers

import (
    "context"
    gen "myapp/backend/generated" // generated by oapi-codegen
)

type Resolvers struct{}

func (r *Resolvers) GetProductPage(ctx context.Context, id string) (*gen.ProductPageData, error) {
    product, err := db.GetProduct(ctx, id)
    if err != nil {
        return nil, err
    }
    return &gen.ProductPageData{Product: product}, nil
}
```

#### 4. Build output

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

#### 5. Runtime behavior

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
- [x] Core abstractions defined (routing, rendering modes, Island detection, state management)
- [x] OpenAPI-first contract design and codegen pipeline
- [x] Monorepo structure (`packages/vite-plugin`, `go/server`, `apps/mvp`)
- [ ] Prototype validation of key technical risks
  - [ ] JSX → Go template compiler (sentinel-value + AST approach)
  - [ ] Out-of-order streaming in Go
  - [ ] Island auto-detection accuracy (transitive dependency analysis)

### Phase 1 — MVP (goal: ship one working application end-to-end)

- [ ] Vite plugin: JSX → Go template compiler for SSR/ISR pages
- [ ] Vite plugin: Island auto-detection (hooks + event handlers) and bundle extraction
- [ ] Vite plugin: manifest.json generation
- [ ] Go runtime: manifest loader, page resolver wiring, template engine
- [ ] Island hydration runtime (`regox-runtime.js`, target < 1 KB)
- [ ] Dev mode: Vite mock fallback + Go `air` hot-reload + WebSocket state push
- [ ] End-to-end demo: CSR + SSR + ISR pages with cross-Island state

### Phase 2 — Streaming & production hardening

- [ ] `<StreamBoundary>` component and compiler support
- [ ] Concurrent streaming in Go (goroutines + channels)
- [ ] ISR cache state machine: stale-while-revalidate, tag invalidation
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