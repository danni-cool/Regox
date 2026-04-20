type Handler = (payload: unknown) => void

interface Bus {
  on: (key: string, cb: Handler) => () => void
  emit: (key: string, payload: unknown) => void
}

function createBus(): Bus {
  const listeners = new Map<string, Set<Handler>>()
  return {
    on(key, cb) {
      if (!listeners.has(key)) listeners.set(key, new Set())
      listeners.get(key)!.add(cb)
      return () => listeners.get(key)?.delete(cb)
    },
    emit(key, payload) {
      listeners.get(key)?.forEach(cb => cb(payload))
    },
  }
}

declare global {
  interface Window { __regox_bus__?: Bus }
}

// Initialize exactly once, even across multiple module evaluations.
window.__regox_bus__ ??= createBus()

export const bus = window.__regox_bus__
