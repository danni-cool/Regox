import type { IslandMap } from './types'
import { generateIslandOverlayScript } from './island-overlay.ts'

export function generateIslandInjectionScript(islandMap: IslandMap, bundleUrl: string): string {
  const _islandNames = Array.from(islandMap.keys())

  return `
<script type="application/json" id="__REGOX_STATE__">{}</script>
<script type="module">
  // Initialize event bus
  const listeners = {};
  window.__regox_bus__ = {
    emit(key, payload) {
      (listeners[key] || []).forEach(cb => cb(payload));
    },
    on(key, cb) {
      listeners[key] = listeners[key] || [];
      listeners[key].push(cb);
      return () => { listeners[key] = listeners[key].filter(fn => fn !== cb); };
    },
  };

  function mountIslands() {
    document.querySelectorAll('[data-island]').forEach(el => {
      const name = el.dataset.island;
      const factory = window.__regox_islands__?.[name];
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

export function injectIslandScripts(html: string, islandMap: IslandMap, bundleUrl: string, dev = false): string {
  const script = generateIslandInjectionScript(islandMap, bundleUrl)
  const overlay = dev ? generateIslandOverlayScript() : ''
  return html.replace('</body>', `${script}${overlay}\n</body>`)
}
