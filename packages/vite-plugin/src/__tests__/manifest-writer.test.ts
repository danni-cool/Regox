import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { writeManifest } from '../manifest-writer'
import type { PageMeta } from '../types'

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'regox-manifest-'))
}

describe('writeManifest', () => {
  let tmpDir: string

  beforeEach(() => { tmpDir = makeTmpDir() })
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true }) })

  it('writes pages and islandChunks', () => {
    const pages: PageMeta[] = [
      { route: '/', mode: 'ssr', pageName: 'Index', filePath: '', templPath: '', islands: [] },
    ]
    writeManifest(pages, new Map(), tmpDir)
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf-8'))
    expect(manifest.pages['/']).toBeDefined()
    expect(manifest.islandChunks).toBeDefined()
  })

  it('writes mainScript when provided', () => {
    const pages: PageMeta[] = []
    writeManifest(pages, new Map(), tmpDir, '/assets/index-ABC.js')
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf-8'))
    expect(manifest.mainScript).toBe('/assets/index-ABC.js')
  })

  it('omits mainScript when not provided', () => {
    writeManifest([], new Map(), tmpDir)
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf-8'))
    expect(manifest.mainScript).toBeUndefined()
  })
})
