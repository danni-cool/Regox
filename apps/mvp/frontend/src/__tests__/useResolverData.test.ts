import { describe, it, expect, beforeEach } from 'vitest'
import { useResolverData, _resetCacheForTest } from '../../lib/useResolverData'

beforeEach(() => {
  document.body.innerHTML = ''
  _resetCacheForTest()
})

describe('useResolverData', () => {
  it('returns undefined when no __REGOX_STATE__ element present (CSR mode)', () => {
    expect(useResolverData('cart')).toBeUndefined()
  })

  it('reads value from __REGOX_STATE__ script tag', () => {
    const el = document.createElement('script')
    el.id = '__REGOX_STATE__'
    el.type = 'application/json'
    el.textContent = JSON.stringify({ cart: { count: 5 } })
    document.body.appendChild(el)

    expect(useResolverData<{ count: number }>('cart')).toEqual({ count: 5 })
  })

  it('returns undefined for a key not in state', () => {
    const el = document.createElement('script')
    el.id = '__REGOX_STATE__'
    el.type = 'application/json'
    el.textContent = JSON.stringify({ cart: {} })
    document.body.appendChild(el)

    expect(useResolverData('missing')).toBeUndefined()
  })
})
