import { useEffect } from 'react'
import './bus'

export function useEvent<T>(key: string, handler: (payload: T) => void): void {
  useEffect(() => {
    return window.__regox_bus__!.on(key, handler as (p: unknown) => void)
  }, [key, handler])
}
