import { parse } from '@babel/parser'
import { traverseFast } from '@babel/types'
import { CompileError } from './jsx-compiler.ts'

const REACT_HOOKS = new Set([
  'useState', 'useEffect', 'useReducer', 'useCallback', 'useMemo',
  'useRef', 'useContext', 'useLayoutEffect', 'useImperativeHandle',
  'useDebugValue', 'useId', 'useDeferredValue', 'useTransition',
])

// Hooks that are SSR-safe and must not trigger CompileError in SSR/ISR pages.
const SSR_SAFE_HOOKS = new Set(['useResolverData'])

const EVENT_HANDLER_PATTERN = /^on[A-Z]/

// Custom walker that respects early-exit: visitor returns true to stop descending.
// @babel/types traverseFast does NOT support return-false early exit — this does.
function walkWithStop(node: any, visitor: (node: any) => boolean | void): void {
  if (!node || typeof node !== 'object') return
  if (visitor(node) === true) return  // stop descending into this subtree
  for (const key of Object.keys(node)) {
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && item.type) {
          walkWithStop(item, visitor)
        }
      }
    } else if (child && typeof child === 'object' && child.type) {
      walkWithStop(child, visitor)
    }
  }
}

export function validatePageComponent(source: string, filePath: string): void {
  const modeMatch = source.match(/regox\s*=\s*\{[^}]*mode\s*:\s*['"](\w+)['"]/)
  const mode = modeMatch?.[1] ?? 'csr'
  if (mode === 'csr') return

  let ast: ReturnType<typeof parse>
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    })
  } catch {
    return
  }

  // Find the default export function name
  let defaultExportName: string | null = null
  traverseFast(ast as any, (node: any) => {
    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'FunctionDeclaration' &&
      node.declaration.id
    ) {
      defaultExportName = node.declaration.id.name
    }
  })

  if (!defaultExportName) return

  // Find the default export function and walk only its body
  traverseFast(ast as any, (node: any) => {
    if (
      node.type === 'FunctionDeclaration' &&
      node.id?.name === defaultExportName
    ) {
      for (const stmt of node.body.body ?? []) {
        walkWithStop(stmt, (child: any) => {
          // Stop descending into nested function bodies — their hooks are not page-level
          if (
            child !== stmt &&
            (child.type === 'FunctionDeclaration' ||
              child.type === 'FunctionExpression' ||
              child.type === 'ArrowFunctionExpression')
          ) {
            return true // stop — don't report violations inside sub-functions
          }

          // Stop descending into <Client> elements — render prop bodies are exempt
          if (
            child.type === 'JSXElement' &&
            child.openingElement?.name?.name === 'Client'
          ) {
            return true // stop — Client boundary is exempt
          }

          // Violation: hook call that is not SSR-safe
          if (
            child.type === 'CallExpression' &&
            child.callee.type === 'Identifier' &&
            REACT_HOOKS.has(child.callee.name) &&
            !SSR_SAFE_HOOKS.has(child.callee.name)
          ) {
            throw new CompileError(
              `SSR/ISR page "${defaultExportName}" has client-side hook "${child.callee.name}" at line ${child.loc?.start.line ?? '?'}.\n` +
              `Options:\n` +
              `  1. Wrap the interactive section:\n` +
              `       <Client name="MyComponent" ...props>\n` +
              `         {({ ...props }) => { /* hooks here */ }}\n` +
              `       </Client>\n` +
              `  2. Change the page config to mode: 'csr' if the whole page needs client state`,
              filePath,
            )
          }

          // Violation: inline event handler on any element in the page body
          if (
            child.type === 'JSXAttribute' &&
            EVENT_HANDLER_PATTERN.test(child.name?.name ?? '')
          ) {
            const handlerName = child.name?.name ?? 'on*'
            throw new CompileError(
              `SSR/ISR page "${defaultExportName}" has event handler "${handlerName}" at line ${child.loc?.start.line ?? '?'}.\n` +
              `Options:\n` +
              `  1. Wrap with <Client name="MyButton" ...props>{render prop}</Client>\n` +
              `  2. Use native HTML behavior (form submit, <details>, CSS :checked trick)`,
              filePath,
            )
          }
        })
      }
    }
  })
}
