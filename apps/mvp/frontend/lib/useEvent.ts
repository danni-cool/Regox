import { useEffect } from 'react'

type Bus = { on: (key: string, cb: (payload: unknown) => void) => () => void }

declare global {
  interface Window {
    __regox_bus__?: Bus
  }
}

export function useEvent<T>(key: string, handler: (payload: T) => void): void {
  useEffect(() => {
    if (!window.__regox_bus__) {
      console.warn('[regox] event bus not initialized, cannot subscribe to:', key)
      return
    }
    return window.__regox_bus__.on(key, handler as (p: unknown) => void)
  }, [key, handler])
}
