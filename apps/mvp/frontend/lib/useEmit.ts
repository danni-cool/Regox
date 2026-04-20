type Bus = { emit: (key: string, payload: unknown) => void }

declare global {
  interface Window {
    __regox_bus__?: Bus
  }
}

export function useEmit<T>(key: string): (payload: T) => void {
  return (payload: T) => {
    if (!window.__regox_bus__) {
      console.warn('[regox] event bus not initialized, dropping event:', key)
      return
    }
    window.__regox_bus__.emit(key, payload)
  }
}
