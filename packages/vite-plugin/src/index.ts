import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import type { IslandMap, RegoxConfig } from './types.ts'
import { scanPages } from './page-scanner.ts'
import { detectIslands } from './island-detector.ts'
import { compileJSXToTempl, CompileError, type ScaffoldSpec } from './jsx-compiler.ts'
import { writeTemplFiles } from './templ-writer.ts'
import { writeManifest } from './manifest-writer.ts'
import { writeGoRoutes } from './go-routes-writer.ts'

function readGoModule(appRoot: string): string | undefined {
  try {
    const goMod = fs.readFileSync(path.join(appRoot, 'backend', 'go.mod'), 'utf-8')
    const match = goMod.match(/^module\s+(\S+)/m)
    return match?.[1]
  } catch {
    return undefined
  }
}
import { generateIslandRegistration } from './island-registry.ts'
import { validatePageComponent } from './page-validator.ts'
import { injectIslandScripts } from './island-injector.ts'
import { scanEventUsage, buildEventMap, type EventMap as EventMapType } from './event-scanner.ts'

export function regox(config: RegoxConfig): Plugin {
  let islandMapCache: IslandMap = new Map()
  let pendingManifest: { pages: ReturnType<typeof scanPages>; islandMaps: Map<string, IslandMap> } | null = null
  let eventMapCache: EventMapType = {}
  let resolvedProvidersPath: string | undefined

  return {
    name: 'regox',

    config(cfg, { command }) {
      if (command !== 'build') return
      // Add all island files as additional rollup entry points so they get
      // bundled and the transform hook can inject registration code into them.
      const islandsDir = path.resolve('frontend/islands')
      if (!fs.existsSync(islandsDir)) return
      const islandEntries: Record<string, string> = {}
      for (const file of fs.readdirSync(islandsDir)) {
        if (/\.(tsx|ts)$/.test(file)) {
          const name = path.basename(file, path.extname(file))
          islandEntries[`islands/${name}`] = path.join(islandsDir, file)
        }
      }
      if (Object.keys(islandEntries).length === 0) return

      // Merge with existing input (default is index.html, may be string or object)
      const existingInput = cfg.build?.rollupOptions?.input
      let mergedInput: Record<string, string>
      if (!existingInput) {
        // Default Vite entry is index.html at project root
        mergedInput = { index: path.resolve('index.html'), ...islandEntries }
      } else if (typeof existingInput === 'string') {
        mergedInput = { index: existingInput, ...islandEntries }
      } else if (Array.isArray(existingInput)) {
        const arrEntries = Object.fromEntries(existingInput.map((e, i) => [`entry${i}`, e]))
        mergedInput = { ...arrEntries, ...islandEntries }
      } else {
        mergedInput = { ...existingInput as Record<string, string>, ...islandEntries }
      }

      return {
        build: {
          rollupOptions: { input: mergedInput },
        },
      }
    },

    buildStart() {
      resolvedProvidersPath = config.providers ? path.resolve(config.providers) : undefined
      const pagesDir = path.resolve('frontend/pages')
      const templatesDir = path.resolve('backend/templates')

      if (!fs.existsSync(pagesDir)) return

      const pages = scanPages(pagesDir, templatesDir)
      const ssrPages = pages.filter(p => p.mode !== 'csr')

      const islandMaps = new Map<string, IslandMap>()

      islandMapCache = new Map()
      for (const page of pages) {
        const source = fs.readFileSync(page.filePath, 'utf-8')
        const islandMap = detectIslands(source, page.filePath, { config })
        islandMaps.set(page.route, islandMap)
        for (const [name, meta] of islandMap) {
          islandMapCache.set(name, meta)
        }
      }

      // Register all island files from the islands/ directory.
      // Hand-written templ files reference islands via data-island="..." and bypass
      // the JSX page scanner, so we must register them unconditionally here.
      const islandsDir = path.resolve('frontend/islands')
      if (fs.existsSync(islandsDir)) {
        for (const file of fs.readdirSync(islandsDir)) {
          if (/\.(tsx|ts)$/.test(file)) {
            const name = path.basename(file, path.extname(file))
            if (!islandMapCache.has(name)) {
              islandMapCache.set(name, {
                componentName: name,
                filePath: path.join(islandsDir, file),
                props: [],
                reason: ['explicit-island-dir'],
              })
              console.log(`[regox] ✓ ${name} → Island (explicit)`)
            }
          }
        }
      }

      for (const page of ssrPages) {
        // Skip if a hand-written templ file already exists for this route.
        // The JSX compiler only generates stubs; hand-written files take priority.
        if (fs.existsSync(page.templPath)) {
          console.log(`[regox] skip compile (hand-written templ exists): ${path.relative(process.cwd(), page.templPath)}`)
          continue
        }

        const source = fs.readFileSync(page.filePath, 'utf-8')
        const islandMap = islandMaps.get(page.route) ?? new Map()

        try {
          const { templ, propsStruct } = compileJSXToTempl(source, islandMap, {
            pageName: page.pageName,
            filePath: page.filePath,
          }, (spec: ScaffoldSpec) => {
            const islandsDir = path.resolve('frontend/islands')
            const scaffoldPath = path.join(islandsDir, `${spec.name}.tsx`)

            if (!fs.existsSync(scaffoldPath)) {
              fs.mkdirSync(islandsDir, { recursive: true })
              const propParams = spec.props.map(p => p.name).join(', ')
              const propTypes = spec.props.map(p => `${p.name}: unknown`).join('; ')
              const content = [
                `// islands/${spec.name}.tsx — auto-generated by regox, edit freely`,
                `export default function ${spec.name}({ ${propParams} }: { ${propTypes} }) {`,
                `  // TODO: implement your island component here`,
                `  return <div>{JSON.stringify({ ${propParams} })}</div>`,
                `}`,
                '',
              ].join('\n')
              fs.writeFileSync(scaffoldPath, content, 'utf-8')
              console.log(`[regox] scaffolded island: ${path.relative(process.cwd(), scaffoldPath)}`)
            } else {
              // Validate: check that all props from <Client> exist in the file
              const existing = fs.readFileSync(scaffoldPath, 'utf-8')
              for (const prop of spec.props) {
                if (!existing.includes(prop.name)) {
                  throw new CompileError(
                    `<Client name="${spec.name}"> passes prop "${prop.name}" which is not in ` +
                    `${scaffoldPath}'s prop interface. Add it manually:\n` +
                    `  ({ ${spec.props.map(p => p.name).join(', ')} }: { ... })`,
                    page.filePath,
                  )
                }
              }
            }
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

      // Validate SSR/ISR pages don't use hooks directly in the page component body
      // Insert just before: pendingManifest = { pages, islandMaps }
      for (const page of ssrPages) {
        const source = fs.readFileSync(page.filePath, 'utf-8')
        validatePageComponent(source, page.filePath)
      }

      // Scan all island files for event usage and build EventMap
      const islandsDirForEvents = path.resolve('frontend/islands')
      if (fs.existsSync(islandsDirForEvents)) {
        const allEntries = fs.readdirSync(islandsDirForEvents)
          .filter(f => /\.(tsx|ts)$/.test(f))
          .flatMap(f => {
            const fp = path.join(islandsDirForEvents, f)
            return scanEventUsage(fs.readFileSync(fp, 'utf-8'), f)
          })
        eventMapCache = buildEventMap(allEntries)
        const eventMapOut = path.resolve('frontend/generated/event-map.ts')
        const lines = [
          '// Auto-generated by @regox/vite-plugin — do not edit manually',
          `export const eventMap = ${JSON.stringify(eventMapCache, null, 2)} as Record<string, { emitters: string[]; listeners: string[] }>`,
        ]
        fs.writeFileSync(eventMapOut, lines.join('\n') + '\n')
        console.log(`[regox] event-map written: ${Object.keys(eventMapCache).length} events`)
      }

      // Defer manifest writing to closeBundle so Vite's emptyOutDir doesn't delete it
      pendingManifest = { pages, islandMaps }
    },

    closeBundle() {
      if (!pendingManifest) return
      const distDir = path.resolve('frontend/dist')

      // Extract the hashed main JS chunk URL and CSS URL from Vite's built index.html
      let mainScript: string | undefined
      let styleSheet: string | undefined
      try {
        const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')
        const jsMatch = indexHtml.match(/src="(\/assets\/[^"]+\.js)"/)
        if (jsMatch) mainScript = jsMatch[1]
        const cssMatch = indexHtml.match(/href="(\/assets\/[^"]+\.css)"/)
        if (cssMatch) styleSheet = cssMatch[1]
      } catch { /* dev mode or pre-build — skip */ }

      // Scan built islands/ chunk directory to populate islandChunks map.
      // Island name → hashed chunk URL (e.g. "AddToCart" → "/assets/islands/AddToCart-XYZ.js")
      const islandChunks: Record<string, string> = {}
      const builtIslandsDir = path.join(distDir, 'assets', 'islands')
      if (fs.existsSync(builtIslandsDir)) {
        // Match each built chunk back to a known island name by finding the
        // longest island name that is a prefix of the filename. This avoids
        // hash-stripping bugs when hashes themselves contain hyphens.
        const knownNames = [...islandMapCache.keys()]
        for (const file of fs.readdirSync(builtIslandsDir)) {
          if (!file.endsWith('.js')) continue
          const matchedName = knownNames.find(n => file.startsWith(n + '-') || file === n + '.js')
          if (matchedName) {
            islandChunks[matchedName] = `/assets/islands/${file}`
          }
        }
      }

      writeManifest(pendingManifest.pages, pendingManifest.islandMaps, distDir, mainScript, islandChunks, styleSheet)
      const goModule = readGoModule(path.resolve('.'))
      const goRoutesDir = path.resolve('backend/regoxroutes')
      writeGoRoutes(pendingManifest.pages, goRoutesDir, 'regoxroutes', goModule ? { goModule } : undefined)
      console.log(`[regox] manifest written: frontend/dist/manifest.json (${pendingManifest.pages.length} pages, ${Object.keys(islandChunks).length} island chunks)`)
      console.log(`[regox] routes written: backend/regoxroutes/routes.go${goModule ? ` (module: ${goModule})` : ''}`)
      pendingManifest = null
    },

    transform(code, id) {
      const basename = path.basename(id, path.extname(id))
      if (!islandMapCache.has(basename)) return null
      const providersArg = resolvedProvidersPath
        ? path.relative(path.dirname(id), resolvedProvidersPath)
        : undefined
      const registration = generateIslandRegistration(basename, providersArg)
      return { code: code + '\n' + registration, map: null }
    },

    transformIndexHtml(html) {
      if (islandMapCache.size === 0) return html
      return injectIslandScripts(html, islandMapCache, '/assets/islands.js')
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
