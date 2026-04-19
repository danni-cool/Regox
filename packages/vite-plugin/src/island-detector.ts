import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'
import * as t from '@babel/types'
import type { IslandMap, IslandMeta, RegoxConfig } from './types.ts'
import { containsHook, isClientOnlyPackage, getImportedPackages } from './island-detector-utils.ts'
import { serializeProps } from './prop-serializer.ts'

interface ResolveResult {
  path: string
  source: string
}

interface DetectOptions {
  config: RegoxConfig
  resolveFile?: (importPath: string, fromFile: string) => ResolveResult | null
}

export function detectIslands(
  source: string,
  filePath: string,
  opts: DetectOptions = { config: {} },
): IslandMap {
  const islands: IslandMap = new Map()
  const resolveFile = opts.resolveFile ?? defaultResolver

  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })

  const importMap = buildImportMap(ast)
  const paramNames = extractParamNames(ast)

  // visited set prevents infinite loops from circular imports
  const visited = new Set<string>()

  walkJSX(ast, visited, (componentName, jsxAttrs) => {
    if (islands.has(componentName)) return 'skip'

    const importPath = importMap.get(componentName)
    if (!importPath) {
      // Not a local import — may be direct third-party usage on the page
      if (process.env.NODE_ENV !== 'test') {
        const thirdPartyPkgs = getThirdPartyPackage(ast, componentName)
        if (thirdPartyPkgs.length) {
          console.warn(`[regox] ⚠ <${componentName}> from ${thirdPartyPkgs[0]} — assumed SSR-safe`)
          console.warn(`  💡 If hydration errors occur, add to regox.config.ts:`)
          console.warn(`     dev: { clientOnlyPackages: ['${thirdPartyPkgs[0]}'] }`)
        }
      }
      return 'continue'
    }

    const resolved = resolveFile(importPath, filePath)
    if (!resolved) return 'continue'

    const componentAst = parse(resolved.source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
    const reason: string[] = []

    if (containsHook(componentAst)) {
      const hookNames = findHookNames(componentAst)
      reason.push(...hookNames)
    }

    // A component is marked as Island if it receives an on[A-Z]* prop at the
    // call-site. This assumes the component actually handles the prop (T2=A: single-direction).
    const eventHandlers = findEventHandlerProps(jsxAttrs)
    reason.push(...eventHandlers)

    const clientPkgs = getImportedPackages(componentAst).filter(pkg =>
      isClientOnlyPackage(pkg, { clientOnlyPackages: opts.config.dev?.clientOnlyPackages ?? [] })
    )
    reason.push(...clientPkgs)

    if (reason.length === 0) return 'continue'

    const props = serializeProps(jsxAttrs, paramNames)
    const meta: IslandMeta = {
      componentName,
      filePath: resolved.path,
      props,
      reason,
    }
    islands.set(componentName, meta)

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[regox] ${componentName} → Island`)
      console.log(`  reason: ${reason.join(', ')}`)
    }

    return 'skip'
  })

  return islands
}

function buildImportMap(ast: t.File): Map<string, string> {
  const map = new Map<string, string>()
  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue
    const source = node.source.value
    if (source.startsWith('.')) {
      for (const spec of node.specifiers) {
        if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec)) {
          const name = t.isImportSpecifier(spec)
            ? (t.isIdentifier(spec.local) ? spec.local.name : '')
            : spec.local.name
          if (name) map.set(name, source)
        }
      }
    }
  }
  return map
}

function extractParamNames(ast: t.File): Set<string> {
  const names = new Set<string>()
  for (const node of ast.program.body) {
    if (!t.isExportDefaultDeclaration(node)) continue
    const decl = node.declaration
    if (!t.isFunctionDeclaration(decl)) continue
    const param = decl.params[0]
    if (t.isObjectPattern(param)) {
      for (const prop of param.properties) {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
          names.add(prop.key.name)
        }
      }
    }
  }
  return names
}

type WalkAction = 'skip' | 'continue'

function walkJSX(
  ast: t.File,
  visited: Set<string>,
  visitor: (componentName: string, attrs: t.JSXAttribute[]) => WalkAction,
): void {
  function walk(node: t.Node): void {
    if (t.isJSXElement(node)) {
      const nameNode = node.openingElement.name
      if (t.isJSXIdentifier(nameNode) && /^[A-Z]/.test(nameNode.name)) {
        const attrs = node.openingElement.attributes.filter(t.isJSXAttribute) as t.JSXAttribute[]
        const action = visitor(nameNode.name, attrs)
        if (action === 'skip') return
      }
      for (const child of node.children) walk(child)
      return
    }

    for (const key of Object.keys(node) as (keyof typeof node)[]) {
      const child = (node as any)[key]
      if (Array.isArray(child)) {
        child.forEach((c: any) => { if (c?.type) walk(c) })
      } else if (child?.type) {
        walk(child)
      }
    }
  }
  walk(ast.program)
}

function findHookNames(ast: t.File): string[] {
  const found: string[] = []
  function walk(node: t.Node): void {
    if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
      const name = node.callee.name
      if (/^use[A-Z]/.test(name) || ['useState','useEffect','useRef','useCallback','useMemo','useContext','useReducer','useLayoutEffect'].includes(name)) {
        if (!found.includes(name)) found.push(name)
      }
    }
    for (const key of Object.keys(node) as (keyof typeof node)[]) {
      const child = (node as any)[key]
      if (Array.isArray(child)) child.forEach((c: any) => c?.type && walk(c))
      else if (child?.type) walk(child)
    }
  }
  walk(ast.program)
  return found
}

function findEventHandlerProps(attrs: t.JSXAttribute[]): string[] {
  return attrs
    .filter(attr => {
      const name = t.isJSXIdentifier(attr.name) ? attr.name.name : ''
      return /^on[A-Z]/.test(name)
    })
    .map(attr => (t.isJSXIdentifier(attr.name) ? attr.name.name : ''))
}

function getThirdPartyPackage(ast: t.File, componentName: string): string[] {
  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue
    if (node.source.value.startsWith('.')) continue
    for (const spec of node.specifiers) {
      const name = t.isImportSpecifier(spec)
        ? (t.isIdentifier(spec.local) ? spec.local.name : '')
        : spec.local.name
      if (name === componentName) return [node.source.value]
    }
  }
  return []
}

function defaultResolver(importPath: string, fromFile: string): ResolveResult | null {
  const dir = path.dirname(fromFile)
  for (const ext of ['.tsx', '.ts', '.jsx', '.js', '']) {
    const full = path.resolve(dir, importPath + ext)
    if (fs.existsSync(full)) {
      return { path: full, source: fs.readFileSync(full, 'utf-8') }
    }
  }
  return null
}
