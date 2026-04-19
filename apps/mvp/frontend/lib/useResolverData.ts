// Reads server-injected data from __REGOX_STATE__ for use as React Query initialData.
// Returns undefined in CSR context (no __REGOX_STATE__ present).

let resolverData: Record<string, unknown> | null = null

function getResolverData(): Record<string, unknown> {
  if (resolverData !== null) return resolverData
  const el = document.getElementById('__REGOX_STATE__')
  resolverData = el ? JSON.parse(el.textContent ?? '{}') : {}
  return resolverData
}

export function useResolverData<T>(key: string): T | undefined {
  return getResolverData()[key] as T | undefined
}
