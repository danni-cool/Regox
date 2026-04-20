import { parse } from '@babel/parser'
import { traverseFast } from '@babel/types'

const REACT_HOOKS = new Set([
  'useState', 'useEffect', 'useReducer', 'useCallback', 'useMemo',
  'useRef', 'useContext', 'useLayoutEffect', 'useImperativeHandle',
  'useDebugValue', 'useId', 'useDeferredValue', 'useTransition',
])

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

  // Walk only the body of the default export function to detect direct hook usage
  traverseFast(ast as any, (node: any) => {
    if (
      node.type === 'FunctionDeclaration' &&
      node.id?.name === defaultExportName
    ) {
      // Only check direct children of this function — skip nested function bodies
      for (const stmt of node.body.body ?? []) {
        traverseFast(stmt, (child: any) => {
          // Stop descending into nested function declarations/expressions
          if (
            child !== stmt &&
            (child.type === 'FunctionDeclaration' ||
              child.type === 'FunctionExpression' ||
              child.type === 'ArrowFunctionExpression')
          ) {
            return false
          }
          if (
            child.type === 'CallExpression' &&
            child.callee.type === 'Identifier' &&
            REACT_HOOKS.has(child.callee.name)
          ) {
            throw new Error(
              `[regox] Page component "${defaultExportName}" cannot contain hooks directly. ` +
              `Extract interactive logic into a sub-component (Island). ` +
              `SSR/ISR page components cannot contain hooks.\n` +
              `  at ${filePath}`
            )
          }
        })
      }
    }
  })
}
