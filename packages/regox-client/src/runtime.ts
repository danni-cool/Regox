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

type IslandRegistry = Record<string, (props: Record<string, unknown>) => unknown>

export function mountIslands(registry: IslandRegistry): void {
  document.querySelectorAll<HTMLElement>('[data-island]').forEach(el => {
    const name = el.getAttribute('data-island')!
    const Component = registry[name]
    if (!Component) {
      console.warn(`[regox] Island "${name}" not registered`)
      return
    }
    let props: Record<string, unknown> = {}
    try {
      props = JSON.parse(el.getAttribute('data-island-props') ?? '{}')
    } catch {
      console.warn(`[regox] failed to parse props for Island "${name}"`)
    }
    Component(props)
  })
}

export function init(): void {
  const state = parseRegoxState()
  const islandCount = countIslandMounts()
  if (import.meta.env.DEV) {
    console.log('[regox] runtime init — state keys:', Object.keys(state), '— island mounts:', islandCount)
  }
}
