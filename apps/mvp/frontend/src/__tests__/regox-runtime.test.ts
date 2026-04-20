import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseRegoxState, countIslandMounts, mountIslands } from '@regox/client/src/runtime'

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
      <div data-island="CartButton" data-island-props="{}"></div>
      <div data-island="Header" data-island-props="{}"></div>
    `
    expect(countIslandMounts()).toBe(2)
  })
})

describe('mountIslands', () => {
  it('calls registry and mounts component on data-island element', () => {
    document.body.innerHTML = `
      <div data-island="Counter" data-island-props='{"count":5}'></div>
    `
    const mounted: Array<{ name: string; props: Record<string, unknown> }> = []
    const registry = {
      Counter: (props: Record<string, unknown>) => {
        mounted.push({ name: 'Counter', props })
        return null
      },
    }
    mountIslands(registry)
    expect(mounted).toHaveLength(1)
    expect(mounted[0].name).toBe('Counter')
    expect(mounted[0].props.count).toBe(5)
  })

  it('warns and skips unknown island names', () => {
    document.body.innerHTML = `<div data-island="Unknown" data-island-props='{}'></div>`
    const warned: string[] = []
    vi.spyOn(console, 'warn').mockImplementation((msg: string) => warned.push(msg))
    mountIslands({})
    expect(warned.some(m => m.includes('Unknown'))).toBe(true)
    vi.restoreAllMocks()
  })

  it('handles missing data-props gracefully', () => {
    document.body.innerHTML = `<div data-island="Box"></div>`
    const mounted: string[] = []
    mountIslands({ Box: () => { mounted.push('Box'); return null } })
    expect(mounted).toHaveLength(1)
  })
})
