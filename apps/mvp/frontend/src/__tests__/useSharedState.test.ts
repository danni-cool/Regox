import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSharedState } from '../../lib/useSharedState'

// Each test uses a unique key to avoid cross-test state bleed.
// stores is a module-level Map; vi.resetModules() does not clear static imports.

describe('useSharedState', () => {
  it('returns initial value', () => {
    const { result } = renderHook(() => useSharedState('t1-init', 0))
    expect(result.current[0]).toBe(0)
  })

  it('updates value when setter called', () => {
    const { result } = renderHook(() => useSharedState('t2-update', 0))
    act(() => result.current[1](5))
    expect(result.current[0]).toBe(5)
  })

  it('supports functional updater', () => {
    const { result } = renderHook(() => useSharedState('t3-functional', 10))
    act(() => result.current[1]((prev) => prev + 1))
    expect(result.current[0]).toBe(11)
  })

  it('two hooks on same key share state', () => {
    const hook1 = renderHook(() => useSharedState('t4-shared', 0))
    const hook2 = renderHook(() => useSharedState('t4-shared', 0))
    act(() => hook1.result.current[1](42))
    expect(hook2.result.current[0]).toBe(42)
  })
})
