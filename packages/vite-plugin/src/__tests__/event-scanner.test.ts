import { describe, it, expect } from 'vitest'
import { scanEventUsage, buildEventMap } from '../event-scanner'

describe('scanEventUsage', () => {
  it('detects useEmit calls with string literal keys', () => {
    const source = `
      import { useEmit } from '../lib/useEmit'
      const emit = useEmit('cart:updated')
    `
    const entries = scanEventUsage(source, 'AddToCart.tsx')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({ key: 'cart:updated', direction: 'emit', file: 'AddToCart.tsx' })
  })

  it('detects useEvent calls with string literal keys', () => {
    const source = `
      import { useEvent } from '../lib/useEvent'
      useEvent('cart:updated', handler)
    `
    const entries = scanEventUsage(source, 'CartBadge.tsx')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({ key: 'cart:updated', direction: 'listen', file: 'CartBadge.tsx' })
  })
})

describe('buildEventMap', () => {
  it('groups entries by key into emitters and listeners', () => {
    const entries = [
      { key: 'cart:updated', direction: 'emit' as const, file: 'AddToCart.tsx' },
      { key: 'cart:updated', direction: 'listen' as const, file: 'CartBadge.tsx' },
    ]
    const map = buildEventMap(entries)
    expect(map['cart:updated'].emitters).toEqual(['AddToCart.tsx'])
    expect(map['cart:updated'].listeners).toEqual(['CartBadge.tsx'])
  })
})
