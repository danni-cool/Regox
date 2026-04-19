import fs from 'node:fs'
import path from 'node:path'
import type { PageMeta } from './types.ts'

interface ScanInput {
  content: string
  filePath: string
  pagesDir: string
  templatesDir: string
}

export function routeToTemplPath(route: string, templatesDir: string): string {
  const norm = route === '/' ? 'index' : route.replace(/^\//, '')
  const name = norm
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\//g, '__')
  return path.join(templatesDir, `${name}.templ`)
}

function filePathToRoute(filePath: string, pagesDir: string): string {
  const rel = path.relative(pagesDir, filePath).replace(/\.tsx$/, '')
  if (rel === 'index') return '/'
  return '/' + rel.replace(/\\/g, '/')
}

export function extractPageMeta(input: ScanInput): PageMeta {
  const { content, filePath, pagesDir, templatesDir } = input
  const route = filePathToRoute(filePath, pagesDir)
  const templPath = routeToTemplPath(route, templatesDir)
  const propsPath = templPath.replace(/\.templ$/, '_props.go')

  const modeMatch = content.match(/mode:\s*['"](\w+)['"]/)
  const mode = (modeMatch?.[1] ?? 'csr') as PageMeta['mode']

  const revalidateMatch = content.match(/revalidate:\s*(\d+)/)
  const revalidate = revalidateMatch ? parseInt(revalidateMatch[1], 10) : undefined

  const fnMatch = content.match(/export\s+default\s+function\s+(\w+)/)
  const pageName = fnMatch?.[1] ?? path.basename(filePath, '.tsx')

  const dataTypeMatch = content.match(/\}\s*:\s*(\w+)\s*\)/)
  const dataType = dataTypeMatch?.[1] ?? null

  return { filePath, route, mode, revalidate, pageName, dataType, templPath, propsPath }
}

export function scanPages(pagesDir: string, templatesDir: string): PageMeta[] {
  return collectTsx(pagesDir).map(filePath => {
    const content = fs.readFileSync(filePath, 'utf-8')
    return extractPageMeta({ content, filePath, pagesDir, templatesDir })
  })
}

function collectTsx(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...collectTsx(full))
    else if (entry.name.endsWith('.tsx')) results.push(full)
  }
  return results
}
