import { useEffect, useRef } from 'react'
import './bus'

export function useEvent<T>(key: string, handler: (payload: T) => void): void {
  const handlerRef = useRef(handler)
  useEffect(() => { handlerRef.current = handler })

  useEffect(() => {
    return window.__regox_bus__!.on(key, (p) => handlerRef.current(p as T))
  }, [key])
}
