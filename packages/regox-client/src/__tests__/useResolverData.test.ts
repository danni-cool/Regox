import { describe, it, expect, beforeEach } from 'vitest'
import { useResolverData, _resetCacheForTest } from '../useResolverData'

beforeEach(() => {
  _resetCacheForTest()
  document.getElementById('__REGOX_STATE__')?.remove()
})

describe('useResolverData', () => {
  it('returns undefined when no __REGOX_STATE__ element present', () => {
    expect(useResolverData('products')).toBeUndefined()
  })

  it('returns value from __REGOX_STATE__ for given key', () => {
    const el = document.createElement('script')
    el.id = '__REGOX_STATE__'
    el.type = 'application/json'
    el.textContent = JSON.stringify({ products: [{ id: '1' }] })
    document.body.appendChild(el)
    expect(useResolverData('products')).toEqual([{ id: '1' }])
  })

  it('returns undefined for missing key even when state present', () => {
    const el = document.createElement('script')
    el.id = '__REGOX_STATE__'
    el.type = 'application/json'
    el.textContent = JSON.stringify({ products: [] })
    document.body.appendChild(el)
    expect(useResolverData<string>('missing')).toBeUndefined()
  })
})
