import { describe, it, expect } from 'vitest'
import { generateIslandRegistration } from '../island-registry'

describe('generateIslandRegistration', () => {
  it('generates window assignment for a named island', () => {
    const result = generateIslandRegistration('CartButton')
    expect(result).toContain(`window.__regox_islands__ ??= {}`)
    expect(result).toContain(`window.__regox_islands__['CartButton'] = CartButton`)
  })

  it('generates unique variable name for each island', () => {
    const a = generateIslandRegistration('Header')
    const b = generateIslandRegistration('Footer')
    expect(a).toContain("'Header'")
    expect(b).toContain("'Footer'")
  })
})
