export function generateIslandRegistration(componentName: string): string {
  return [
    `import { createElement } from 'react'`,
    `import { createRoot } from 'react-dom/client'`,
    `window.__regox_islands__ ??= {}`,
    `window.__regox_islands__['${componentName}'] = (el, props) => {`,
    `  const root = createRoot(el)`,
    `  root.render(createElement(${componentName}, props))`,
    `}`,
  ].join('\n')
}
