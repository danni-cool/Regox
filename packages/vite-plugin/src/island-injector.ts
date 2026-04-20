import type { IslandMap } from './types'

export function generateIslandInjectionScript(islandMap: IslandMap, bundleUrl: string): string {
  const _islandNames = Array.from(islandMap.keys())

  return `
<script type="module">
  window.__regox_islands__ = window.__regox_islands__ || {};
  window.__regox_bus__ = window.__regox_bus__;

  function mountIslands() {
    document.querySelectorAll('[data-island]').forEach(el => {
      const name = el.dataset.island;
      const factory = window.__regox_islands__[name];
      if (!factory) return;
      const props = el.dataset.islandProps ? JSON.parse(el.dataset.islandProps) : {};
      factory(el, props);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountIslands);
  } else {
    mountIslands();
  }
</script>
<script type="module" src="${bundleUrl}"></script>`
}

export function injectIslandScripts(html: string, islandMap: IslandMap, bundleUrl: string): string {
  const script = generateIslandInjectionScript(islandMap, bundleUrl)
  return html.replace('</body>', `${script}\n</body>`)
}
