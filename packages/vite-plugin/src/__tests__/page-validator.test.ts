import { describe, it, expect } from 'vitest'
import { validatePageComponent } from '../page-validator'
import { CompileError } from '../jsx-compiler'

describe('validatePageComponent', () => {
  it('throws when page component uses useState directly', () => {
    const source = `
export const regox = { mode: 'ssr' }
export default function ProductPage() {
  const [x, setX] = useState(0)
  return <div>{x}</div>
}
`
    expect(() => validatePageComponent(source, 'product/[id].tsx')).toThrow(/client-side hook/)
  })

  it('does not throw when hooks are inside sub-components', () => {
    const source = `
export const regox = { mode: 'ssr' }
function AddToCart() {
  const [qty, setQty] = useState(1)
  return <button onClick={() => setQty(q => q + 1)}>{qty}</button>
}
export default function ProductPage() {
  return <div><AddToCart /></div>
}
`
    expect(() => validatePageComponent(source, 'product/[id].tsx')).not.toThrow()
  })

  it('does not validate CSR pages', () => {
    const source = `
export const regox = { mode: 'csr' }
export default function CartPage() {
  const [x, setX] = useState(0)
  return <div>{x}</div>
}
`
    expect(() => validatePageComponent(source, 'cart.tsx')).not.toThrow()
  })

  // New test: must throw CompileError (not plain Error)
  it('throws CompileError (not plain Error) for hook violation', () => {
    const source = `
export const regox = { mode: 'ssr' }
export default function ProductPage() {
  const [x, setX] = useState(0)
  return <div>{x}</div>
}
`
    let caught: unknown
    try { validatePageComponent(source, 'product/[id].tsx') } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(CompileError)
  })

  // New test: event handler on native element
  it('throws for inline onClick on native element in SSR page', () => {
    const source = `
export const regox = { mode: 'ssr' }
export default function ProductsPage({ products }: ProductsPageData) {
  return (
    <div>
      <button onClick={() => doSomething()}>Click</button>
    </div>
  )
}
`
    expect(() => validatePageComponent(source, 'products.tsx')).toThrow(CompileError)
  })

  // New test: useResolverData is exempt
  it('does not throw for useResolverData in SSR page', () => {
    const source = `
export const regox = { mode: 'ssr' }
export default function ProductPage() {
  const data = useResolverData('products')
  return <div>{data?.title}</div>
}
`
    expect(() => validatePageComponent(source, 'product/[id].tsx')).not.toThrow()
  })

  // New test: event handler inside <Client> is not a violation
  it('does not throw for event handlers inside Client render prop', () => {
    const source = `
export const regox = { mode: 'ssr' }
export default function ProductPage({ product }: ProductPageData) {
  return (
    <Client name="WishlistToggle" productId={product.id}>
      {({ productId }) => {
        const [saved, setSaved] = useState(false)
        return <button onClick={() => setSaved(s => !s)}>Save</button>
      }}
    </Client>
  )
}
`
    expect(() => validatePageComponent(source, 'product/[id].tsx')).not.toThrow()
  })

  // New test: error message includes guided remediation
  it('error message includes remediation options for hook violation', () => {
    const source = `
export const regox = { mode: 'ssr' }
export default function ProductPage() {
  const [x, setX] = useState(0)
  return <div>{x}</div>
}
`
    let caught: CompileError | undefined
    try { validatePageComponent(source, 'product/[id].tsx') } catch (e) { caught = e as CompileError }
    expect(caught?.message).toContain('<Client')
    expect(caught?.message).toContain("mode: 'csr'")
  })
})
