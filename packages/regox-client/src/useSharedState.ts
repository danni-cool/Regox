import { useSyncExternalStore } from 'react'

type Scope = 'page' | 'session' | 'persistent'
type Listener = () => void

const stores = new Map<string, { value: unknown; listeners: Set<Listener> }>()

function getStore(key: string, initial: unknown) {
  if (!stores.has(key)) stores.set(key, { value: initial, listeners: new Set() })
  return stores.get(key)!
}

export function useSharedState<T>(
  key: string,
  initial?: T,
  _scope: Scope = 'page',
): [T, (updater: T | ((prev: T) => T)) => void] {
  const store = getStore(key, initial)

  const value = useSyncExternalStore(
    (cb) => { store.listeners.add(cb); return () => store.listeners.delete(cb) },
    () => store.value as T,
  )

  const set = (updater: T | ((prev: T) => T)) => {
    store.value = typeof updater === 'function'
      ? (updater as (prev: T) => T)(store.value as T)
      : updater
    store.listeners.forEach(cb => cb())
  }

  return [value, set]
}

export function _resetStoresForTest() { stores.clear() }
