import * as t from '@babel/types'

const REACT_HOOKS = new Set([
  'useState', 'useEffect', 'useRef', 'useCallback',
  'useMemo', 'useContext', 'useReducer', 'useLayoutEffect',
])

const CLIENT_ONLY_ALLOWLIST = new Set([
  'framer-motion',
  'react-spring',
  'react-use',
  'react-dnd',
  'react-beautiful-dnd',
  'react-hook-form',
  'react-hot-toast',
  'react-toastify',
  'react-modal',
  'react-select',
])

const EVENT_HANDLER_RE = /^on[A-Z]/

interface ClientOnlyConfig {
  clientOnlyPackages: string[]
}

export function containsHook(ast: t.File): boolean {
  return walkContains(ast.program, node => {
    if (!t.isCallExpression(node)) return false
    const callee = node.callee
    if (t.isIdentifier(callee)) {
      return REACT_HOOKS.has(callee.name) || /^use[A-Z]/.test(callee.name)
    }
    return false
  })
}

// A component is marked as Island if it receives an on[A-Z]* prop at the
// call-site. This assumes the component actually handles the prop (T2=A: single-direction).
export function containsEventHandlerProp(
  ast: t.File,
  componentName: string,
): boolean {
  return walkContains(ast.program, node => {
    if (!t.isJSXOpeningElement(node)) return false
    const nameNode = node.name
    if (!t.isJSXIdentifier(nameNode) || nameNode.name !== componentName) return false
    return node.attributes.some(attr => {
      if (!t.isJSXAttribute(attr)) return false
      const attrName = t.isJSXIdentifier(attr.name) ? attr.name.name : ''
      return EVENT_HANDLER_RE.test(attrName)
    })
  })
}

export function isClientOnlyPackage(pkgName: string, config: ClientOnlyConfig): boolean {
  if (config.clientOnlyPackages.includes(pkgName)) return true
  if (CLIENT_ONLY_ALLOWLIST.has(pkgName)) return true
  return false
}

export function getImportedPackages(ast: t.File): string[] {
  const pkgs: string[] = []
  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node)) {
      pkgs.push(node.source.value)
    }
  }
  return pkgs
}

function walkContains(node: t.Node, predicate: (n: t.Node) => boolean): boolean {
  if (predicate(node)) return true
  for (const key of Object.keys(node) as (keyof typeof node)[]) {
    const child = (node as any)[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          if (walkContains(item as t.Node, predicate)) return true
        }
      }
    } else if (child && typeof child === 'object' && 'type' in child) {
      if (walkContains(child as t.Node, predicate)) return true
    }
  }
  return false
}
