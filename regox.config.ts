import { defineConfig } from '@regox/core'

// Design draft — API will evolve during implementation.

export default defineConfig({

  // ─── Build ─────────────────────────────────────────────────────────────────

  build: {
    outDir: './dist',

    ssg: {
      // 'embed'    → SSG files are embedded into the Go binary via go:embed
      // 'external' → Go server redirects SSG routes (301) to cdnBaseUrl; no static files embedded
      output: 'embed',

      // Required when output is 'external'. Root URL where SSG files are served after upload.
      // cdnBaseUrl: 'https://cdn.example.com',
    },
  },

  // ─── Routing ───────────────────────────────────────────────────────────────

  routing: {
    // Reserved prefix for REST API handlers. Page files under this prefix are forbidden.
    // Conflicts between page routes and API routes under this prefix cause a build error.
    apiPrefix: '/api',

    // Fallback behavior when no page file matches the incoming path.
    // 'csr-shell' → serve a generic CSR shell (suitable for SPA sub-routes)
    // '404'       → return 404
    notFound: '404',
  },

  // ─── Dev server ────────────────────────────────────────────────────────────

  dev: {
    // Vite dev server port (frontend HMR)
    port: 5173,

    // Go server port (air hot reload)
    goPort: 8080,

    // Additional Vite proxy rules. By default, apiPrefix and page requests are
    // forwarded to goPort. Same format as vite server.proxy.
    proxy: {},
  },

  // ─── OpenAPI ───────────────────────────────────────────────────────────────

  openapi: {
    // Path to the Go-generated OpenAPI spec. Version-controlled, committed to git.
    spec: './openapi.yaml',

    // Auto-generate TypeScript types from the spec at build time.
    // Output: frontend/generated/types.ts
    generateTypes: true,
  },

  // ─── Export ────────────────────────────────────────────────────────────────

  export: {
    // Output directory for `regox export ssg`.
    // Contains SSG static files + cdn-routes.json for CDN rules / Nginx config.
    ssgDir: './dist/static',
  },

})
