import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSharedState } from '../useSharedState'

beforeEach(() => {
  // Reset stores map by re-importing. Since vitest isolates modules per test file
  // but not per test, we rely on unique keys per test.
})

describe('useSharedState', () => {
  it('returns initial value on first render', () => {
    const { result } = renderHook(() => useSharedState('test-init', 42))
    expect(result.current[0]).toBe(42)
  })

  it('setter updates value and triggers re-render', () => {
    const { result } = renderHook(() => useSharedState('test-setter', 0))
    act(() => { result.current[1](99) })
    expect(result.current[0]).toBe(99)
  })

  it('shares state across two hook instances with the same key', () => {
    const { result: a } = renderHook(() => useSharedState('shared-key', 0))
    const { result: b } = renderHook(() => useSharedState('shared-key', 0))
    act(() => { a.current[1](7) })
    expect(b.current[0]).toBe(7)
  })

  it('supports updater function', () => {
    const { result } = renderHook(() => useSharedState('test-fn', 10))
    act(() => { result.current[1](prev => prev + 5) })
    expect(result.current[0]).toBe(15)
  })
})
