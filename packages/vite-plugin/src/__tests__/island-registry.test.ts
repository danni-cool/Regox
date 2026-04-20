import { describe, it, expect } from 'vitest'
import { generateIslandRegistration } from '../island-registry'

describe('generateIslandRegistration', () => {
  it('generates window assignment for a named island', () => {
    const result = generateIslandRegistration('CartButton')
    expect(result).toContain(`window.__regox_islands__ ??= {}`)
    expect(result).toContain(`window.__regox_islands__['CartButton'] = (el, props) => {`)
  })

  it('generates unique variable name for each island', () => {
    const a = generateIslandRegistration('Header')
    const b = generateIslandRegistration('Footer')
    expect(a).toContain("'Header'")
    expect(b).toContain("'Footer'")
  })

  it('self-mounts existing data-island elements after registration', () => {
    const result = generateIslandRegistration('AddToCart')
    // Must query matching elements and invoke the factory immediately so SSR
    // islands mount without waiting for a separate DOMContentLoaded listener.
    expect(result).toContain("data-island=\"AddToCart\"")
    expect(result).toContain("dataset.islandProps")
  })

  it('wraps island with RegoxProviders when providersPath given', () => {
    const result = generateIslandRegistration('CartButton', './frontend/src/RegoxProviders.tsx')
    expect(result).toContain(`import RegoxProviders from './frontend/src/RegoxProviders.tsx'`)
    expect(result).toContain('createElement(RegoxProviders, null, createElement(CartButton, props))')
  })

  it('does not import RegoxProviders when providersPath is undefined', () => {
    const result = generateIslandRegistration('CartButton', undefined)
    expect(result).not.toContain('RegoxProviders')
    expect(result).toContain('createElement(CartButton, props)')
  })
})
