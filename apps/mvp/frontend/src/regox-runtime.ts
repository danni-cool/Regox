export function parseRegoxState(): Record<string, unknown> {
  const el = document.getElementById('__REGOX_STATE__')
  if (!el) return {}
  try {
    return JSON.parse(el.textContent ?? '{}')
  } catch (e) {
    console.warn('[regox] failed to parse __REGOX_STATE__:', e)
    return {}
  }
}

export function countIslandMounts(): number {
  return document.querySelectorAll('[data-island]').length
}

export function init(): void {
  const state = parseRegoxState()
  const islandCount = countIslandMounts()
  if (import.meta.env.DEV) {
    console.log('[regox] runtime init — state keys:', Object.keys(state), '— island mounts:', islandCount)
  }
}
