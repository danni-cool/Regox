import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { detectIslands } from '../island-detector'
import type { RegoxConfig } from '../types'

const baseConfig: RegoxConfig = { dev: { clientOnlyPackages: [] } }

type FileMap = Record<string, string>

function makeDetector(fileMap: FileMap) {
  return (source: string, filePath: string) =>
    detectIslands(source, filePath, {
      config: baseConfig,
      resolveFile: (importPath: string, fromFile: string) => {
        const dir = path.dirname(fromFile)
        const candidates = [
          path.join(dir, importPath),
          path.join(dir, importPath + '.tsx'),
          path.join(dir, importPath + '.ts'),
        ]
        for (const c of candidates) {
          if (fileMap[c]) return { path: c, source: fileMap[c] }
        }
        return null
      },
    })
}

describe('detectIslands — hook signals', () => {
  it('promotes component with useState to Island', () => {
    const detect = makeDetector({
      '/src/CartButton.tsx': `
        import { useState } from 'react'
        export function CartButton() {
          const [n, setN] = useState(0)
          return <button>{n}</button>
        }
      `,
    })
    const pageSrc = `
      import { CartButton } from './CartButton'
      export default function ProductPage({ product }) {
        return <div><CartButton productId={product.id} /></div>
      }
    `
    const islands = detect(pageSrc, '/src/ProductPage.tsx')
    expect(islands.has('CartButton')).toBe(true)
    expect(islands.get('CartButton')!.reason).toContain('useState')
  })

  it('does NOT promote pure render component', () => {
    const detect = makeDetector({
      '/src/ProductCard.tsx': `
        export function ProductCard({ product }) {
          return <div>{product.title}</div>
        }
      `,
    })
    const pageSrc = `
      import { ProductCard } from './ProductCard'
      export default function ShopPage({ products }) {
        return <ul>{products.map(p => <ProductCard product={p} />)}</ul>
      }
    `
    const islands = detect(pageSrc, '/src/ShopPage.tsx')
    expect(islands.has('ProductCard')).toBe(false)
  })

  it('promotes component with useEffect to Island', () => {
    const detect = makeDetector({
      '/src/Header.tsx': `
        import { useEffect } from 'react'
        export function Header() {
          useEffect(() => {}, [])
          return <header/>
        }
      `,
    })
    const pageSrc = `
      import { Header } from './Header'
      export default function Page() { return <div><Header /></div> }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    expect(islands.has('Header')).toBe(true)
    expect(islands.get('Header')!.reason).toContain('useEffect')
  })

  it('promotes component with custom hook (use* pattern)', () => {
    const detect = makeDetector({
      '/src/Header.tsx': `
        import { useSharedState } from '@regox/runtime'
        export function Header() {
          const [cart] = useSharedState('cart', null)
          return <header>{cart?.count}</header>
        }
      `,
    })
    const pageSrc = `
      import { Header } from './Header'
      export default function Page() { return <div><Header /></div> }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    expect(islands.has('Header')).toBe(true)
  })
})

