import './bus'

export function useEmit<T>(key: string): (payload: T) => void {
  return (payload: T) => {
    window.__regox_bus__!.emit(key, payload)
  }
}
