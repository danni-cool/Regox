import { describe, it, expect, beforeEach } from 'vitest'
import { parseRegoxState, countIslandMounts } from '../regox-runtime'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('parseRegoxState', () => {
  it('returns empty object when no state element present', () => {
    expect(parseRegoxState()).toEqual({})
  })

  it('parses JSON from __REGOX_STATE__ script tag', () => {
    const el = document.createElement('script')
    el.id = '__REGOX_STATE__'
    el.type = 'application/json'
    el.textContent = JSON.stringify({ cart: { count: 3 } })
    document.body.appendChild(el)

    expect(parseRegoxState()).toEqual({ cart: { count: 3 } })
  })

  it('returns empty object for malformed JSON', () => {
    const el = document.createElement('script')
    el.id = '__REGOX_STATE__'
    el.type = 'application/json'
    el.textContent = 'not-valid-json'
    document.body.appendChild(el)

    expect(parseRegoxState()).toEqual({})
  })
})

describe('countIslandMounts', () => {
  it('returns 0 when no island mounts present', () => {
    expect(countIslandMounts()).toBe(0)
  })

  it('counts elements with data-island attribute', () => {
    document.body.innerHTML = `
      <div data-island="CartButton" data-props="{}"></div>
      <div data-island="Header" data-props="{}"></div>
    `
    expect(countIslandMounts()).toBe(2)
  })
})
