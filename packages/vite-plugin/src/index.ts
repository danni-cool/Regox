import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import type { RegoxConfig } from './types.ts'
import { scanPages } from './page-scanner.ts'
import { detectIslands } from './island-detector.ts'
import { compileJSXToTempl, CompileError } from './jsx-compiler.ts'
import { writeTemplFiles } from './templ-writer.ts'
import { writeManifest } from './manifest-writer.ts'

export function regox(config: RegoxConfig): Plugin {
  return {
    name: 'regox',

    buildStart() {
      const pagesDir = path.resolve('frontend/pages')
      const templatesDir = path.resolve('backend/templates')
      const distDir = path.resolve('frontend/dist')

      if (!fs.existsSync(pagesDir)) return

      const pages = scanPages(pagesDir, templatesDir)
      const ssrPages = pages.filter(p => p.mode !== 'csr')

      const islandMaps = new Map<string, ReturnType<typeof detectIslands>>()

      for (const page of pages) {
        const source = fs.readFileSync(page.filePath, 'utf-8')
        const islandMap = detectIslands(source, page.filePath, { config })
        islandMaps.set(page.route, islandMap)
      }

      for (const page of ssrPages) {
        const source = fs.readFileSync(page.filePath, 'utf-8')
        const islandMap = islandMaps.get(page.route) ?? new Map()

        try {
          const { templ, propsStruct } = compileJSXToTempl(source, islandMap, {
            pageName: page.pageName,
            filePath: page.filePath,
          })
          writeTemplFiles(page, templ, propsStruct)
          console.log(`[regox] compiled: ${path.relative(process.cwd(), page.filePath)} → ${path.relative(process.cwd(), page.templPath)}`)
        } catch (err) {
          if (err instanceof CompileError) {
            this.error(`[regox] compile error in ${page.filePath}:\n${err.message}`)
          }
          throw err
        }
      }

      writeManifest(pages, islandMaps, distDir)
      console.log(`[regox] manifest written: frontend/dist/manifest.json (${pages.length} pages)`)
    },

    configureServer(server) {
      server.middlewares.use(mockFallbackMiddleware(config))
    },
  }
}

function mockFallbackMiddleware(config: RegoxConfig): Connect.NextHandleFunction {
  const goOrigin = `http://localhost:${config.dev?.goPort ?? 8080}`

  return async (req, res, next) => {
    if (!req.url?.startsWith('/internal/pages/')) return next()

    try {
      const upstream = await fetch(`${goOrigin}${req.url}`, { signal: AbortSignal.timeout(500) })
      if (upstream.ok) {
        res.setHeader('Content-Type', 'application/json')
        res.end(await upstream.text())
        return
      }
    } catch {
      // Go server not running — fall through to mock
    }

    const mockFile = resolvePageUrlToMockPath(req.url, config)
    if (mockFile && fs.existsSync(mockFile)) {
      console.log(`[regox] mock: ${req.url} → ${path.relative(process.cwd(), mockFile)}`)
      res.setHeader('Content-Type', 'application/json')
      res.end(fs.readFileSync(mockFile, 'utf-8'))
      return
    }

    next()
  }
}

function resolvePageUrlToMockPath(url: string, config: RegoxConfig): string | null {
  const mocksDir = config.openapi?.mocksDir ?? 'frontend/mocks'
  const rel = url.replace(/^\/internal\/pages\//, '')
  const normalized = rel.replace(/\/[^/]+$/, (segment) => {
    const s = segment.slice(1)
    return /^\d|[^a-z_-]/i.test(s) ? '/__id__' : segment
  })
  const mockName = normalized.replace(/\//g, '__').replace(/__id__/, '__id') + '.json'
  return path.join(process.cwd(), mocksDir, mockName)
}

export { defineConfig } from './define-config.ts'
export type { RegoxConfig }
