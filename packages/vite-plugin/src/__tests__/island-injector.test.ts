import { describe, it, expect } from 'vitest'
import { generateIslandInjectionScript, injectIslandScripts } from '../island-injector'
import type { IslandMap } from '../types'

describe('generateIslandInjectionScript', () => {
  it('generates island-loader script with registry', () => {
    const islandMap: IslandMap = new Map([
      ['CartBadge', { componentName: 'CartBadge', filePath: 'islands/CartBadge.tsx', props: [], reason: ['useState'] }],
    ])
    const script = generateIslandInjectionScript(islandMap, '/assets/islands.js')
    expect(script).toContain('__regox_islands__')
    expect(script).toContain('data-island')
    expect(script).toContain('/assets/islands.js')
  })

  it('injects script before </body>', () => {
    const islandMap: IslandMap = new Map([
      ['CartBadge', { componentName: 'CartBadge', filePath: 'islands/CartBadge.tsx', props: [], reason: [] }],
    ])
    const html = '<html><body><p>hello</p></body></html>'
    const result = injectIslandScripts(html, islandMap, '/assets/islands.js')
    expect(result).toContain('__regox_islands__')
    expect(result.indexOf('__regox_islands__')).toBeLessThan(result.indexOf('</body>'))
  })
})
