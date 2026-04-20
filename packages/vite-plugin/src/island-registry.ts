export function generateIslandRegistration(componentName: string): string {
  return [
    `window.__regox_islands__ ??= {}`,
    `window.__regox_islands__['${componentName}'] = ${componentName}`,
  ].join('\n')
}
