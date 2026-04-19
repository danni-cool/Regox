import fs from 'node:fs';
import path from 'node:path';
export function regox(config) {
    return {
        name: 'regox',
        // Dev server: proxy /internal/pages/* to Go, fall back to mock files
        configureServer(server) {
            server.middlewares.use(mockFallbackMiddleware(config));
        },
        // TODO: buildStart — scan pages/ for rendering mode declarations
        // TODO: transform  — Island auto-detection + JSX → templ compilation
        // TODO: generateBundle — emit manifest.json
    };
}
// Routes /internal/pages/* requests:
//   1. Try the live Go server (config.dev.goPort, default 8080)
//   2. Fall back to frontend/mocks/<derived-name>.json
function mockFallbackMiddleware(config) {
    const goOrigin = `http://localhost:${config.dev?.goPort ?? 8080}`;
    return async (req, res, next) => {
        if (!req.url?.startsWith('/internal/pages/'))
            return next();
        // 1. Try live Go server
        try {
            const upstream = await fetch(`${goOrigin}${req.url}`, { signal: AbortSignal.timeout(500) });
            if (upstream.ok) {
                res.setHeader('Content-Type', 'application/json');
                res.end(await upstream.text());
                return;
            }
        }
        catch {
            // Go server not running — fall through to mock
        }
        // 2. Resolve mock file: /internal/pages/product/123 → mocks/product__id.json
        const mockFile = resolvePageUrlToMockPath(req.url, config);
        if (mockFile && fs.existsSync(mockFile)) {
            console.log(`[regox] mock: ${req.url} → ${path.relative(process.cwd(), mockFile)}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(mockFile, 'utf-8'));
            return;
        }
        next();
    };
}
// Maps a runtime URL to its corresponding mock file.
// Convention mirrors the file-based routing used in pages/:
//   /internal/pages/product/[id]  → mocks/product__id.json
//   /internal/pages/shop          → mocks/shop.json
function resolvePageUrlToMockPath(url, config) {
    const mocksDir = config.openapi?.mocksDir ?? 'frontend/mocks';
    // Strip /internal/pages/ prefix, then replace dynamic segments with [param] names
    const rel = url.replace(/^\/internal\/pages\//, '');
    // Heuristic: replace the last path segment that looks like an ID with its param name.
    // For MVP this is sufficient; a real implementation would match against openapi paths.
    const normalized = rel.replace(/\/[^/]+$/, (segment) => {
        // If segment looks like a real ID (non-alphabetic or contains digits), treat as param
        const s = segment.slice(1);
        return /^\d|[^a-z_-]/i.test(s) ? '/__id__' : segment;
    });
    const mockName = normalized.replace(/\//g, '__').replace(/__id__/, '__id') + '.json';
    return path.join(process.cwd(), mocksDir, mockName);
}
export { defineConfig } from './define-config';
