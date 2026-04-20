let resolverData: Record<string, unknown> | null = null

function getResolverData(): Record<string, unknown> {
  if (resolverData !== null) return resolverData
  const el = document.getElementById('__REGOX_STATE__')
  try {
    resolverData = el ? JSON.parse(el.textContent ?? '{}') : {}
  } catch (e) {
    console.warn('[regox] Failed to parse __REGOX_STATE__:', e)
    resolverData = {}
  }
  return resolverData
}

export function _resetCacheForTest() { resolverData = null }

export function useResolverData<T>(key: string): T | undefined {
  return getResolverData()[key] as T | undefined
}
