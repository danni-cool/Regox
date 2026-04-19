import { describe, it, expect } from 'vitest'
import { containsHook, containsEventHandlerProp, isClientOnlyPackage } from '../island-detector-utils'
import { parse } from '@babel/parser'

function parseFunc(src: string) {
  const ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  return ast
}

// ── Hook detection ────────────────────────────────────────────────────────────

describe('containsHook', () => {
  it('detects useState in function body', () => {
    const ast = parseFunc(`
      function CartButton() {
        const [count, setCount] = useState(0)
        return <button>{count}</button>
      }
    `)
    expect(containsHook(ast)).toBe(true)
  })

  it('detects useEffect in function body', () => {
    const ast = parseFunc(`
      function Header() {
        useEffect(() => { document.title = 'test' }, [])
        return <header/>
      }
    `)
    expect(containsHook(ast)).toBe(true)
  })

  it('detects useRef, useCallback, useMemo, useContext, useReducer, useLayoutEffect', () => {
    const hooks = ['useRef', 'useCallback', 'useMemo', 'useContext', 'useReducer', 'useLayoutEffect']
    for (const hook of hooks) {
      const ast = parseFunc(`function C() { ${hook}(() => {}); return <div/> }`)
      expect(containsHook(ast), `expected ${hook} to be detected`).toBe(true)
    }
  })

  it('detects custom hooks (use* pattern)', () => {
    const ast = parseFunc(`
      function Header() {
        useSharedState('cart', null)
        return <header/>
      }
    `)
    expect(containsHook(ast)).toBe(true)
  })

  it('returns false for pure render function', () => {
    const ast = parseFunc(`
      function ProductCard({ product }) {
        return <div>{product.title}</div>
      }
    `)
    expect(containsHook(ast)).toBe(false)
  })
})

// ── Event handler prop detection ──────────────────────────────────────────────

describe('containsEventHandlerProp', () => {
  it('detects onClick at JSX call-site', () => {
    const ast = parseFunc(`
      function ProductPage({ product }) {
        return <div><CartButton onClick={() => {}} /></div>
      }
    `)
    expect(containsEventHandlerProp(ast, 'CartButton')).toBe(true)
  })

  it('detects onChange, onSubmit, onFocus props', () => {
    for (const handler of ['onChange', 'onSubmit', 'onFocus', 'onBlur', 'onKeyDown']) {
      const ast = parseFunc(`
        function Page() { return <Form ${handler}={() => {}} /> }
      `)
      expect(containsEventHandlerProp(ast, 'Form'), `expected ${handler} to be detected`).toBe(true)
    }
  })

  it('returns false when no event handler props', () => {
    const ast = parseFunc(`
      function Page() { return <Header title="hello" /> }
    `)
    expect(containsEventHandlerProp(ast, 'Header')).toBe(false)
  })
})

// ── Third-party package allowlist ─────────────────────────────────────────────

describe('isClientOnlyPackage', () => {
  it('returns true for built-in allowlist packages', () => {
    const config = { clientOnlyPackages: [] }
    expect(isClientOnlyPackage('framer-motion', config)).toBe(true)
    expect(isClientOnlyPackage('react-spring', config)).toBe(true)
    expect(isClientOnlyPackage('react-hook-form', config)).toBe(true)
    expect(isClientOnlyPackage('react-hot-toast', config)).toBe(true)
  })

  it('returns true for developer-declared packages (D priority)', () => {
    const config = { clientOnlyPackages: ['@company/ui-kit', 'my-animation-lib'] }
    expect(isClientOnlyPackage('@company/ui-kit', config)).toBe(true)
    expect(isClientOnlyPackage('my-animation-lib', config)).toBe(true)
  })

  it('returns false for unknown packages', () => {
    const config = { clientOnlyPackages: [] }
    expect(isClientOnlyPackage('@radix-ui/react-dialog', config)).toBe(false)
    expect(isClientOnlyPackage('lodash', config)).toBe(false)
  })

  it('developer config overrides allowlist (D > A)', () => {
    const config = { clientOnlyPackages: ['framer-motion'] }
    expect(isClientOnlyPackage('framer-motion', config)).toBe(true)
  })
})
