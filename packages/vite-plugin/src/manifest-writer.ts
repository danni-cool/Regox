import fs from 'node:fs'
import path from 'node:path'
import type { PageMeta, IslandMap } from './types.ts'

interface ManifestPage {
  mode: string
  revalidate?: number
  islands: string[]
}

interface Manifest {
  pages: Record<string, ManifestPage>
  islandChunks: Record<string, string>
  mainScript?: string
}

export function writeManifest(
  pages: PageMeta[],
  islandMaps: Map<string, IslandMap>,
  outDir: string,
  mainScript?: string,
  islandChunks?: Record<string, string>,
): void {
  const manifest: Manifest = {
    pages: {},
    islandChunks: islandChunks ?? {},
    ...(mainScript ? { mainScript } : {}),
  }

  for (const page of pages) {
    const islandMap = islandMaps.get(page.route) ?? new Map()
    const entry: ManifestPage = {
      mode: page.mode,
      islands: [...islandMap.keys()],
    }
    if (page.revalidate !== undefined) entry.revalidate = page.revalidate
    manifest.pages[page.route] = entry
  }

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  )
}
