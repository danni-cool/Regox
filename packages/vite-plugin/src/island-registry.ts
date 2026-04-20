export function generateIslandRegistration(componentName: string): string {
  return [
    `import { createElement } from 'react'`,
    `import { createRoot } from 'react-dom/client'`,
    `window.__regox_islands__ ??= {}`,
    `window.__regox_islands__['${componentName}'] = (el, props) => {`,
    `  const root = createRoot(el)`,
    `  root.render(createElement(${componentName}, props))`,
    `}`,
    // Self-mount: immediately hydrate any SSR-rendered mount points for this island.
    // This avoids a DOMContentLoaded race where the inline init script fires before
    // the island bundle has registered its factories.
    `document.querySelectorAll('[data-island="${componentName}"]').forEach(el => {`,
    `  const props = el.dataset.islandProps ? JSON.parse(el.dataset.islandProps) : {}`,
    `  window.__regox_islands__['${componentName}'](el, props)`,
    `})`,
  ].join('\n')
}
