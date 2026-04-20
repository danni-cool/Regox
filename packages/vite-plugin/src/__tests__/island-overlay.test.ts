import { describe, it, expect } from 'vitest'
import { generateIslandOverlayScript } from '../island-overlay'

describe('generateIslandOverlayScript', () => {
  it('returns a script tag with DEV guard', () => {
    const script = generateIslandOverlayScript()
    expect(script).toContain('<script type="module">')
    expect(script).toContain('import.meta.env')
    expect(script).toContain('[data-island]')
  })

  it('includes island name badge injection', () => {
    const script = generateIslandOverlayScript()
    expect(script).toContain('data-regox-overlay')
    expect(script).toContain('el.dataset.island')
  })
})
