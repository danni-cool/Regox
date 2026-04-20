import { describe, it, expect } from 'vitest'
import { validatePageComponent } from '../page-validator'

describe('validatePageComponent', () => {
  it('throws when page component uses useState directly', () => {
    const source = `
export const regox = { mode: 'ssr' }
export default function ProductPage() {
  const [x, setX] = useState(0)
  return <div>{x}</div>
}
`
    expect(() => validatePageComponent(source, 'product/[id].tsx')).toThrow(/cannot contain hooks/)
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
})