describe('detectIslands — event handler signals', () => {
  it('promotes component when parent passes onClick prop', () => {
    const detect = makeDetector({
      '/src/Button.tsx': `
        export function Button({ onClick, label }) {
          return <button onClick={onClick}>{label}</button>
        }
      `,
    })
    const pageSrc = `
      import { Button } from './Button'
      export default function Page() {
        return <Button onClick={() => alert('hi')} label="click" />
      }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    expect(islands.has('Button')).toBe(true)
    expect(islands.get('Button')!.reason).toContain('onClick')
  })
})

describe('detectIslands — third-party packages', () => {
  it('promotes component importing from allowlist package', () => {
    const detect = makeDetector({
      '/src/AnimatedCard.tsx': `
        import { motion } from 'framer-motion'
        export function AnimatedCard({ children }) {
          return <motion.div>{children}</motion.div>
        }
      `,
    })
    const pageSrc = `
      import { AnimatedCard } from './AnimatedCard'
      export default function Page() { return <AnimatedCard>hello</AnimatedCard> }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    expect(islands.has('AnimatedCard')).toBe(true)
    expect(islands.get('AnimatedCard')!.reason).toContain('framer-motion')
  })

  it('promotes component importing from developer-declared package', () => {
    const config: RegoxConfig = { dev: { clientOnlyPackages: ['@company/ui-kit'] } }
    const detect = (source: string, filePath: string) =>
      detectIslands(source, filePath, {
        config,
        resolveFile: (importPath, fromFile) => {
          const dir = path.dirname(fromFile)
          const c = path.join(dir, importPath + '.tsx')
          const map: Record<string, string> = {
            '/src/FancyButton.tsx': `
              import { Button } from '@company/ui-kit'
              export function FancyButton() { return <Button>hi</Button> }
            `,
          }
          return map[c] ? { path: c, source: map[c] } : null
        },
      })
    const pageSrc = `
      import { FancyButton } from './FancyButton'
      export default function Page() { return <FancyButton /> }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    expect(islands.has('FancyButton')).toBe(true)
  })

  it('does NOT promote component from unknown third-party package (default SSR-safe)', () => {
    const detect = makeDetector({
      '/src/Dialog.tsx': `
        import { Dialog as RadixDialog } from '@radix-ui/react-dialog'
        export function Dialog({ children }) { return <RadixDialog>{children}</RadixDialog> }
      `,
    })
    const pageSrc = `
      import { Dialog } from './Dialog'
      export default function Page() { return <Dialog>content</Dialog> }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    expect(islands.has('Dialog')).toBe(false)
  })
})

describe('detectIslands — boundary cutting', () => {
  it('stops recursion at Island boundary (child of Island not separately detected)', () => {
    const detect = makeDetector({
      '/src/CartButton.tsx': `
        import { useState } from 'react'
        import { Icon } from './Icon'
        export function CartButton() {
          const [n, setN] = useState(0)
          return <button><Icon /></button>
        }
      `,
      '/src/Icon.tsx': `
        export function Icon() { return <svg/> }
      `,
    })
    const pageSrc = `
      import { CartButton } from './CartButton'
      export default function Page({ product }) {
        return <div><CartButton productId={product.id} /></div>
      }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    expect(islands.has('CartButton')).toBe(true)
    expect(islands.has('Icon')).toBe(false)
  })

  it('detects two sibling Islands independently', () => {
    const detect = makeDetector({
      '/src/CartButton.tsx': `
        import { useState } from 'react'
        export function CartButton() { const [n, setN] = useState(0); return <button/> }
      `,
      '/src/Header.tsx': `
        import { useEffect } from 'react'
        export function Header() { useEffect(() => {}, []); return <header/> }
      `,
    })
    const pageSrc = `
      import { CartButton } from './CartButton'
      import { Header } from './Header'
      export default function Page({ product }) {
        return <div><Header /><CartButton productId={product.id} /></div>
      }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    expect(islands.has('CartButton')).toBe(true)
    expect(islands.has('Header')).toBe(true)
    expect(islands.size).toBe(2)
  })
})

describe('detectIslands — props serialization', () => {
  it('serializes field-access props at Island boundary', () => {
    const detect = makeDetector({
      '/src/CartButton.tsx': `
        import { useState } from 'react'
        export function CartButton({ productId }) { const [n] = useState(0); return <button/> }
      `,
    })
    const pageSrc = `
      import { CartButton } from './CartButton'
      export default function ProductPage({ product }) {
        return <div><CartButton productId={product.id} /></div>
      }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    const meta = islands.get('CartButton')!
    expect(meta.props).toHaveLength(1)
    expect(meta.props[0]).toMatchObject({
      name: 'productId',
      expression: 'field-access',
      value: 'data.Product.Id',
    })
  })

  it('marks unsupported props without failing', () => {
    const detect = makeDetector({
      '/src/CartButton.tsx': `
        import { useState } from 'react'
        export function CartButton({ fn }) { const [n] = useState(0); return <button/> }
      `,
    })
    const pageSrc = `
      import { CartButton } from './CartButton'
      export default function ProductPage({ product }) {
        return <div><CartButton fn={x => x} /></div>
      }
    `
    const islands = detect(pageSrc, '/src/Page.tsx')
    const meta = islands.get('CartButton')!
    expect(meta.props[0]).toMatchObject({ name: 'fn', expression: 'unsupported' })
  })
})
